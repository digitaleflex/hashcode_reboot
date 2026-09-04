import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

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
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member)
    return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });

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
}

/** PATCH /api/members/[id] — update statuses / note (admin-only). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const data: Prisma.MemberUpdateInput = {};
  if (typeof body.profileStatus === "string") {
    if (!VALID_PROFILE_STATUS.has(body.profileStatus))
      return NextResponse.json(
        { error: "profileStatus invalide." },
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
        { error: "communityStatus invalide." },
        { status: 422 },
      );
    data.communityStatus = body.communityStatus;
  }
  if (typeof body.adminNote === "string") data.adminNote = body.adminNote;
  if (typeof body.accessLane === "string") {
    if (body.accessLane === "immediate" || body.accessLane === "pending")
      data.accessLane = body.accessLane;
  }

  const updated = await db.member.update({ where: { id }, data });
  return NextResponse.json({ member: updated });
}

/** DELETE /api/members/[id] — permanently delete a member (admin-only). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;
  const member = await db.member.findUnique({
    where: { id },
    select: { id: true, firstName: true, email: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  }
  // Cascade: delete the member's analytics events referencing them.
  await db.analyticsEvent.deleteMany({ where: { memberId: id } });
  await db.member.delete({ where: { id } });
  // Record an audit event (member-less, ref carries the action).
  try {
    await db.analyticsEvent.create({
      data: {
        type: "community_cta_clicked",
        ref: `admin-delete:${member.email}`,
      },
    });
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true, deleted: id });
}
