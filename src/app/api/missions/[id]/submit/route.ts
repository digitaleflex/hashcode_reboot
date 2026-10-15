import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { checkCSRF } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import {
  canTransitionAssignment,
  nextAttempt,
} from "@/lib/missions/engine";
import {
  AppError,
  AuthError,
  ForbiddenError,
  errorToResponse,
  NotFoundError,
  parseJsonBody,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const submitSchema = z.object({
  content: z.string().trim().min(1, "Contenu requis.").max(20000),
});

/**
 * POST /api/missions/[id]/submit — soumettre une réalisation (#232-c).
 * Exige une assignation ouverte (démarrer d'abord). Une soumission
 * PENDING/IN_REVIEW en cours → 409 (attendre la revue ; anti-double-clic).
 * Sinon nouvel attempt (max+1), assignation → SUBMITTED.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    const tooLarge = bodyLimit(req);
    if (tooLarge) return tooLarge;

    const rl = await rateLimit(`mission-submit:${rateKey(req)}`, {
      capacity: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
      );
    }

    const session = await getSession(req);
    if (!session) throw new AuthError("Non authentifié.", "UNAUTHENTICATED");

    // CSRF : même origine obligatoire (#233).
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }

    const body = await parseJsonBody(req);
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Contenu invalide.", parsed.error.issues);
    }

    const { id } = await params;
    const mission = await db.mission.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!mission || mission.status !== "PUBLISHED") {
      throw new NotFoundError("Mission introuvable.");
    }

    const assignment = await db.missionAssignment.findFirst({
      where: {
        missionId: id,
        memberId: session.member.id,
        status: { in: ["ACTIVE", "REJECTED", "SUBMITTED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!assignment) {
      throw new AppError("Démarre la mission avant de soumettre.", {
        status: 422,
        code: "START_FIRST",
      });
    }
    const existing = await db.missionSubmission.findMany({
      where: { missionId: id, memberId: session.member.id },
      select: { attempt: true, status: true },
    });
    // Anti-double-clic d'abord : une revue en cours bloque toute resoumission.
    if (existing.some((s) => s.status === "PENDING" || s.status === "IN_REVIEW")) {
      throw new AppError("Une soumission est déjà en cours de revue.", {
        status: 409,
        code: "ALREADY_SUBMITTED",
      });
    }
    if (!canTransitionAssignment(
      assignment.status as "ACTIVE" | "REJECTED" | "SUBMITTED",
      "SUBMITTED",
    )) {
      throw new AppError("Soumission impossible dans cet état.", {
        status: 409,
        code: "INVALID_STATE",
      });
    }

    const attempt = nextAttempt(existing.map((s) => s.attempt));
    const [submission] = await db.$transaction([
      db.missionSubmission.create({
        data: {
          missionId: id,
          memberId: session.member.id,
          assignmentId: assignment.id,
          attempt,
          content: parsed.data.content,
          status: "PENDING",
          submittedAt: new Date(),
        },
      }),
      db.missionAssignment.update({
        where: { id: assignment.id },
        data: { status: "SUBMITTED" },
      }),
    ]);
    return NextResponse.json({ submission, attempt }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
