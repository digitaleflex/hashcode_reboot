import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { checkCSRF, getAdminIdentity, requireAdminRole } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { sendAdminInvitationEmail } from "@/lib/email/builders";

export const runtime = "nodejs";

/** Durée de validité d'une invitation : 7 jours. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const bodySchema = z.object({
  email: z.string().email().max(320),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["operator", "viewer"]).default("viewer"),
});

/**
 * DELETE /api/admin/invite?email=xxx — annule une invitation en attente.
 * Operator only.
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
 * POST /api/admin/invite — invite un nouvel admin (operator only).
 *
 * Crée une `AdminInvitation` (jeton aléatoire 32 bytes, seul son SHA-256 est
 * stocké) et envoie l'email avec le lien vers /admin/setup. La création du
 * compte lui-même est faite par Better Auth (sign-up), qui refuse tout email
 * sans invitation valide (hook databaseHooks.user.create).
 *
 * Si une invitation en cours existe déjà pour l'email, elle est remplacée
 * (nouveau jeton, nouvelle expiration) — pas de doublon.
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
  const name = parsed.data.name?.trim() || null;

  try {
    // Un compte existe déjà ? Alors pas d'invitation : on passe par
    // /api/admin/admins (changement de rôle / réinitialisation).
    const existingUser = await db.adminUser.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json({ error: "USER_EXISTS" }, { status: 409 });
    }

    // Jeton brut → hash stocké. Le brut ne quitte jamais le serveur sauf
    // dans l'email (lien de setup).
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitedBy = await getAdminIdentity(req);

    await db.adminInvitation.upsert({
      where: { email },
      create: { email, name, role, tokenHash, expiresAt, invitedBy },
      update: {
        name,
        role,
        tokenHash,
        expiresAt,
        invitedBy,
        // Une réinvitation rouvre le chemin (acceptedAt remis à zéro).
        acceptedAt: null,
      },
    });

    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const setupUrl = `${base.replace(/\/$/, "")}/admin/setup?token=${encodeURIComponent(token)}`;

    const emailResult = await sendAdminInvitationEmail({
      to: email,
      firstName: name || "Admin",
      setupUrl,
      invitedBy: invitedBy === "unknown" ? "L'équipe HASHCODE" : invitedBy,
      role,
    });

    if (!emailResult.ok) {
      return NextResponse.json(
        { error: "EMAIL_FAILED", detail: emailResult.error },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, email, role, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    console.error("[admin/invite] failed:", e);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
