import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole, getAdminIdentity } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/admin/admins — liste des comptes admin (operator only).
 * Inclut les invitations en attente pour donner une vue complète de l'équipe.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminRole(req, "operator"))) {
    return NextResponse.json({ error: "FORBIDDEN", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const [admins, invitations] = await Promise.all([
      db.adminUser.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          banned: true,
          twoFactorEnabled: true,
          lastSignInAt: true,
          createdAt: true,
          createdBy: true,
          _count: { select: { sessions: true } },
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

    return NextResponse.json({
      ok: true,
      admins: admins.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        role: a.role,
        banned: a.banned,
        twoFactorEnabled: a.twoFactorEnabled,
        lastSignInAt: a.lastSignInAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
        createdBy: a.createdBy,
        activeSessions: a._count.sessions,
      })),
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

/** PATCH /api/admin/admins — change le rôle d'un admin. */
export async function PATCH(req: NextRequest) {
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

  const actor = await getAdminIdentity(req);

  try {
    const target = await db.adminUser.findUnique({
      where: { id: body.id },
      select: { id: true, email: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // Garde-fou : un operator ne peut pas se rétrograder lui-même s'il est
    // le dernier operator — sinon plus personne ne peut administrer.
    const operatorCount = await db.adminUser.count({ where: { role: "operator" } });
    const isSelf = target.email.toLowerCase() === actor.toLowerCase();
    if (target.role === "operator" && body.role === "viewer" && operatorCount <= 1) {
      return NextResponse.json(
        { error: "LAST_OPERATOR", code: "LAST_OPERATOR" },
        { status: 409 },
      );
    }
    void isSelf;

    await db.adminUser.update({
      where: { id: body.id },
      data: { role: body.role },
    });

    // Changement de rôle ⇒ sessions révoquées (le cookie en cache porterait
    // l'ancien rôle jusqu'à expiration — fail-closed immédiat).
    await db.adminSession.deleteMany({ where: { userId: body.id } });

    await db.auditLog.create({
      data: {
        actor,
        action: "admin.role-change",
        entityType: "admin_user",
        entityId: body.id,
        metadata: JSON.stringify({ from: target.role, to: body.role }),
      },
    });

    return NextResponse.json({ ok: true, id: body.id, role: body.role });
  } catch {
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

/** DELETE /api/admin/admins?id=xxx — révoque un accès admin. */
export async function DELETE(req: NextRequest) {
  if (!(await requireAdminRole(req, "operator"))) {
    return NextResponse.json({ error: "FORBIDDEN", code: "FORBIDDEN" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const actor = await getAdminIdentity(req);

  try {
    const target = await db.adminUser.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (target.email.toLowerCase() === actor.toLowerCase()) {
      return NextResponse.json(
        { error: "SELF_REVOKE", code: "SELF_REVOKE" },
        { status: 409 },
      );
    }

    const operatorCount = await db.adminUser.count({ where: { role: "operator" } });
    if (target.role === "operator" && operatorCount <= 1) {
      return NextResponse.json({ error: "LAST_OPERATOR", code: "LAST_OPERATOR" }, { status: 409 });
    }

    await db.adminUser.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        actor,
        action: "admin.revoke",
        entityType: "admin_user",
        entityId: id,
        metadata: JSON.stringify({ email: target.email, role: target.role }),
      },
    });

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
