import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  isAdminAuthed,
  requireAdminRole,
  getAdminRole,
  getAdminIdentity,
  checkCSRF,
} from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  AuthError,
  errorToResponse,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

/** Bornes du contenu — miroir dans tests/member-notes.test.cjs. */
const NOTE_CONTENT_MAX = 2000;

const noteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Le contenu de la note est requis.")
    .max(NOTE_CONTENT_MAX, "Note trop longue (max 2000 caractères)."),
});

/** GET /api/members/[id]/notes — liste des notes datées, createdAt desc (admin-only, viewer inclus). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdminAuthed(req))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }
    const { id } = await params;
    const member = await db.member.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!member) throw new NotFoundError("Membre introuvable.");
    const notes = await db.memberNote.findMany({
      where: { memberId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, author: true, content: true },
    });
    return NextResponse.json({ notes });
  } catch (err) {
    return errorToResponse(err);
  }
}

/** POST /api/members/[id]/notes — ajoute une note datée (operator-only). */
export async function POST(
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
    // Anti-abus : 20 notes par IP toutes les 10 minutes.
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
    const { id } = await params;
    const member = await db.member.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!member) throw new NotFoundError("Membre introuvable.");

    const body = await req.json().catch(() => null);
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Note invalide.",
        parsed.error.issues,
      );
    }
    const author = await getAdminIdentity(req);
    const note = await db.memberNote.create({
      data: { memberId: id, author, content: parsed.data.content },
      select: { id: true, createdAt: true, author: true, content: true },
    });

    // Audit isolé : ne casse jamais la réponse si l'audit échoue.
    const role = (await getAdminRole(req)) ?? "operator";
    void audit(
      "member.note-create",
      "member",
      id,
      { noteId: note.id, author },
      { type: "admin", role },
    );
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
