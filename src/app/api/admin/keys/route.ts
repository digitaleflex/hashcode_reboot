import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdminRole, checkCSRF } from "@/lib/admin-auth";
import { hashPasscodeForStorage } from "@/lib/admin-passcode";
import { audit } from "@/lib/admin-audit";
import { db } from "@/lib/db";

/**
 * Admin keys management: GET list active kids, POST rotate kid.
 *
 * - Admin keys are now stored persistently in the AdminKey model.
 * - Rotation generates a new kid+passcodeHash and revokes old keys.
 * - ADMIN_KEYS env var is no longer the source of truth for active keys.
 * - A kid is considered "active" if it exists and is not revoked (revokedAt = null).
 */

export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const includeRevoked = searchParams.get("include_revoked") === "true";

  const where = includeRevoked
    ? {} // all keys
    : {
        revokedAt: null,
        expiresAt: null,
      };

  // List keys (optionally including revoked)
  const keys = await db.adminKey.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      kid: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  return NextResponse.json({
    keys,
    total: keys.length,
    page: 1,
    pageSize: keys.length,
  });
}

/** POST /api/admin/keys — rotate admin key. Generates new kid+passcodeHash and revokes old keys. */
export async function POST(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  // CSRF protection: ensure same-origin request
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }

  let body: { passcode?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const passcode = (body?.passcode ?? "").trim();
  if (!passcode || passcode.length < 16) {
    return NextResponse.json(
      { error: "Passcode requis (>= 16 caractères).", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const newKid = `kid-${randomUUID().slice(0, 8)}`;
  const passcodeHash = await hashPasscodeForStorage(passcode);

  // Revoke ALL existing keys by setting revokedAt
  await db.adminKey.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // Store the new key as active
  await db.adminKey.create({
    data: {
      kid: newKid,
      passcodeHash,
      createdAt: new Date(),
      expiresAt: null, // null = never expires
      revokedAt: null,
    },
  });

  // Audit trail
  await audit("admin.key-rotate", "admin_key", newKid, { previousKeysRevoked: true });

  return NextResponse.json({
    kid: newKid,
    message: "Nouvelle clé admin générée. La clé précédente a été révoquée.",
  });
}