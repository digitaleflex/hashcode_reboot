import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole, getAdminIdentity, checkCSRF } from "@/lib/admin-auth";
import { canChangeAdminRole, canRevokeAdmin, normalizeAdminRole } from "@/lib/admin-roles";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Comptes admin = membres dont `Member.adminRole` est posé.
 *
 * C'est la source de vérité UNIQUE de l'accès (cf. lib/admin-auth.ts). Ces
 * routes lisaient/écrivaient auparavant la table dépréciée `AdminUser` :
 * « révoquer » depuis /admin/settings répondait ok sans retirer l'accès
 * réel. Elles opèrent désormais sur `Member.adminRole`, avec les mêmes
 * garde-fous que PATCH /api/members/[id] (auto-révocation, dernier operator).
 */

/**
 * GET /api/admin/admins — liste des comptes admin (operator only).
 * Inclut les invitations en attente pour donner une vue complète de l'équipe.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminRole(req, "operator"))) {
    return NextResponse.json({ error: "FORBIDDEN", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const [members, invitations] = await Promise.all([
      db.member.findMany({
        where: { adminRole: { not: null }, deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          adminRole: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      db.adminInvitation.findMany({
        where: { acceptedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          expiresAt: true,
          invitedBy: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }],
      }),
    ]);

    // Sessions Better Auth actives + dernière connexion, par email.
    const emails = members.map((m) => m.email.toLowerCase());
    const users = emails.length
      ? await db.user.findMany({
          where: { email: { in: emails } },
          select: {
            email: true,
            sessions: {
              where: { expiresAt: { gt: new Date() } },
              select: { createdAt: true },
              orderBy: { createdAt: "desc" },
            },
          },
        })
      : [];
    const sessionsByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.sessions]));

    const admins = members.flatMap((m) => {
      const role = normalizeAdminRole(m.adminRole);
      if (!role) return [];
      const sessions = sessionsByEmail.get(m.email.toLowerCase()) ?? [];
      return [
        {
          id: m.id,
          email: m.email,
          name: m.firstName || null,
          role,
          banned: false,
          twoFactorEnabled: false,
          lastSignInAt: sessions[0]?.createdAt.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
          createdBy: null,
          activeSessions: sessions.length,
        },
      ];
    });

    return NextResponse.json({
      ok: true,
      admins,
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        name: i.name,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
        invitedBy: i.invitedBy,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

/** POST /api/admin/admins — crée une invitation (délègue à /api/admin/invite). */
export async function POST(req: NextRequest) {
  // Même garde et même comportement que la route dédiée — on réutilise.
  const { POST: invite } = await import("@/app/api/admin/invite/route");
  return invite(req);
}

/** PATCH /api/admin/admins — change le rôle d'un admin (Member.adminRole). */
export async function PATCH(req: NextRequest) {
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  if (!(await requireAdminRole(req, "operator"))) {
    return NextResponse.json({ error: "FORBIDDEN", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    role?: string;
  } | null;

  if (!body?.id || (body.role !== "operator" && body.role !== "viewer")) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const nextRole = body.role;

  const actor = await getAdminIdentity(req);

  try {
    const target = await db.member.findUnique({
      where: { id: body.id },
      select: { id: true, email: true, adminRole: true, deletedAt: true },
    });
    const currentRole = normalizeAdminRole(target?.adminRole);
    if (!target || target.deletedAt || !currentRole) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (currentRole === nextRole) {
      return NextResponse.json({ ok: true, id: target.id, role: nextRole });
    }

    // Même règle que PATCH /api/members/[id] : on ne modifie pas son propre rôle.
    if (target.email.toLowerCase() === actor.toLowerCase()) {
      return NextResponse.json({ error: "SELF_REVOKE", code: "SELF_REVOKE" }, { status: 409 });
    }

    const operatorCount = await db.member.count({
      where: { adminRole: "operator", deletedAt: null },
    });
    const guard = canChangeAdminRole({
      targetEmail: target.email,
      from: currentRole,
      to: nextRole,
      actorEmail: actor,
      operatorCount,
    });
    if (!guard.ok) {
      return NextResponse.json({ error: guard.reason, code: guard.reason }, { status: 409 });
    }

    await db.member.update({
      where: { id: target.id },
      data: { adminRole: nextRole },
    });

    await db.auditLog.create({
      data: {
        actor,
        action: "admin.role-change",
        entityType: "member",
        entityId: target.id,
        metadata: JSON.stringify({ from: currentRole, to: nextRole }),
      },
    });

    return NextResponse.json({ ok: true, id: target.id, role: nextRole });
  } catch {
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

/** DELETE /api/admin/admins?id=xxx — révoque un accès admin (Member.adminRole = null). */
export async function DELETE(req: NextRequest) {
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  if (!(await requireAdminRole(req, "operator"))) {
    return NextResponse.json({ error: "FORBIDDEN", code: "FORBIDDEN" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const actor = await getAdminIdentity(req);

  try {
    const target = await db.member.findUnique({
      where: { id },
      select: { id: true, email: true, adminRole: true, deletedAt: true },
    });
    const currentRole = normalizeAdminRole(target?.adminRole);
    if (!target || target.deletedAt || !currentRole) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const operatorCount = await db.member.count({
      where: { adminRole: "operator", deletedAt: null },
    });
    const guard = canRevokeAdmin({
      targetEmail: target.email,
      targetRole: currentRole,
      actorEmail: actor,
      operatorCount,
    });
    if (!guard.ok) {
      return NextResponse.json({ error: guard.reason, code: guard.reason }, { status: 409 });
    }

    // Le membre garde son compte : seul l'accès admin est retiré. Le rôle est
    // relu en base à chaque requête admin, l'effet est donc immédiat.
    await db.member.update({
      where: { id: target.id },
      data: { adminRole: null },
    });

    await db.auditLog.create({
      data: {
        actor,
        action: "admin.revoke",
        entityType: "member",
        entityId: target.id,
        metadata: JSON.stringify({ email: target.email, role: currentRole }),
      },
    });

    return NextResponse.json({ ok: true, id: target.id });
  } catch {
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
