import { NextRequest, NextResponse } from "next/server";

// Inline — on n'importe PAS account-auth (qui importe Prisma/DB).
// Le middleware Edge ne fait que vérifier la présence du cookie.
const SESSION_COOKIE_NAME = "hashcode_session";

/**
 * Middleware Next.js (Edge runtime).
 *
 * Protège :
 *   - /account/* (UI membre)
 *   - /dashboard/* (UI membre — dashboard)
 *   - /api/account/* (API member-only)
 *
 * On vérifie uniquement la présence du cookie ici. La vraie validation
 * (session en DB, expiration, etc.) se fait dans les server components
 * et les API routes via getSession() — impossible en Edge (DB non dispo).
 *
 * Le middleware évite surtout de servir la page member si on sait déjà
 * qu'il n'y a pas de cookie, et redirige vers /login.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /account & /dashboard : redirige vers /login si pas de cookie
  if (pathname.startsWith("/account") || pathname.startsWith("/dashboard")) {
    const hasCookie = req.cookies.get(SESSION_COOKIE_NAME);
    if (!hasCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // /api/account/* : renvoie 401 si pas de cookie
  if (pathname.startsWith("/api/account/")) {
    const hasCookie = req.cookies.get(SESSION_COOKIE_NAME);
    if (!hasCookie) {
      return NextResponse.json(
        { error: "Non authentifié.", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/dashboard/:path*", "/api/account/:path*"],
};
