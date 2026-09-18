import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * phone-fill-ticket.ts — ticket de remplissage WhatsApp post-inscription.
 *
 * Contexte (S3) : POST /api/account/phone est volontairement appelable SANS
 * session — le membre vient de s'inscrire (écran de résultat) et n'est pas
 * encore connecté. Sans garde, n'importe qui pouvait écrire le téléphone de
 * n'importe quel membre (memberId passé dans le body, IDs exposés par les
 * profils publics). Exiger une session casserait le flux d'inscription.
 *
 * Mécanisme : à la création FRAÎCHE d'un membre, POST /api/members pose un
 * cookie httpOnly de courte durée (15 min) contenant
 * `memberId.expiry.signature` (HMAC-SHA256). La route phone n'écrit que si
 * le ticket est valide ET lié au memberId demandé. C'est une preuve de
 * possession du navigateur d'inscription — sans session, sans nouveau
 * secret obligatoire, sans changement d'UX.
 *
 * Clé HMAC : PHONE_FILL_SECRET si définie, sinon DATABASE_URL (serveur
 * uniquement, forte entropie, toujours présente), avec séparation de
 * domaine "phone-fill-v1:". Sans les deux → aucun ticket émis et aucune
 * écriture (fail-closed).
 *
 * Limites assumées : le ticket n'est pas à usage unique, mais rejouer un
 * ticket volé n'écrit que sur le même membre (lié au memberId) et seulement
 * si aucun numéro n'est enregistré (remplissage unique) — gain nul pour
 * l'attaquant. Fenêtre de 15 min.
 */

const COOKIE_NAME = "hc_phone_fill";
const TICKET_TTL_MS = 15 * 60 * 1000;
const COOKIE_MAX_AGE_S = 15 * 60;

function getKey(): Buffer | null {
  const raw =
    process.env.PHONE_FILL_SECRET || process.env.DATABASE_URL || "";
  if (!raw) return null;
  return Buffer.from(`phone-fill-v1:${raw}`, "utf8");
}

/** Émet un ticket pour memberId. Appelé à la création du membre uniquement. */
export function issuePhoneFillTicket(memberId: string): string | null {
  const key = getKey();
  if (!key || !memberId) return null;
  const exp = Date.now() + TICKET_TTL_MS;
  const payload = `${memberId}.${exp}`;
  const sig = createHmac("sha256", key).update(payload, "utf8").digest("hex");
  return `${payload}.${sig}`;
}

/** Vérifie un ticket. Renvoie le memberId lié, ou null. Ne lève jamais. */
export function verifyPhoneFillTicket(ticket: string): string | null {
  try {
    const key = getKey();
    if (!key || !ticket) return null;
    const parts = ticket.split(".");
    if (parts.length !== 3) return null;
    const [memberId, expStr, sig] = parts;
    if (!memberId || !expStr || !sig) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now()) return null;
    const expected = createHmac("sha256", key)
      .update(`${memberId}.${exp}`, "utf8")
      .digest("hex");
    if (sig.length !== expected.length) return null;
    if (
      !timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
    ) {
      return null;
    }
    return memberId;
  } catch {
    return null;
  }
}

/** Valeur d'en-tête Set-Cookie pour le ticket (httpOnly, 15 min). */
export function phoneFillSetCookie(ticket: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${ticket}; Path=/api/account/phone; Max-Age=${COOKIE_MAX_AGE_S}; HttpOnly; SameSite=Lax${secure}`;
}

/** Lit le ticket depuis les cookies de la requête (null si absent). */
export function readPhoneFillTicket(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}
