import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole, checkCSRF } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { db } from "@/lib/db";

/**
 * DELETE /api/admin/keys/[kid] — revoke a specific admin key.
 * Requires operator role + CSRF.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ kid: string }> },
) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }

  const { kid } = await params;

  try {
    const key = await db.adminKey.findUnique({ where: { kid } });
    if (!key) {
      return NextResponse.json({ error: "Clé introuvable." }, { status: 404 });
    }
    if (key.revokedAt) {
      return NextResponse.json({ error: "Clé déjà révoquée." }, { status: 409 });
    }

    await db.adminKey.update({
      where: { kid },
      data: { revokedAt: new Date() },
    });

    await audit("admin.key-revoke", "admin_key", kid);

    return NextResponse.json({ ok: true, kid });
  } catch {
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
