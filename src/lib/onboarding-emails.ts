/**
 * HASHCODE REBOOT — messagerie d'onboarding (extraite de POST /api/members).
 *
 * `sendOnboardingEmails` regroupe les envois déclenchés à l'inscription :
 * lien de vérification (toujours) puis, selon la lane d'accès décidée par la
 * route, welcome + invitation (lane "immediate") ou waitlist (autres lanes).
 * Le contenu (builders) et les templates actifs en base restent dans
 * src/lib/email/ — ici on ne fait que l'orchestration.
 *
 * GARANTIES
 * - Fire-and-forget : appelée avec `void` par la route, ne lève jamais (la
 *   réponse 201 part sans attendre les providers, chaque envoi a son timeout).
 * - Idempotence 24 h : avant d'envoyer welcome/invitation/waitlist, on vérifie
 *   EmailEvent (+ MemberEmailLog, mêmes kinds pour l'avenir) — pattern repris
 *   de notifyStatusChange (anti-doublon 1 h sur status_change). Le lien de
 *   vérification garde son propre garde-fou (cooldown 60 s + invalidation de
 *   l'ancien lien dans requestEmailLink).
 * - Garde budget fail-open : planBatch est consulté à titre d'observabilité
 *   (quota épuisé → log + alerte analytics, SANS empêcher l'envoi : un email
 *   d'onboarding perdu n'a pas de prochain passage pour le rattraper, et
 *   l'inscription — déjà persistée — ne doit jamais en dépendre). Si la mesure
 *   elle-même échoue, on envoie quand même (prudence ≠ paralysie).
 */

import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import {
  sendInvitationEmail,
  sendWelcomeEmail,
  sendWaitlistEmail,
} from "@/lib/email/builders";
import { planBatch } from "@/lib/email-budget";
import { sendVerificationLink } from "@/lib/verify-email";

export interface OnboardingMember {
  id: string;
  email: string;
  firstName: string;
  archetype: string;
}

/** Fenêtre d'idempotence des emails d'onboarding (welcome/invitation/waitlist). */
const ONBOARDING_IDEMPOTENCE_MS = 24 * 60 * 60 * 1000;

/**
 * Catégories EmailEvent écrites par le transport (categorizeEmail) pour ces
 * envois : welcome + invitation → "welcome", waitlist → "waitlist".
 * (Le lien de vérification tombe dans "other" et n'est pas couvert ici.)
 */
const ONBOARDING_EVENT_CATEGORIES = ["welcome", "waitlist"];

/** Kinds MemberEmailLog correspondants (aucun loggé aujourd'hui — contrôle d'avenir). */
const ONBOARDING_LOG_KINDS = ["welcome", "invitation", "waitlist"];

/** Déjà un email d'onboarding envoyé à ce membre dans la fenêtre ? (fail-open : en cas d'erreur DB, on envoie.) */
async function alreadyOnboarded(memberId: string): Promise<boolean> {
  const since = new Date(Date.now() - ONBOARDING_IDEMPOTENCE_MS);
  try {
    const [recentEvent, recentLog] = await Promise.all([
      db.emailEvent.findFirst({
        where: {
          memberId,
          type: "email.sent",
          category: { in: ONBOARDING_EVENT_CATEGORIES },
          createdAt: { gte: since },
        },
        select: { id: true },
      }),
      db.memberEmailLog.findFirst({
        where: {
          memberId,
          kind: { in: ONBOARDING_LOG_KINDS },
          createdAt: { gte: since },
        },
        select: { id: true },
      }),
    ]);
    return Boolean(recentEvent ?? recentLog);
  } catch (err) {
    console.warn("[onboarding-emails] contrôle idempotence indisponible (fail-open)", err);
    return false;
  }
}

/** Garde budget à titre d'alerte : ne bloque ni ne lève jamais. */
async function checkBudgetAllows(memberId: string, requested: number): Promise<void> {
  let level: string = "unknown";
  try {
    const plan = await planBatch({ category: "marketing", requested });
    level = plan.level;
  } catch (err) {
    console.warn("[onboarding-emails] garde budget indisponible (fail-open, envoi maintenu)", err);
    return;
  }
  if (level === "blocked") {
    console.error("[onboarding-emails] quota email épuisé — envoi d'onboarding maintenu (fail-open)", {
      memberId,
      requested,
    });
    // Alerte visible côté admin (best-effort, n'échoue jamais l'envoi).
    try {
      await db.analyticsEvent.create({
        data: toServerEventData({
          type: "onboarding_email_budget_blocked",
          memberId,
          ref: `requested:${requested}`,
        }),
      });
    } catch {
      /* ignore */
    }
  }
}

function dashboardUrl(): string {
  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://reboot.joinhashcode.com";
  return `${siteBase.replace(/\/$/, "")}/dashboard`;
}

/**
 * Envoie la séquence d'emails d'onboarding. Ne lève jamais.
 * La décision de lane reste à la charge de l'appelant (route members).
 */
export async function sendOnboardingEmails(
  member: OnboardingMember,
  lane: string | null,
): Promise<void> {
  const { id: memberId, email, firstName, archetype } = member;

  // 1) Lien de vérification — toujours (cooldown 60 s intégré, silencieux ici).
  await sendVerificationLink(email, firstName);

  if (lane === "immediate") {
    await checkBudgetAllows(memberId, 2);
    if (await alreadyOnboarded(memberId)) return;
    const url = dashboardUrl();
    const results = await Promise.allSettled([
      sendWelcomeEmail({ to: email, firstName, archetype }),
      sendInvitationEmail({ to: email, firstName, dashboardUrl: url }),
    ]);
    const labels = ["welcome", "invitation"] as const;
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[onboarding-emails] envoi ${labels[i]} : exception`, r.reason);
      } else if (!r.value.ok) {
        console.warn(`[onboarding-emails] envoi ${labels[i]} échoué`, {
          provider: r.value.provider,
          status: r.value.status,
          error: r.value.error,
          email,
        });
      }
    });
  } else {
    await checkBudgetAllows(memberId, 1);
    if (await alreadyOnboarded(memberId)) return;
    try {
      const result = await sendWaitlistEmail({ to: email, firstName });
      if (!result.ok) {
        console.warn("[onboarding-emails] envoi waitlist échoué", {
          provider: result.provider,
          status: result.status,
          error: result.error,
          email,
        });
      }
    } catch (err) {
      console.error("[onboarding-emails] envoi waitlist : exception", err);
    }
  }
}
