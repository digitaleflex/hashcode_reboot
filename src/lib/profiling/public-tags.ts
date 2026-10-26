/**
 * Tags de profil exposables publiquement.
 *
 * Le moteur (`engine.ts › tagsFor`) produit des tags TECHNIQUES destinés au
 * filtrage admin : certains sont sensibles (`GENDER:*`, `HIGH-BUDGET`) ou
 * purement internes (`COUNTRY:*`). Ils étaient renvoyés tels quels par les
 * API publiques de profil et affichés bruts (« COUNTRY:BJ ») dans l'UI.
 *
 * Règle : liste BLANCHE. Un tag absent de cette table n'est jamais exposé
 * hors admin, et ceux qui le sont s'affichent avec un libellé humain.
 */
export const PUBLIC_TAG_LABELS: Record<string, string> = {
  WEB: "Web",
  CYBER: "Cyber",
  AI: "IA",
  BEGINNER: "Débutant·e",
  ADVANCED: "Avancé·e",
  "EMPLOYMENT-FOCUSED": "Vise un emploi",
  "PROJECT-FOCUSED": "Orienté projet",
  "FREELANCE-FOCUSED": "Vise le freelance",
  "HIGH-AVAILABILITY": "Très disponible",
  "LIGHT-RHYTHM": "Rythme léger",
  "MENTORING-INTERESTED": "Veut un mentor",
  "MENTORING-CURIOUS": "Curieux·se du mentorat",
  "PROJECT-LEARNER": "Apprend en construisant",
};

/** Garde uniquement les tags publics (codes bruts), dans l'ordre d'origine. */
export function publicTags(tags: readonly string[]): string[] {
  return tags.filter((t) => Object.prototype.hasOwnProperty.call(PUBLIC_TAG_LABELS, t));
}

/** Libellés humains des tags publics — à utiliser pour tout affichage. */
export function publicTagLabels(tags: readonly string[]): string[] {
  return publicTags(tags).map((t) => PUBLIC_TAG_LABELS[t]);
}
