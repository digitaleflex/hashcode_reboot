import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAdminRole,
  getAdminRole,
  getAdminIdentity,
  checkCSRF,
} from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  errorToResponse,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
} from "@/lib/errors";

export const runtime = "nodejs";

/** DELETE /api/members/[id]/notes/[noteId] — supprime une note (operator-only). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
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
    const rl = await rateLimit(`admin-member-notes:${rateKey(req)}`, {
      capacity: 20,
      windowMs: 600000, // 10 minutes
    });
    if (!rl.ok) {
      throw new RateLimitError(
        "Trop de requêtes. Réessaie dans quelques minutes.",
        rl.retryAfterMs,
      );
    }
    const { id, noteId } = await params;
    const note = await db.memberNote.findUnique({
      where: { id: noteId },
      select: { id: true, memberId: true },
    });
    // 404 si la note n'existe pas OU appartient à un autre membre (pas de
    // leak inter-membres : on ne distingue pas les deux cas).
    if (!note || note.memberId !== id) {
      throw new NotFoundError("Note introuvable.");
    }
    await db.memberNote.delete({ where: { id: noteId } });

    // Audit isolé : ne casse jamais la réponse si l'audit échoue.
    const role = (await getAdminRole(req)) ?? "operator";
    const author = await getAdminIdentity(req);
    void audit(
      "member.note-delete",
      "member",
      id,
      { noteId, author },
      { type: "admin", role },
    );
    return NextResponse.json({ ok: true, deleted: noteId });
  } catch (err) {
    return errorToResponse(err);
  }
}
