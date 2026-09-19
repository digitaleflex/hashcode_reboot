import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminRole,
  rotateAdminPasscode,
  validateRotatedKey,
  getKeyAgeDays,
  isKeyStub,
  getAdminPasscode,
} from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";

export const runtime = "nodejs";

/** GET /api/admin/keys — return current key status. */
export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  return NextResponse.json({
    keyAgeDays: getKeyAgeDays(),
    isStub: isKeyStub(),
    rotationThresholdDays: parseInt(
      process.env.ADMIN_KEY_ROTATION_DAYS || "90",
      10,
    ),
  });
}

/** POST /api/admin/keys — rotate the admin passcode. */
export async function POST(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let body: { confirmPasscode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const currentPasscode = body.confirmPasscode?.trim();
  if (!currentPasscode) {
    return NextResponse.json(
      { error: "Confirme le passcode actuel pour autoriser la rotation.", code: "CONFIRMATION_REQUIRED" },
      { status: 422 },
    );
  }

  // Verify current passcode to authorize rotation.
  try {
    const expected = getAdminPasscode();
    const minLen = Math.min(currentPasscode.length, expected.length);
    let diff = 0;
    for (let i = 0; i < minLen; i++) {
      diff |= currentPasscode.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (currentPasscode.length !== expected.length) {
      const longer = currentPasscode.length > expected.length ? currentPasscode : expected;
      for (let i = minLen; i < longer.length; i++) {
        diff |= longer.charCodeAt(i) ^ 0x00;
      }
      diff |= 1;
    }
    if (diff !== 0) {
      return NextResponse.json(
        { error: "Passcode de confirmation invalide.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Erreur de vérification.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  // Generate new passcode.
  const newPasscode = rotateAdminPasscode();
  const validation = validateRotatedKey(newPasscode);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, code: "KEY_GENERATION_ERROR" },
      { status: 500 },
    );
  }

  // Audit the rotation.
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  void audit("admin.keys.rotate", "admin_key", undefined, {
    keyAgeDays: getKeyAgeDays(),
    isStub: isKeyStub(),
  }, { type: "ip", ip });

  return NextResponse.json({
    ok: true,
    newKey: newPasscode,
    message: "Clé rotée avec succès. TOUS les sessions admin existants sont invalidés. Copie la nouvelle clé immédiatement.",
    keyAgeDays: 0,
  });
}
