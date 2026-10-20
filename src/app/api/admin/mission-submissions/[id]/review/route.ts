import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole, getAdminIdentity, checkCSRF } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { reviewDecisionSchema } from "@/lib/missions/types";
import {
  applyReview,
  canTransitionAssignment,
  canTransitionSubmission,
} from "@/lib/missions/engine";
import {
  AppError,
  errorToResponse,
  ForbiddenError,
  NotFoundError,
  parseJsonBody,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";
import type { AssignmentStatus, SubmissionStatus } from "@/lib/missions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const reviewSchema = z.object({
  decision: reviewDecisionSchema,
  feedback: z.string().trim().min(1).max(2000),
});

/**
 * POST /api/admin/mission-submissions/[id]/review — revue (opérateurs).
 * Soumission PENDING/IN_REVIEW → décision (moteur) → soumission + revue
 * append-only + assignation synchronisée (VALIDATED horodatée / ACTIVE /
 * REJECTED). Toute l'opération est atomique : pas d'état à moitié écrit.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    // CSRF : même garde que les autres écritures admin (origine = hôte).
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    const tooLarge = bodyLimit(req);
    if (tooLarge) return tooLarge;

    const rl = await rateLimit(`admin-mission-review:${rateKey(req)}`, {
      capacity: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const body = await parseJsonBody(req);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Décision invalide.", parsed.error.issues);
    }

    const { id } = await params;
    const submission = await db.missionSubmission.findUnique({
      where: { id },
      include: { mission: { select: { id: true, slug: true } } },
    });
    if (!submission) throw new NotFoundError("Soumission introuvable.");

    const from = submission.status as SubmissionStatus;
    const outcome = applyReview(from, parsed.data.decision);
    if (!canTransitionSubmission(from, outcome.submissionStatus)) {
      throw new AppError("Soumission déjà jugée (resoumettre = nouvel attempt).", {
        status: 409,
        code: "ALREADY_REVIEWED",
      });
    }

    const assignment = await db.missionAssignment.findFirst({
      where: {
        missionId: submission.missionId,
        memberId: submission.memberId,
        status: "SUBMITTED",
      },
      orderBy: { createdAt: "desc" },
    });
    if (!assignment) {
      throw new AppError("Assignation non en revue.", {
        status: 409,
        code: "INVALID_STATE",
      });
    }
    if (
      !canTransitionAssignment(
        assignment.status as AssignmentStatus,
        outcome.assignmentStatus,
      )
    ) {
      throw new AppError("Transition d'assignation interdite.", {
        status: 409,
        code: "INVALID_TRANSITION",
      });
    }

    const reviewer = await getAdminIdentity(req);
    const now = new Date();
    const [updated, review] = await db.$transaction([
      db.missionSubmission.update({
        where: { id },
        data: { status: outcome.submissionStatus, reviewedAt: now },
      }),
      db.missionReview.create({
        data: {
          submissionId: id,
          reviewer,
          decision: parsed.data.decision,
          feedback: parsed.data.feedback,
        },
      }),
      db.missionAssignment.update({
        where: { id: assignment.id },
        data: {
          status: outcome.assignmentStatus,
          ...(outcome.validated ? { validatedAt: now } : {}),
        },
      }),
    ]);
    await audit("mission.review", "missionSubmission", id, {
      mission: submission.mission.slug,
      decision: parsed.data.decision,
      by: reviewer,
    });
    return NextResponse.json({ submission: updated, review });
  } catch (err) {
    return errorToResponse(err);
  }
}
