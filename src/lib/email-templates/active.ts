/**
 * Résolution des templates ACTIFS au moment de l'envoi (Phase 2).
 *
 * Règle d'or : ce module ne fait JAMAIS échouer un envoi. Toute anomalie
 * (base indisponible, template absent ou inactif, variable non fournie,
 * URL invalide, erreur de rendu) → `null`, et l'appelant garde le HTML du
 * code comme repli. Un template cassé ne peut donc pas bloquer un email.
 *
 * Cache mémoire (30 s) : un envoi de masse ne déclenche pas une requête par
 * destinataire. `invalidateActiveTemplates()` permet de rafraîchir
 * immédiatement après une modification depuis l'admin.
 */

import { db } from "@/lib/db";
import { getTemplateVariables } from "@/lib/email-templates/registry";
import { renderEmailTemplate, type TemplateContent } from "@/lib/email-templates/render";

/** Durée de vie du cache : compromis réactivité / charge base. */
const CACHE_TTL_MS = 30_000;

let cache: { at: number; byKey: Map<string, TemplateContent> } | null = null;

async function loadActive(): Promise<Map<string, TemplateContent>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.byKey;

  try {
    const rows = await db.emailTemplate.findMany({
      where: { isActive: true },
      select: { key: true, subject: true, preheader: true, bodyHtml: true },
    });
    const byKey = new Map(
      rows.map((r) => [
        r.key,
        { subject: r.subject, preheader: r.preheader, bodyHtml: r.bodyHtml } satisfies TemplateContent,
      ]),
    );
    cache = { at: now, byKey };
    return byKey;
  } catch (err) {
    // Base indisponible : on met en cache un ensemble vide pour ne pas
    // marteler la base, et on laisse l'appelant utiliser le contenu du code.
    console.warn("[email-templates] lecture des templates actifs impossible :", err);
    cache = { at: now, byKey: new Map() };
    return cache.byKey;
  }
}

/** Force le rechargement au prochain envoi (après une modification admin). */
export function invalidateActiveTemplates(): void {
  cache = null;
}

export interface ResolvedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Retourne l'email rendu depuis le template actif, ou `null` si le code doit
 * faire foi. `values` doit contenir les valeurs BRUTES (non échappées) : le
 * renderer échappe lui-même les textes et valide les URLs.
 */
export async function resolveActiveTemplate(
  key: string,
  values: Record<string, string>,
): Promise<ResolvedEmail | null> {
  try {
    const content = (await loadActive()).get(key);
    if (!content) return null;

    const rendered = renderEmailTemplate(content, getTemplateVariables(key), values);
    if (rendered.warnings.length > 0) {
      console.warn(
        `[email-templates] template « ${key} » ignoré (${rendered.warnings.length} avertissement(s)) ` +
          `→ contenu du code utilisé : ${rendered.warnings.join(" ; ")}`,
      );
      return null;
    }
    return { subject: rendered.subject, html: rendered.html, text: rendered.text };
  } catch (err) {
    console.warn(`[email-templates] rendu du template « ${key} » impossible → contenu du code utilisé :`, err);
    return null;
  }
}
