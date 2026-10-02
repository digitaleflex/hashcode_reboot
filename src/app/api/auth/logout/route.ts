import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout
 *
 * Révoque la session Better Auth courante.
 * Idempotent : renvoie ok quand même.
 */
export async function POST(req: NextRequest) {
  try {
    await auth.api.signOut({ headers: Object.fromEntries(req.headers.entries()) as any });
  } catch {
    /* best-effort */
  }
  const res = NextResponse.json({ ok: true, message: "Déconnecté." });
  res.headers.append(
    "Set-Cookie",
    `better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return res;
}
