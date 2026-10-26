// Point d'entrée Edge middleware — délègue à `src/proxy-guard.ts`.
//
// Emplacement : `src/middleware.ts`, au même niveau que `src/app`. Next ne
// charge le middleware QUE s'il est à côté du dossier `app` : placé à la
// racine du dépôt alors que l'app vit dans `src/`, il était ignoré (routage
// i18n et garde d'auth inactifs — `/` répondait 404 en local).
//
// Pourquoi ce fichier reste nommé `middleware.ts` (et non `proxy.ts`) :
// en Next 16, un fichier `proxy.ts` (racine ou src/) est compilé en
// middleware NODE (`hasNodeMiddleware`), mais Turbopack ne produit JAMAIS
// le `middleware.js.nft.json` attendu par le mode `output: "standalone"` —
// le build casse alors sur un ENOENT à l'étape « Finalizing page
// optimization » (bug Turbopack documenté : vercel/next.js#91600).
// Le nom `middleware.ts` (sans export `runtime = "nodejs"`) reste compilé
// en Edge : pas de trace NFT attendue, build vert.
import { proxy } from "./proxy-guard";

export const config = {
  matcher: [
    "/((?!api|_next|monitoring|.*\\.[^/]+$).*)",
    "/api/account/:path*",
  ],
};

export default proxy;
