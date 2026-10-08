import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { isAdminAuthed, requireAdminRole, getAdminRole, checkCSRF } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { normalizeAccessLane } from "@/lib/import/normalize";
import { audit } from "@/lib/admin-audit";
import { sendStatusChangeEmail, type StatusChangeType } from "@/lib/email/builders";
import { addToBlacklist } from "@/lib/blacklist";
import { blockIfTesting } from "@/lib/test-guard";
import {
  AppError,
  AuthError,
  errorToResponse,
  ForbiddenError,
  NotFoundError,
  parseJsonBody,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

const VALID_PROFILE_STATUS = new Set([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WAITLIST",
]);
const VALID_COMMUNITY_STATUS = new Set([
  "NOT_INVITED",
  "INVITED",
  "JOINED",
]);

/** Bornes des tags libres (#102) — calées sur les skills ateliers
 * (cf. lib/workshops/validation.ts validateSessionCreate). */
const CUSTOM_TAGS_MAX = 20;
const CUSTOM_TAG_MAX_LEN = 40;

/**
 * Normalise + valide les tags libres : trim, minuscules, vides retirés,
 * dédupliqués, bornés (20 tags, 40 caractères chacun).
 */
function validateCustomTags(
  v: unknown,
): { ok: true; tags: string[] } | { ok: false; error: string } {
  if (!Array.isArray(v)) {
    return { ok: false, error: "customTags doit être un tableau de chaînes." };
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of v) {
    const t = String(raw).trim().toLowerCase();
    if (!t) continue;
    if (t.length > CUSTOM_TAG_MAX_LEN) {
      return { ok: false, error: "Chaque tag est limité à 40 caractères." };
    }
    if (seen.has(t)) continue;
    seen.add(t);
    tags.push(t);
  }
  if (tags.length > CUSTOM_TAGS_MAX) {
    return { ok: false, error: "20 tags libres maximum." };
  }
  return { ok: true, tags };
}

/** GET /api/members/[id] — full member detail (admin-only). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdminAuthed(req))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }
    const { id } = await params;
    const member = await db.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundError("Membre introuvable.");

    const decode = <T,>(s: string, fallback: T): T => {
      try {
        return JSON.parse(s) as T;
      } catch {
        return fallback;
      }
    };
    return NextResponse.json({
      member: {
        ...member,
        secondaryDomains: decode<string[]>(member.secondaryDomains, []),
        domainSpecialty: decode<string[]>(member.domainSpecialty, []),
        mentoringTypes: decode<string[]>(member.mentoringTypes, []),
        tags: decode<string[]>(member.tags, []),
        customTags: decode<string[]>(member.customTags, []),
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

/** PATCH /api/members/[id] — update statuses / note (admin-only). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Opérateur requis.");
    }
    // CSRF protection
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }
    // Anti-abus : 20 mises à jour par IP toutes les 10 minutes.
    const rlPatch = await rateLimit(`admin-member-write:${rateKey(req)}`, {
      capacity: 20,
      windowMs: 600000, // 10 minutes
    });
    if (!rlPatch.ok) {
      throw new RateLimitError(
        "Trop de requêtes. Réessaie dans quelques minutes.",
        rlPatch.retryAfterMs,
      );
    }
    const { id } = await params;
    const body = (await parseJsonBody(req)) as Record<string, unknown>;

    const data: Prisma.MemberUpdateInput = {};
    if (typeof body.profileStatus === "string") {
      if (!VALID_PROFILE_STATUS.has(body.profileStatus))
        throw new ValidationError("profileStatus invalide.");
      data.profileStatus = body.profileStatus;
      // Auto-cascade: approving → invite to community.
      if (body.profileStatus === "APPROVED" && body.communityStatus === undefined)
        data.communityStatus = "INVITED";
    }
    if (typeof body.communityStatus === "string") {
      if (!VALID_COMMUNITY_STATUS.has(body.communityStatus))
        throw new ValidationError("communityStatus invalide.");
      data.communityStatus = body.communityStatus;
    }
    if (typeof body.adminNote === "string") data.adminNote = body.adminNote;
    // Tags libres (#102, operator uniquement — même garde-fous que le reste
    // du PATCH : requireAdminRole + CSRF + rate-limit ci-dessus). Écrit la
    // colonne customTags SANS toucher aux tags auto (`tags`, système).
    if (body.customTags !== undefined) {
      const checked = validateCustomTags(body.customTags);
      if (!checked.ok) throw new ValidationError(checked.error);
      data.customTags = JSON.stringify(checked.tags);
    }
    if (typeof body.accessLane === "string") {
      const lane = normalizeAccessLane(body.accessLane);
      if (lane !== "immediate" && lane !== "pending")
        throw new ValidationError("accessLane invalide.");
      data.accessLane = lane;
    }

    // Charger le member AVANT l'update pour comparer le statut (anti-doublon
    // + détection d'un vrai changement de statut).
    const before = await db.member.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        profileStatus: true,
        profileArchetype: true,
        deletedAt: true,
      },
    });
    if (!before || before.deletedAt) {
      throw new NotFoundError("Membre introuvable.");
    }

    const statusTransition =
      typeof data.profileStatus === "string" &&
      data.profileStatus !== before.profileStatus
        ? { from: before.profileStatus, to: data.profileStatus as string }
        : null;
    if (statusTransition?.to === "APPROVED") {
      data.approvedAt = new Date();
    }

    const updated = await db.member.update({ where: { id }, data });

    // Notification email si le statut a changé vers un statut "terminal"
    // (APPROVED / WAITLIST / REJECTED). On n'envoie pas pour PENDING car
    // c'est l'état initial / un retour en arrière. Anti-doublon via
    // EmailEvent lookup.
    const newStatus = (data.profileStatus as string | undefined) ?? updated.profileStatus;
    const oldStatus = before.profileStatus;
    if (
      newStatus !== oldStatus &&
      (newStatus === "APPROVED" ||
        newStatus === "WAITLIST" ||
        newStatus === "REJECTED")
    ) {
      void notifyStatusChange({
        memberId: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        oldStatus,
        newStatus: newStatus as StatusChangeType,
        archetype: updated.profileArchetype,
      });
    }

    // Audit isolé : ne casse jamais la réponse si l'audit échoue.
    try {
      await db.analyticsEvent.create({
        data: toServerEventData({
          type: "admin_member_update",
          ref: `member.update:${id}`,
        }),
      });
    } catch {
      /* ignore */
    }
    if (statusTransition) {
      const role = (await getAdminRole(req)) ?? "operator";
      void audit(
        "member.status-change",
        "member",
        id,
        { from: statusTransition.from, to: statusTransition.to },
        { type: "admin", role },
      );
    }
    return NextResponse.json({ member: updated });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return errorToResponse(new NotFoundError("Membre introuvable."));
    }
    return errorToResponse(err);
  }
}

/** DELETE /api/members/[id] — permanently delete a member (admin-only). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Opérateur requis.");
    }
    // CSRF protection
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }
    // Anti-abus : 20 suppressions par IP toutes les 10 minutes.
    const rlDelete = await rateLimit(`admin-member-delete:${rateKey(req)}`, {
      capacity: 20,
      windowMs: 600000, // 10 minutes
    });
    if (!rlDelete.ok) {
      throw new RateLimitError(
        "Trop de requêtes. Réessaie dans quelques minutes.",
        rlDelete.retryAfterMs,
      );
    }

    const { id } = await params;
    const member = await db.member.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!member) {
      throw new NotFoundError("Membre introuvable.");
    }
    // Soft delete : on marque le membre plutôt que de le supprimer (RGPD :
    // les données restent récupérables tant que deletedAt est nul).
    await db.member.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    // Auto-add email à la blacklist (l'admin doit explicitement activer
    // ce comportement dans /admin/settings — default: off, opt-in).
    // Pour cette première version, on l'active par défaut.
    try {
      await addToBlacklist({
        email: member.email,
        reason: "admin",
        note: `Auto-blocked après soft-delete de ${id} (${new Date().toISOString()})`,
        autoAdded: true,
      });
    } catch (blErr) {
      console.warn("[soft-delete] failed to add to blacklist:", blErr);
    }
    await audit("member.soft-delete", "member", id, { soft: true });
    // Record an audit event (member-less, ref carries the action — memberId, pas
    // d'email en clair). RGPD : les lignes analytics historiques existantes
    // contenant encore des emails doivent être purgées manuellement en base.
    try {
      await db.analyticsEvent.create({
        data: toServerEventData({
          type: "community_cta_clicked",
          ref: `admin-delete:${id}`,
        }),
      });
    } catch {
      /* ignore */
    }
    return NextResponse.json({ ok: true, deleted: id });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return errorToResponse(new NotFoundError("Membre introuvable."));
    }
    return errorToResponse(err);
  }
}

/**
 * Notifie le membre d'un changement de statut (APPROVED / WAITLIST / REJECTED).
 * - Fire-and-forget (void) : ne casse jamais le PATCH si l'email échoue.
 * - Anti-doublon : si on a déjà envoyé un email de status_change pour ce
 *   membre dans la dernière heure, on n'envoie pas (l'admin peut avoir
 *   cliqué 2x sur le bouton "Approuver").
 * - Tracking : un event analytics "status_change_email_sent" est créé,
 *   et l'email est tracé via EmailEvent par sendStatusChangeEmail (qui
 *   appelle trackEmailSent en interne).
 */
async function notifyStatusChange(args: {
  memberId: string;
  email: string;
  firstName: string;
  oldStatus: string;
  newStatus: StatusChangeType;
  archetype: string | null;
}): Promise<void> {
  try {
    // Anti-doublon : regarde si on a déjà envoyé un status_change pour ce
    // membre dans la dernière heure.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSent = await db.emailEvent.findFirst({
      where: {
        memberId: args.memberId,
        category: "status_change",
        type: "email.sent",
        createdAt: { gte: oneHourAgo },
      },
      select: { id: true },
    });
    if (recentSent) {
      return;
    }

    // Envoi (sendEmail ne throw pas dans le pattern actuel)
    const result = await sendStatusChangeEmail({
      to: args.email,
      firstName: args.firstName,
      newStatus: args.newStatus,
      archetypeLabel: args.archetype,
    });

    // Event analytics (fire-and-forget)
    try {
      await db.analyticsEvent.create({
        data: toServerEventData({
          type: "status_change_email_sent",
          memberId: args.memberId,
          ref: `status:${args.newStatus}`,
          value: result.ok ? 1 : 0,
        }),
      });
    } catch {
      /* ignore */
    }
  } catch (err) {
    // On ne remonte JAMAIS cette erreur au PATCH : l'admin a déjà eu sa
    // réponse 200, le membre sera notifié par un autre canal (WhatsApp).
    console.error("[notifyStatusChange] failed:", err);
  }
}