import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdminAuthed, requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { sendStatusChangeEmail, type StatusChangeType } from "@/lib/mail";

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

/** GET /api/members/[id] — full member detail (admin-only). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  try {
    const { id } = await params;
    const member = await db.member.findUnique({ where: { id } });
    if (!member)
      return NextResponse.json(
        { error: "Membre introuvable.", code: "NOT_FOUND" },
        { status: 404 },
      );

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
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

/** PATCH /api/members/[id] — update statuses / note (admin-only). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Opérateur requis.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  // Anti-abus : 20 mises à jour par IP toutes les 10 minutes.
  const rlPatch = await rateLimit(`admin-member-write:${rateKey(req)}`, {
    capacity: 20,
    windowMs: 600000, // 10 minutes
  });
  if (!rlPatch.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterHeader(rlPatch.retryAfterMs),
        },
      },
    );
  }
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "JSON invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const data: Prisma.MemberUpdateInput = {};
  if (typeof body.profileStatus === "string") {
    if (!VALID_PROFILE_STATUS.has(body.profileStatus))
      return NextResponse.json(
        { error: "profileStatus invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    data.profileStatus = body.profileStatus;
    // Auto-cascade: approving → invite to community.
    if (body.profileStatus === "APPROVED" && body.communityStatus === undefined)
      data.communityStatus = "INVITED";
  }
  if (typeof body.communityStatus === "string") {
    if (!VALID_COMMUNITY_STATUS.has(body.communityStatus))
      return NextResponse.json(
        { error: "communityStatus invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    data.communityStatus = body.communityStatus;
  }
  if (typeof body.adminNote === "string") data.adminNote = body.adminNote;
  if (typeof body.accessLane === "string") {
    if (body.accessLane !== "immediate" && body.accessLane !== "pending")
      return NextResponse.json(
        { error: "accessLane invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    data.accessLane = body.accessLane;
  }

  try {
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
      return NextResponse.json(
        { error: "Membre introuvable.", code: "NOT_FOUND" },
        { status: 404 },
      );
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
        data: {
          type: "admin_member_update",
          ref: `member.update:${id}`,
        },
      });
    } catch {
      /* ignore */
    }
    return NextResponse.json({ member: updated });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Membre introuvable.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

/** DELETE /api/members/[id] — permanently delete a member (admin-only). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Opérateur requis.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  // Anti-abus : 20 suppressions par IP toutes les 10 minutes.
  const rlDelete = await rateLimit(`admin-member-delete:${rateKey(req)}`, {
    capacity: 20,
    windowMs: 600000, // 10 minutes
  });
  if (!rlDelete.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterHeader(rlDelete.retryAfterMs),
        },
      },
    );
  }
  try {
    const { id } = await params;
    const member = await db.member.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json(
        { error: "Membre introuvable.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    // Soft delete : on marque le membre plutôt que de le supprimer (RGPD :
    // les données restent récupérables tant que deletedAt est nul).
    await db.member.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await audit("member.soft-delete", "member", id, { soft: true });
    // Record an audit event (member-less, ref carries the action — memberId, pas
    // d'email en clair). RGPD : les lignes analytics historiques existantes
    // contenant encore des emails doivent être purgées manuellement en base.
    try {
      await db.analyticsEvent.create({
        data: {
          type: "community_cta_clicked",
          ref: `admin-delete:${id}`,
        },
      });
    } catch {
      /* ignore */
    }
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Membre introuvable.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
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
        data: {
          type: "status_change_email_sent",
          memberId: args.memberId,
          ref: `status:${args.newStatus}`,
          value: result.ok ? 1 : 0,
        },
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
