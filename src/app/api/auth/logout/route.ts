import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, destroySession } from "@/lib/account-auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout
 *
 * Révoque la session courante et supprime le cookie.
 * Idempotent : si pas de cookie, renvoie ok quand même.
 */
export async function POST(req: NextRequest) {
  const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieValue) {
    await destroySession(cookieValue);
  }
  const res = NextResponse.json({ ok: true, message: "Déconnecté." });
  // Supprimer le cookie côté navigateur
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return res;
}
