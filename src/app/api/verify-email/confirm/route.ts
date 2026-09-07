import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { confirmEmailCode } from "@/lib/verify-email";

export const runtime = "nodejs";

const confirmSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(254),
  code: z.string().trim().regex(/^\d{6}$/, "Code invalide (6 chiffres attendus)"),
});

/** POST /api/verify-email/confirm — valide le code OTP (public).
 * Anti-abus : 10 tentatives par IP toutes les 10 minutes. */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`verify-email-confirm:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const result = await confirmEmailCode(parsed.data.email, parsed.data.code);
  if (!result.ok) {
    const message =
      result.reason === "expired"
        ? "Code expiré. Demande un nouveau code."
        : result.reason === "locked"
          ? "Trop de tentatives. Demande un nouveau code."
          : "Code incorrect. Réessaie.";
    return NextResponse.json(
      { error: message, code: result.reason === "expired" ? "EXPIRED" : result.reason === "locked" ? "LOCKED" : "INVALID_CODE" },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, verified: true, message: "Email vérifié." });
}
