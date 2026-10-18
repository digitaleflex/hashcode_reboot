import { NextRequest } from "next/server";

/** Nombre de proxys de confiance devant l'app (Traefik seul = 1). */
function trustedProxyHops(): number {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * IP client depuis `X-Forwarded-For`, lue depuis la DROITE.
 *
 * Chaque proxy AJOUTE l'adresse qu'il voit en fin de liste : seules les
 * `hops` dernières entrées ont été écrites par une infra de confiance. La
 * première entrée, elle, est entièrement contrôlée par le client — la lire
 * permettait de contourner tous les rate-limits avec un header forgé.
 * Avec 1 proxy (Traefik), c'est la dernière entrée ; derrière un CDN
 * (Cloudflare → Traefik), poser TRUSTED_PROXY_HOPS=2.
 */
export function clientIpFromXff(xff: string, hops: number): string | null {
  const parts = xff
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return parts[Math.max(0, parts.length - hops)] ?? null;
}

/** Extract a client key from the request for rate-limit purposes.
 *  `req.ip` n'existe plus depuis Next 15 : l'IP vient de X-Forwarded-For,
 *  lu côté proxy de confiance (cf. clientIpFromXff). */
export function rateKey(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = clientIpFromXff(xff, trustedProxyHops());
  if (ip) return ip;

  // Last resort: anonymous (should not happen in production behind proxy)
  return "anon";
}
