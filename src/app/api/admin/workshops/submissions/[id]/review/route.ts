import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole, checkCSRF, getAdminIdentity } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { REVIEW_DECISIONS } from "@/lib/workshop-validation";
import { sendEmail } from "@/lib/mail";
import { reviewEmail } from "@/lib/workshop-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  feedback: z
    .string()
    .trim()
    .min(10, "Feedback requis (10 caractères minimum).")
    .max(2000, "Feedback trop long (max 2000 caractères)."),
});

/**
 * POST /api/admin/workshops/submissions/[id]/review — valider une soumission.
 *
 * AUTH   : admin operator + CSRF.
 * INPUT  : { decision: APPROVED | REVISION | REJECTED, feedback: string>=10 }.
 * OUTPUT : { ok: true, review, submission: { id, status, reviewedAt } }.
 * ERRORS : 400 JSON invalide, 403 accès/CSRF, 404 soumission introuvable,
 *          422 décision/feedback invalide, 429 rate limit (30/min/admin).
 *
 * Append-only : une nouvelle WorkshopReview est créée à chaque décision et le
 * statut de la soumission reflète la dernière review (le schéma le documente).
 * Une re-review est donc possible (ex. corriger un APPROVED trop rapide).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  if (!checkCSRF(req)) {
    return NextResponse.json(
      { error: "CSRF validation failed.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const reviewer = getAdminIdentity(req);
  const rl = await rateLimit(`admin-workshop-review:${reviewer}:${rateKey(req)}`, {
    capacity: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de revues. Réessaie dans une minute.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalide.", code: "INVALID_PAYLOAD" },
      { status: 400 },
    );
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Données invalides.",
        code: "INVALID_PAYLOAD",
      },
      { status: 422 },
    );
  }
  const { decision, feedback } = parsed.data;

  const existing = await db.workshopSubmission.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Soumission introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const reviewedAt = new Date();
  const { review, submission } = await db.$transaction(async (tx) => {
    const createdReview = await tx.workshopReview.create({
      data: {
        submissionId: id,
        reviewer,
        decision,
        feedback,
      },
      select: {
        id: true,
        reviewer: true,
        decision: true,
        feedback: true,
        createdAt: true,
      },
    });
    const updated = await tx.workshopSubmission.update({
      where: { id },
      data: { status: decision, reviewedAt },
      select: { id: true, status: true, reviewedAt: true },
    });
    return { review: createdReview, submission: updated };
  });

  await audit("workshop.submission-review", "workshop_submission", id, {
    decision,
    reviewer,
  });

  // Envoi email de notification au membre
  const submissionFull = await db.workshopSubmission.findUnique({
    where: { id },
    select: {
      member: { select: { email: true, firstName: true } },
      deliverable: {
        select: {
          title: true,
          session: {
            select: {
              week: {
                select: {
                  workshop: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (submissionFull?.member?.email && submissionFull.deliverable?.session?.week?.workshop) {
    const member = submissionFull.member;
    const deliverable = submissionFull.deliverable;
    const workshop = deliverable.session.week.workshop;

    const emailPayload = reviewEmail({
      memberName: member.firstName || "Membre",
      workshopTitle: workshop.title,
      deliverableTitle: deliverable.title,
      decision,
      feedback,
      submissionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://hashcode.reboot.com"}/dashboard/ateliers/${workshop.id}`,
    });

    await sendEmail({
      to: member.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      category: "transactional",
    });
  }

  return NextResponse.json({ ok: true, review, submission });
}
