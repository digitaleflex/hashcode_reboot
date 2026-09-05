import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAdminAuthed } from "@/lib/admin-auth";
import { hashPasscode } from "@/lib/passcode";

/**
 * Admin keys management: GET list active kids, POST rotate kid.
 *
 * - ADMIN_KEYS env holds a comma-separated list of active kid identifiers.
 * - If ADMIN_KEYS is not set, a simulated base set is returned.
 * - Rotation generates a new kid+passcodeHash, invalidates the old one.
 */

function getActiveKids(): string[] {
  const env = process.env.ADMIN_KEYS;
  if (env && env.trim().length > 0) {
    return env.split(",").map((k) => k.trim()).filter(Boolean);
  }
  // Simulated base set when ADMIN_KEYS not configured.
  return ["kid-default-001", "kid-default-002"];
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const kids = getActiveKids();
  return NextResponse.json({
    kids,
    total: kids.length,
    page: 1,
    pageSize: kids.length,
  });
}

/** POST /api/admin/keys — rotate admin key. Generates new kid+passcodeHash. */
export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
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
  const passcodeHash = await hashPasscode(passcode);

  // Invalidate old keys by rotating ADMIN_KEYS env value would be done
  // at deploy/rotation level. Here we simulate by returning the new kid.
  return NextResponse.json({
    kid: newKid,
    passcodeHash,
    message: "Nouvelle clé générée. Mettez à jour ADMIN_KEYS en production.",
  });
}