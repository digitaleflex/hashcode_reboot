import { NextRequest, NextResponse } from "next/server";
import { checkCSRF, requireAdminRole, getAdminIdentity } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
   * POST /api/admin/admins/[id]/reset-2fa — réinitialise la 2FA d'un admin
 * (téléphone perdu / nouvel appareil) et révoque ses sessions.
 *
 * Operator only. La 2FA est optionnelle : l'admin peut la réenroler
 * volontairement depuis /admin/settings ou /admin/setup-2fa — aucun
 * forçage au login. Les codes de secours sont invalidés au passage
 * (la ligne TwoFactor est supprimée).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  if (!(await requireAdminRole(req, "operator"))) {
    return NextResponse.json({ error: "FORBIDDEN", code: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const actor = await getAdminIdentity(req);

  try {
    const target = await db.adminUser.findUnique({
      where: { id },
      select: { id: true, email: true, twoFactorEnabled: true },
    });
    if (!target) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // 1. Nettoyage direct : suppression du secret TOTP + des codes de
    //    secours + reset du flag. (Le plugin two-factor Expose
    //    `/two-factor/disable` mais exige le mot de passe de l'admin —
    //    impossible ici : c'est justement parce qu'il a perdu son appareil.)
    await db.twoFactor.deleteMany({ where: { userId: id } });
    await db.adminUser.update({
      where: { id },
      data: { twoFactorEnabled: false },
    });

    // 2. Sessions révoquées : tout cookie en circulation meurt.
    await db.adminSession.deleteMany({ where: { userId: id } });

    await db.auditLog.create({
      data: {
        actor,
        action: "admin.reset-2fa",
        entityType: "admin_user",
        entityId: id,
        metadata: JSON.stringify({ email: target.email }),
      },
    });

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
