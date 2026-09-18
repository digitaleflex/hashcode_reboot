import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { checkCSRF } from "@/lib/admin-auth";
import { rateLimit, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/workshops/[slug]/enroll — inscription du membre à un atelier.
 *
 * AUTH   : session membre obligatoire (401) + CSRF same-origin (défense
 *          en profondeur, cf. incident RSVP).
 * INPUT  : aucun (slug dans le chemin).
 * OUTPUT : { ok, enrollment: { workshopId, memberId, status, enrolledAt },
 *          already } — IDEMPOTENT : re-s'inscrire ne crée pas de doublon
 *          (contrainte unique [workshopId, memberId]) et réactive un
 *          enrollment "dropped".
 * ERRORS : 401 non authentifié, 403 CSRF, 404 inexistant ou non publié,
 *          429 rate limit.
 * GUARDS : blockIfTesting (aucune écriture en mode test).
 *
 * Écriture idempotente : POST répété sans effet de bord.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  // CSRF : même origine obligatoire (défense en profondeur sur SameSite=Lax).
  if (!checkCSRF(req)) {
    return NextResponse.json(
      { error: "CSRF validation failed." },
      { status: 403 },
    );
  }

  const rl = await rateLimit(`workshop-enroll:${session.member.id}`, {
    capacity: 5,
    windowMs: 600_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes." },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const { slug } = await params;
  const workshop = await db.workshop.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!workshop || workshop.status !== "published") {
    return NextResponse.json(
      { error: "Atelier introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const existing = await db.workshopEnrollment.findUnique({
    where: {
      workshopId_memberId: { workshopId: workshop.id, memberId: session.member.id },
    },
    select: { status: true },
  });
  const already = existing?.status === "active";

  const enrollment = await db.workshopEnrollment.upsert({
    where: {
      workshopId_memberId: { workshopId: workshop.id, memberId: session.member.id },
    },
    update: { status: "active" },
    create: {
      workshopId: workshop.id,
      memberId: session.member.id,
      status: "active",
    },
    select: {
      workshopId: true,
      memberId: true,
      status: true,
      enrolledAt: true,
    },
  });

  return NextResponse.json({ ok: true, enrollment, already });
}
