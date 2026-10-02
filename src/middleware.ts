import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// T08 — middleware i18n (next-intl) : détecte la locale, réécrit
// /dashboard → /fr/dashboard en interne (locale par défaut sans préfixe).
const intlMiddleware = createMiddleware(routing);

/** Retire un éventuel préfixe de locale (/fr, /en) pour les règles métier. */
function stripLocalePrefix(pathname: string): { unprefixed: string; localePrefix: string } {
  const match = /^\/(fr|en)(\/|$)/.exec(pathname);
  if (!match) return { unprefixed: pathname, localePrefix: "" };
  const localePrefix = `/${match[1]}`;
  const unprefixed = pathname.slice(localePrefix.length) || "/";
  return { unprefixed, localePrefix };
}

/**
 * Middleware Next.js (Edge runtime) — T08/T15 : auth (Better Auth) + i18n composés.
 *
 * Ordre :
 *   1. /api/* → garde auth seule (401 si pas de cookie), JAMAIS d'i18n
 *      (une réécriture /fr/api/… casserait les routes API).
 *   2. Pages → règles auth existantes (conscientes du préfixe de locale),
 *      puis délégation au middleware next-intl pour la réécriture /fr/….
 *
 * Protège :
 *   - /account/* et /dashboard/* (UI membre) → redirect /login si pas de cookie Better Auth
 *   - /api/account/* (API member-only) → 401 si pas de cookie Better Auth
 *
 * On vérifie uniquement la présence du cookie Better Auth ici. La vraie validation
 * (session en DB, expiration, etc.) se fait dans les server components
 * et les API routes via auth.api.getSession() — impossible en Edge (DB non dispo).
 */
const BETTER_AUTH_SESSION_COOKIE = "better-auth.session_token";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. API : auth seule, pas d'i18n.
  if (pathname.startsWith("/api/account/")) {
    const hasCookie = req.cookies.get(BETTER_AUTH_SESSION_COOKIE);
    if (!hasCookie) {
      return NextResponse.json(
        { error: "Non authentifié.", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // 2. Pages : auth (locale-aware) puis i18n.
  const { unprefixed, localePrefix } = stripLocalePrefix(pathname);

  // /account & /dashboard : redirige vers /login si pas de cookie Better Auth.
  // Le préfixe de locale est conservé (/en/dashboard → /en/login?next=…).
  if (unprefixed.startsWith("/account") || unprefixed.startsWith("/dashboard") || unprefixed.startsWith("/admin")) {
    const hasCookie = req.cookies.get(BETTER_AUTH_SESSION_COOKIE);
    if (!hasCookie) {
      const url = req.nextUrl.clone();
      if (unprefixed.startsWith("/admin")) {
        url.pathname = `${localePrefix}/`;
        url.search = "?admin=1";
        url.searchParams.set("next", pathname);
      } else {
        url.pathname = `${localePrefix}/login`;
        url.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: [
    "/",
    "/(fr|en)/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/evenements/:path*",
    "/login",
    "/profile/:path*",
    "/verify-email/:path*",
    "/verify-otp/:path*",
    "/api/account/:path*",
  ],
};
