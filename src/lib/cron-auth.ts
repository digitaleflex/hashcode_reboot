import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Compare le header `Authorization` complet contre `Bearer <secret>`
 * en temps constant (jamais de comparaison naive `===` sur un secret).
 * Un secret absent ou vide ne matche jamais (pas de throw).
 */
function headerMatches(authHeader: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  return timingSafeEqual(a, b);
}

/**
 * Vérifie l'authentification Bearer des routes `/api/cron/*`.
 *
 * Accepte `CRON_SECRET` OU `CRON_SECRET_PREVIOUS` (fenêtre de grâce bornée
 * pour la rotation : poser PREVIOUS=ancien + SECRET=nouveau, redémarrer,
 * vérifier, puis vider PREVIOUS — jamais permanent).
 *
 * Quand c'est le secret précédent qui matche, un avertissement est émis
 * (sans jamais logger les valeurs ni les longueurs des secrets).
 * Fonction pure hors lecture de `process.env` (et ce `console.warn`).
 */
export function isCronAuthed(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization") || "";
  if (headerMatches(authHeader, process.env.CRON_SECRET)) return true;
  if (headerMatches(authHeader, process.env.CRON_SECRET_PREVIOUS)) {
    console.warn("[cron-auth] secret précédent utilisé — fenêtre de grâce active");
    return true;
  }
  return false;
}
