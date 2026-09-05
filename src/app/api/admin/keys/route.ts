import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { isAdminAuthed, getAdminPasscode, requireAdminRole, checkCSRF } from "@/lib/admin-auth";

/**
 * Admin keys management: GET list active kids, POST rotate kid.
 *
 * - Admin keys are now stored persistently in the AdminKey model.
 * - Rotation generates a new kid+passcodeHash and revokes old keys.
 * - ADMIN_KEYS env var is no longer the source of truth for active keys.
 * - A kid is considered "active" if it exists and is not revoked (revokedAt = null).
 */

import { db } from "@/lib/db";

function hashPasscode(passcode: string): string {
  return createHmac("sha256", getAdminPasscode()).update(passcode).digest("base64url");
}

export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  // List all non-revoked, non-expired keys (active)
  const keys = await db.adminKey.findMany({
    where: {
      revokedAt: null,
      expiresAt: null, // null = never expires
    },
    orderBy: { createdAt: "desc" },
  });

  // Return only the kid identifiers (no hash for security)
  const kids = keys.map((k) => k.kid);

  return NextResponse.json({
    kids,
    total: kids.length,
    page: 1,
    pageSize: kids.length,
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

  const passcode = (body.passcode ?? "").trim();
  if (!passcode || passcode.length < 16) {
    return NextResponse.json(
      { error: "Passcode requis (>= 16 caractères).", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const newKid = `kid-${randomUUID().slice(0, 8)}`;
  const passcodeHash = hashPasscode(passcode);

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

  return NextResponse.json({
    kid: newKid,
    passcodeHash,
    message: "Nouvelle clé admin générée. La clé précédente a été révoquée.",
  });
}