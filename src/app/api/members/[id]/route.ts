import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";

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
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  // Anti-abus : 20 mises à jour par IP toutes les 10 minutes.
  const rlPatch = rateLimit(`admin-member-write:${rateKey(req)}`, {
    capacity: 20,
    refillPerSec: 1 / 30,
  });
  if (!rlPatch.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rlPatch.retryAfterMs / 1000)),
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
    const updated = await db.member.update({ where: { id }, data });
    // Audit isolé : ne casse jamais la réponse si l'audit échoue.
    try {
      await db.analyticsEvent.create({
        data: {
          type: "community_cta_clicked",
          ref: `admin-patch:${id}`,
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
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  // Anti-abus : 20 suppressions par IP toutes les 10 minutes.
  const rlDelete = rateLimit(`admin-member-delete:${rateKey(req)}`, {
    capacity: 20,
    refillPerSec: 1 / 30,
  });
  if (!rlDelete.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rlDelete.retryAfterMs / 1000)),
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
    // Cascade: delete the member's analytics events referencing them — atomique.
    await db.$transaction([
      db.analyticsEvent.deleteMany({ where: { memberId: id } }),
      db.member.delete({ where: { id } }),
    ]);
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
