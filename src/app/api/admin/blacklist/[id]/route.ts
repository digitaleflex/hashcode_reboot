import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkCSRF, requireAdmin, adminGuardResponse } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/admin-audit";
import { removeFromBlacklist } from "@/lib/blacklist";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/blacklist/[id]
 * Body: { note?, expiresAt? }
 * Modifie la note ou l'expiration d'une entrée de blacklist.
 */
const patchSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null)),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const adminGuard = await requireAdmin(req, "operator");
  if (!adminGuard.ok) return adminGuardResponse(adminGuard);
  if (!checkCSRF(req)) {
    throw new ForbiddenError("Jeton CSRF invalide.");
  }
  const { id } = await params;
  const body = await parseJsonBody(req);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Données invalides.");
  }

  try {
    const updated = await db.memberBlacklist.update({
      where: { id },
      data: {
        ...(parsed.data.note !== undefined && { note: parsed.data.note }),
        ...(parsed.data.expiresAt !== undefined && {
          expiresAt: parsed.data.expiresAt,
        }),
      },
    });
    await audit("blacklist.edit", "blacklist", id, {
      note: parsed.data.note,
      expiresAt: parsed.data.expiresAt,
    });
    return NextResponse.json({ ok: true, entry: updated });
  } catch {
    // D26 — ATTENTION : ce `catch` ne distingue pas « ligne absente » (P2025)
    // d'une panne de base. Les DEUX répondaient 404 avant, et c'est conservé :
    // changer ce statut serait un changement de contrat (cf. rapport D26).
    return errorToResponse(new NotFoundError("Entrée introuvable."));
  }
  } catch (err) {
    return errorToResponse(err);
  }
}

/**
 * DELETE /api/admin/blacklist/[id]
 * Retire l'email de la blacklist.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const adminGuard = await requireAdmin(req, "operator");
  if (!adminGuard.ok) return adminGuardResponse(adminGuard);
  if (!checkCSRF(req)) {
    throw new ForbiddenError("Jeton CSRF invalide.");
  }
  const { id } = await params;
  try {
    const entry = await db.memberBlacklist.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!entry) {
      throw new NotFoundError("Entrée introuvable.");
    }
    const outcome = await removeFromBlacklist(entry.email);
    if (!outcome.removed) {
      // `removeFromBlacklist` avale l'erreur et renvoie `{removed:false}`.
      // Sans ce test, la route répondait `{ok:true, removed}` alors que
      // l'entrée était toujours en base : l'admin voyait « supprimé » et
      // l'adresse restait blacklistée. Un 500 honnête vaut mieux qu'un 200
      // qui ment.
      throw new AppError(
        "Erreur lors de la suppression de l'entrée.",
        { status: 500, code: "INTERNAL" },
      );
    }
    await audit("blacklist.remove", "blacklist", id, { email: entry.email });
    return NextResponse.json({ ok: true, removed: entry.email });
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    // D26 — le 500 garde son message d'avant.
    throw new AppError("Erreur lors de la suppression.");
  }
  } catch (err) {
    return errorToResponse(err);
  }
}
