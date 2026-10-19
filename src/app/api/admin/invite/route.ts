import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkCSRF, getAdminIdentity, requireAdminRole } from "@/lib/admin-auth";
import { canChangeAdminRole, normalizeAdminRole } from "@/lib/admin-roles";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(["operator", "viewer"]).default("viewer"),
});

/**
 * DELETE /api/admin/invite?email=xxx — annule une invitation en attente.
 * Operator only.
 *
 * Conservé pour purger les `AdminInvitation` créées par l'ancien flux
 * (avant la migration vers `Member.adminRole`). Plus aucune invitation n'est
 * créée : POST accorde désormais directement le rôle à un membre.
 */
export async function DELETE(req: NextRequest) {
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  if (!(await requireAdminRole(req, "operator"))) {
    return NextResponse.json({ error: "FORBIDDEN", code: "FORBIDDEN" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const actor = await getAdminIdentity(req);
    await db.adminInvitation.deleteMany({ where: { email } });
    await db.auditLog.create({
      data: {
        actor,
        action: "admin.invite-revoke",
        entityType: "admin_invitation",
        entityId: email,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

/**
 * POST /api/admin/invite — accorde l'accès admin à un MEMBRE existant.
 *
 * Source de vérité UNIQUE de l'accès : `Member.adminRole` (cf.
 * lib/admin-auth.ts). L'email ciblé doit correspondre à un compte membre —
 * l'espace admin s'ouvre par la session membre, un `AdminUser` n'y donne
 * aucun droit. C'est pour ça que l'ancien flux (invitation → /admin/setup →
 * AdminUser) ne donnait pas d'accès réel.
 *
 * S'il n'existe pas de membre pour cet email, on refuse (409 `NO_MEMBER`) :
 * la personne doit d'abord créer son compte membre (connexion par email) ;
 * l'opérateur accorde l'accès ensuite.
 *
 * Idempotent quand le rôle demandé est déjà le rôle courant. Les garde-fous
 * de rétrogradation (dernier operator) s'appliquent, comme dans PATCH
 * /api/admin/admins. Aucun email n'est envoyé. Auditée.
 */
export async function POST(req: NextRequest) {
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  if (!(await requireAdminRole(req, "operator"))) {
    return NextResponse.json({ error: "FORBIDDEN", code: "FORBIDDEN" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const role = parsed.data.role;

  try {
    const member = await db.member.findUnique({
      where: { email },
      select: { id: true, email: true, adminRole: true, deletedAt: true },
    });
    if (!member || member.deletedAt) {
      return NextResponse.json(
        { error: "NO_MEMBER", code: "NO_MEMBER" },
        { status: 409 },
      );
    }

    const currentRole = normalizeAdminRole(member.adminRole);
    if (currentRole === role) {
      return NextResponse.json({
        ok: true,
        id: member.id,
        email: member.email,
        role,
      });
    }

    const actor = await getAdminIdentity(req);

    // Rétrogradation operator → viewer : le dernier operator est protégé.
    if (currentRole) {
      const operatorCount = await db.member.count({
        where: { adminRole: "operator", deletedAt: null },
      });
      const guard = canChangeAdminRole({
        targetEmail: member.email,
        from: currentRole,
        to: role,
        actorEmail: actor,
        operatorCount,
      });
      if (!guard.ok) {
        return NextResponse.json(
          { error: guard.reason, code: guard.reason },
          { status: 409 },
        );
      }
    }

    await db.member.update({
      where: { id: member.id },
      data: { adminRole: role },
    });

    await db.auditLog.create({
      data: {
        actor,
        action: currentRole ? "admin.role-change" : "admin.invite",
        entityType: "member",
        entityId: member.id,
        metadata: JSON.stringify({
          email: member.email,
          from: currentRole,
          to: role,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      id: member.id,
      email: member.email,
      role,
    });
  } catch (e) {
    console.error("[admin/invite] failed:", e);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
