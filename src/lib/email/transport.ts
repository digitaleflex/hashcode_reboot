// HASHCODE REBOOT — transport email (Resend primary + Brevo fallback).
// Extrait de src/lib/mail.ts (Struct-1) : routage provider + tracking DB.
// Ne journalise ni ne retourne JAMAIS de secret (RESEND_API_KEY / BREVO_API_KEY).

import { db } from "@/lib/db";

const RESEND_URL = "https://api.resend.com/emails";
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const SEND_TIMEOUT_MS = 8000;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * Tags de suivi (ex: ["invitation"]). Transmis aux providers :
   * Brevo `tags: string[]`, Resend `tags: [{name, value}]`.
   * Servent à filtrer les logs et à router les webhooks.
   */
  tags?: string[];
  /**
   * Catégorie d'email : utilisée par sendEmail() pour router le provider.
   * - "marketing" → Brevo (primary) → Resend (fallback)
   * - "transactional" → Resend (primary) → Brevo (fallback si BREVO_FALLBACK_ON_429=true)
   * - "notification" → Resend (primary) — codes, accept/refuse, bounce
   * - "code" → Resend (primary) — liens de connexion, OTP, magic link
   */
  category?:
    | "marketing"
    | "transactional"
    | "notification"
    | "code";

  /**
   * Forcer un provider spécifique (ex. Brevo pour les lots > 20). Si absent,
   * le routage par catégorie s'applique. Un fallback automatique sur l'autre
   * provider reste possible en cas de 429 (si BREVO_FALLBACK_ON_429=true).
   */
  forceProvider?: "resend" | "brevo";
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  provider?: "resend" | "brevo";
  /**
   * Diagnostic uniquement : statut HTTP renvoyé par le provider lors d'un
   * échec (ex. 403 domaine non vérifié, 401 clé invalide). Absent en cas de
   * succès ou d'erreur réseau (aucune réponse HTTP).
   */
  status?: number;
  /**
   * Diagnostic uniquement : message d'erreur court renvoyé par le provider
   * (extrait tronqué du corps de réponse) ou cause locale (clé/expéditeur
   * manquant, exception réseau). Jamais de secret.
   */
  error?: string;
}

/** Lit un extrait tronqué du corps d'une réponse provider en échec.
 * Ne journalise ni n'expose jamais les en-têtes ni la clé API. */
async function readErrorExcerpt(res: Response): Promise<string | undefined> {
  try {
    const text = (await res.text()).trim();
    if (!text) return undefined;
    return text.length > 300 ? `${text.slice(0, 300)}...` : text;
  } catch {
    return undefined;
  }
}

/** Track email.sent in EmailEvent table (fire-and-forget). */
function categorizeEmail(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("bienvenue") || s.includes("invitation")) return "welcome";
  if (s.includes("inscription") || s.includes("merci")) return "waitlist";
  if (s.includes("t'attend") || s.includes("rejoins")) return "engagement";
  if (s.includes("reprend") || s.includes("termin")) return "relance";
  if (
    s.includes("validé") ||
    s.includes("liste d'attente") ||
    s.includes("non retenu")
  )
    return "status_change";
  return "other";
}

async function trackEmailSent(
  to: string,
  subject: string,
  provider: "resend" | "brevo",
): Promise<void> {
  try {
    const member = await db.member.findUnique({
      where: { email: to },
      select: { id: true },
    });
    await db.emailEvent.create({
      data: {
        email: to,
        memberId: member?.id ?? null,
        type: "email.sent",
        category: categorizeEmail(subject),
        // Enregistré pour que le garde-fou de quota (email-budget) puisse
        // compter les envois par provider en temps réel.
        provider,
      },
    });
  } catch {
    // silent — email tracking is best-effort
  }
}

/**
 * POST https://api.resend.com/emails avec `Authorization: Bearer <RESEND_API_KEY>`.
 * Retourne { ok: false } en cas d'erreur, avec status/error de diagnostic.
 */
async function sendViaResend({
  to,
  subject,
  html,
  text,
  tags,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    const error = "RESEND_API_KEY ou EMAIL_FROM manquant";
    console.error("[Email] resend a refusé l'envoi", {
      status: undefined,
      error,
      to,
      subject,
    });
    return { ok: false, provider: "resend", error };
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        ...(tags?.length
          ? { tags: tags.map((name) => ({ name, value: "1" })) }
          : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const error = await readErrorExcerpt(res);
      console.error("[Email] resend a refusé l'envoi", {
        status: res.status,
        error,
        to,
        subject,
      });
      return { ok: false, provider: "resend", status: res.status, error };
    }
    try {
      const payload = (await res.json()) as { id?: unknown };
      const id = typeof payload.id === "string" ? payload.id : undefined;
      trackEmailSent(to, subject, "resend").catch(() => {});
      return id ? { ok: true, id, provider: "resend" } : { ok: true, provider: "resend" };
    } catch {
      trackEmailSent(to, subject, "resend").catch(() => {});
      return { ok: true, provider: "resend" };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[Email] resend a refusé l'envoi", {
      status: undefined,
      error,
      to,
      subject,
    });
    return { ok: false, provider: "resend", error };
  }
}

/**
 * POST https://api.brevo.com/v3/smtp/email avec `api-key: <BREVO_API_KEY>`.
 * Retourne { ok: false } en cas d'erreur, avec status/error de diagnostic.
 */
async function sendViaBrevo({
  to,
  subject,
  html,
  text,
  tags,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_EMAIL_FROM;
  if (!apiKey || !from) {
    const error = "BREVO_API_KEY ou BREVO_EMAIL_FROM manquant";
    console.error("[Email] brevo a refusé l'envoi", {
      status: undefined,
      error,
      to,
      subject,
    });
    return { ok: false, provider: "brevo", error };
  }
  // Extraire l'email du format "Nom <email@domaine>"
  const emailMatch = from.match(/<([^>]+)>/);
  const fromEmail = emailMatch ? emailMatch[1] : from;
  const fromName = from.replace(/<[^>]+>/, "").trim() || "HASHCODE REBOOT";
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
        ...(tags?.length ? { tags } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const error = await readErrorExcerpt(res);
      console.error("[Email] brevo a refusé l'envoi", {
        status: res.status,
        error,
        to,
        subject,
      });
      return { ok: false, provider: "brevo", status: res.status, error };
    }
    try {
      const payload = (await res.json()) as { messageId?: unknown };
      const id = typeof payload.messageId === "string" ? payload.messageId : undefined;
      trackEmailSent(to, subject, "brevo").catch(() => {});
      return id ? { ok: true, id, provider: "brevo" } : { ok: true, provider: "brevo" };
    } catch {
      trackEmailSent(to, subject, "brevo").catch(() => {});
      return { ok: true, provider: "brevo" };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[Email] brevo a refusé l'envoi", {
      status: undefined,
      error,
      to,
      subject,
    });
    return { ok: false, provider: "brevo", error };
  }
}

/**
 * Envoi d'email avec routage provider par catégorie :
 * - category="marketing" → Brevo (primary) → Resend (fallback)
 * - category="notification" / "code" → Resend (primary) ou Brevo si EMAIL_PROVIDER=brevo → fallback sur l'autre si BREVO_FALLBACK_ON_429=true
 * - category="transactional" / défaut → Resend (primary) → Brevo (fallback si BREVO_FALLBACK_ON_429=true)
 * - EMAIL_PROVIDER=brevo → Brevo prioritaire pour toutes les catégories (notification, code, transactional)
 * Ne lève jamais : toute erreur retourne { ok: false } accompagné des
 * diagnostics (status/error) et journalisée via console.error.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  tags,
  category,
  forceProvider,
}: SendEmailInput): Promise<SendEmailResult> {
  const input = { to, subject, html, text, tags };

  // ── Provider forcé (lots > 20 → Brevo) ────────────────────────────────
  // Le routage par catégorie est court-circuité, mais le fallback 429 reste
  // actif : si le provider forcé est en erreur, on tente l'autre.
  if (forceProvider) {
    const primary = forceProvider === "brevo" ? sendViaBrevo : sendViaResend;
    const fallback = forceProvider === "brevo" ? sendViaResend : sendViaBrevo;
    const result = await primary(input);
    if (result.ok) return result;
    if (process.env.BREVO_FALLBACK_ON_429 === "true") {
      const fb = await fallback(input);
      if (fb.ok) return fb;
    }
    return result;
  }

  // ── Routage par catégorie (par défaut) ─────────────────────────────────

  // Notification / code → Resend en primary, ou Brevo si EMAIL_PROVIDER=brevo
  if (category === "notification" || category === "code") {
    const isBrevo = process.env.EMAIL_PROVIDER === "brevo";
    const primary = isBrevo ? sendViaBrevo : sendViaResend;
    const fallback = isBrevo ? sendViaResend : sendViaBrevo;
    const primaryName = isBrevo ? "Brevo" : "Resend";
    const fallbackName = isBrevo ? "Resend" : "Brevo";
    const result = await primary(input);
    if (result.ok) return result;
    if (process.env.BREVO_FALLBACK_ON_429 === "true") {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[Email] Basculement ${primaryName} → ${fallbackName} (fallback) pour`, to);
      }
      const fb = await fallback(input);
      if (fb.ok) return fb;
    }
    return result;
  }

  // Marketing → Brevo primary, Resend fallback
  if (category === "marketing") {
    const brevoResult = await sendViaBrevo(input);
    if (brevoResult.ok) return brevoResult;
    if (process.env.NODE_ENV !== "production") {
      console.info("[Email] Basculement Brevo → Resend pour", to);
    }
    const resendResult = await sendViaResend(input);
    if (resendResult.ok) return resendResult;
    return brevoResult;
  }

  // EMAIL_PROVIDER=brevo → Brevo prioritaire (sauf notification/code déjà traités)
  if (process.env.EMAIL_PROVIDER === "brevo") {
    const brevoResult = await sendViaBrevo(input);
    if (brevoResult.ok) {
      return brevoResult;
    }
    if (process.env.NODE_ENV !== "production") {
      console.info("[Email] Basculement Brevo → Resend pour", to);
    }
    return sendViaResend(input);
  }

  // Défaut : Resend (primary)
  const resendResult = await sendViaResend(input);
  if (resendResult.ok) {
    return resendResult;
  }

  // Fallback vers Brevo si activé
  const fallbackOn429 = process.env.BREVO_FALLBACK_ON_429 === "true";
  if (fallbackOn429) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Brevo Fallback] Basculement Resend → Brevo pour", to);
    }
    const brevoResult = await sendViaBrevo(input);
    if (brevoResult.ok) return brevoResult;
  }

  return resendResult;
}
