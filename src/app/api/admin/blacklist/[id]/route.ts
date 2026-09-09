import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole, checkCSRF } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/admin-audit";
import { removeFromBlacklist } from "@/lib/blacklist";

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
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (!checkCSRF(req)) {
    return NextResponse.json(
      { error: "Jeton CSRF invalide." },
      { status: 403 },
    );
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides." },
      { status: 422 },
    );
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
    return NextResponse.json(
      { error: "Entrée introuvable." },
      { status: 404 },
    );
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
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (!checkCSRF(req)) {
    return NextResponse.json(
      { error: "Jeton CSRF invalide." },
      { status: 403 },
    );
  }
  const { id } = await params;
  try {
    const entry = await db.memberBlacklist.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!entry) {
      return NextResponse.json(
        { error: "Entrée introuvable." },
        { status: 404 },
      );
    }
    await removeFromBlacklist(entry.email);
    await audit("blacklist.remove", "blacklist", id, { email: entry.email });
    return NextResponse.json({ ok: true, removed: entry.email });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la suppression." },
      { status: 500 },
    );
  }
}
