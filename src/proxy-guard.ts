import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// T08 — middleware i18n (next-intl) : détecte la locale, réécrit
// /dashboard → /fr/dashboard en interne (locale par défaut sans préfixe).
const intlMiddleware = createMiddleware(routing);

/** Retire un éventuel préfixe de locale (/fr, /en) pour les règles métier.
 * FR-only temporaire 2026-10-07 : le cas `/fr` reste utile (compat), le cas
 * `/en` est conservé par compatibilité mais devient inatteignable — `/en/*`
 * est redirigé (301) vers la version FR en tête de `proxy()` ci-dessous. */
function stripLocalePrefix(pathname: string): { unprefixed: string; localePrefix: string } {
  const match = /^\/(fr|en)(\/|$)/.exec(pathname);
  if (!match) return { unprefixed: pathname, localePrefix: "" };
  const localePrefix = `/${match[1]}`;
  const unprefixed = pathname.slice(localePrefix.length) || "/";
  return { unprefixed, localePrefix };
}

/**
 * Proxy Next.js (Edge runtime) — T08/T15 : auth (Better Auth) + i18n composés.
 *
 * Renommé `middleware` → `proxy` pour la convention Next 16 (l'ancien nom de
 * fichier et d'export est déprécié).
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
// Cookie de session admin nominatif (cf. src/lib/auth/admin.ts). Distinct du
// cookie membre : un cookie membre ne peut PAS ouvrir /admin.
const ADMIN_AUTH_SESSION_COOKIE = "hashcode-admin.session_token";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // FR-only temporaire 2026-10-07 (réversible) : `/en` et `/en/*` redirigés
  // (301) vers l'équivalent FR. Placé AVANT tout (y compris l'auth) pour que
  // les vieux bookmarks / liens d'emails /en/* atterrissent sur la page FR.
  // Le `search` est conservé par `clone()` (seul `pathname` est réécrit).
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = req.nextUrl.clone();
    const rest = pathname === "/en" ? "" : pathname.slice("/en".length);
    url.pathname = rest || "/";
    return NextResponse.redirect(url, 301);
  }

  // 1. API : auth seule, pas d'i18n.
  // L'endpoint /api/account/phone est public par design (remplissage post-
  // inscription via ticket HMAC, pas de session requise) — on le laisse
  // passer sans garde cookie.
  if (pathname === "/api/account/phone") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/account/")) {
    const hasCookie =
      req.cookies.get(BETTER_AUTH_SESSION_COOKIE) ||
      req.cookies.get("__Secure-" + BETTER_AUTH_SESSION_COOKIE);
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

  // /account & /dashboard : redirige si pas de cookie Better Auth membre.
  // /admin : redirige si NI cookie membre NI cookie admin nominatif — la
  // validation du rôle se fait ensuite côté serveur (AdminLayout → base
  // inaccessible en Edge). Les anciennes sessions membres admin restent
  // valides le temps de la migration (cf. src/lib/admin-auth.ts).
  if (unprefixed.startsWith("/account") || unprefixed.startsWith("/dashboard")) {
    // En HTTPS (prod), Better Auth préfixe le cookie de `__Secure-` ; ne
    // vérifier que la forme nue ferait boucler les pages protégées vers
    // /login alors même que la session existe (cf. get-session qui, lui,
    // gère les deux variantes). On couvre donc les deux noms, comme l'API.
    const hasCookie =
      req.cookies.get(BETTER_AUTH_SESSION_COOKIE) ||
      req.cookies.get("__Secure-" + BETTER_AUTH_SESSION_COOKIE);
    if (!hasCookie) {
      const url = req.nextUrl.clone();
      url.pathname = `${localePrefix}/login`;
      // `next` est validé côté client : seuls les chemins internes sont
      // acceptés (les esquemas externes et `//` sont rejetés).
      const destination = `${localePrefix}${unprefixed}${req.nextUrl.search}`;
      url.search = `?next=${encodeURIComponent(destination)}`;
      return NextResponse.redirect(url);
    }
    return intlMiddleware(req);
  }

  if (unprefixed.startsWith("/admin")) {
    const hasMemberCookie =
      req.cookies.get(BETTER_AUTH_SESSION_COOKIE) ||
      req.cookies.get("__Secure-" + BETTER_AUTH_SESSION_COOKIE);
    const hasAdminCookie =
      req.cookies.get(ADMIN_AUTH_SESSION_COOKIE) ||
      req.cookies.get("__Secure-" + ADMIN_AUTH_SESSION_COOKIE);
    const hasAnySession = hasMemberCookie || hasAdminCookie;

    // Pages publiques de l'espace admin (login nominatif, activation
    // d'invitation, enrôlement 2FA) : accessibles SANS cookie, sinon
    // /admin/login bouclerait sur lui-même.
    const publicAdminPaths = ["/admin/login", "/admin/setup", "/admin/setup-2fa"];
    const isPublicAdminPath = publicAdminPaths.some((p) => unprefixed === p);

    if (!hasAnySession && !isPublicAdminPath) {
      const url = req.nextUrl.clone();
      url.pathname = `${localePrefix}/admin/login`;
      const destination = `${localePrefix}${unprefixed}${req.nextUrl.search}`;
      url.search = `?next=${encodeURIComponent(destination)}`;
      return NextResponse.redirect(url);
    }

    const res = intlMiddleware(req);
    // Chemin demandé, lu par AdminLayout (server component — les layouts
    // n'ont pas d'accès direct au pathname en App Router).
    res.headers.set("x-hc-admin-pathname", unprefixed);
    // Marqueur « page publique, aucun cookie » : la garde d'accès du layout
    // ne doit PAS s'appliquer (sinon boucle sur /admin/login).
    if (!hasAnySession && isPublicAdminPath) {
      res.headers.set("x-hc-admin-public", "1");
    }
    return res;
  }

  return intlMiddleware(req);
}

export const config = {
  /**
   * Toute page passe par le proxy, y compris celles qui n'existent pas.
   *
   * Avec une liste blanche, un chemin FR qui n'est pas listé (`/cgu`,
   * `/page-inexistante`…) ne subit aucune réécriture de locale. Next cherche
   * alors `[locale]/page-inexistante`, ne trouve rien, et `notFound()` est
   * appelé depuis `app/[locale]/layout.tsx` — au-dessus du point où le statut
   * HTTP peut encore être fixé. Résultat : la page 404 servie en **200** (soft
   * 404), et une infinité d'URL indexables.
   *
   * La réécriture next-intl évite cela : `/cgu` devient `/fr/cgu`, la locale
   * est valide, aucune route ne correspond, et Next renvoie un vrai 404.
   *
   * Sont exclus : les API (une réécriture `/fr/api/…` casserait les routes),
   * les fichiers statiques (chemins contenant un point) et le tunnel Sentry.
   */
  matcher: [
    // Pages : tout ce qui n'est ni une API, ni un asset statique, ni le tunnel
    // Sentry. Les chemins dont le dernier segment contient un point sont
    // écartés (fichiers).
    //
    // `monitoring` doit être exclu : c'est le `tunnelRoute` Sentry
    // (next.config.ts). Le proxy s'exécute AVANT les `afterFiles` rewrites
    // injectés par `withSentryConfig` ET avant la résolution du système de
    // fichiers, donc sans cette exclusion `intlMiddleware` réécrit
    // `/monitoring?o=…&p=…` en `/fr/monitoring?o=…&p=…` : ni la route
    // `src/app/monitoring/route.ts` ni la réécriture Sentry ne sont alors
    // jamais atteintes, et chaque enveloppe se termine en 404.
    "/((?!api|_next|monitoring|.*\\.[^/]+$).*)",
    // Réincluse : `/api/account/*` porte sa propre règle 401 et ne doit jamais
    // passer par i18n, mais doit bien traverser le proxy.
    "/api/account/:path*",
  ],
};
