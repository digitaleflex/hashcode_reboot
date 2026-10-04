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
import {
  AppError,
  AuthError,
  errorToResponse,
  parseJsonBody,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

/** GET /api/admin/keys — return current key status. */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }

    return NextResponse.json({
    keyAgeDays: getKeyAgeDays(),
    isStub: isKeyStub(),
    rotationThresholdDays: parseInt(
      process.env.ADMIN_KEY_ROTATION_DAYS || "90",
      10,
    ),
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

/** POST /api/admin/keys — rotate the admin passcode. */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }

    const body = (await parseJsonBody(req)) as { confirmPasscode?: string };
    const currentPasscode = body.confirmPasscode?.trim();
    if (!currentPasscode) {
      throw new ValidationError("Confirme le passcode actuel pour autoriser la rotation.");
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
      throw new AuthError("Passcode de confirmation invalide.", "UNAUTHORIZED");
    }
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AppError("Erreur de vérification.", { status: 500, code: "INTERNAL_ERROR" });
  }

  // Generate new passcode.
  const newPasscode = rotateAdminPasscode();
  const validation = validateRotatedKey(newPasscode);
  if (!validation.valid) {
    throw new AppError(validation.error ?? "Erreur génération de clé.", {
      status: 500,
      code: "KEY_GENERATION_ERROR",
    });
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
  } catch (err) {
    return errorToResponse(err);
  }
}
