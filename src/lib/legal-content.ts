/**
 * D21 — contrat de contenu des quatre pages juridiques.
 *
 * Le corpus vit dans `messages/{fr,en}.json`, sous `legal.<document>`. Ce
 * module regroupe ce dont le rendu a besoin *avant* le JSX : la correspondance
 * route -> document, et la resolution des valeurs ICU. Le rendu lui-meme est
 * dans `src/components/reboot/legal/legal-document.tsx`.
 *
 * Le texte n'est ni reecrit, ni reordonne, ni nettoye : on lit `legal.*` tel
 * qu'il a ete redige, dans l'ordre des cles du fichier.
 */

/** Les quatre documents et la route qui sert chacun. */
export const LEGAL_DOCUMENTS = {
  terms: "/cgu",
  privacy: "/confidentialite",
  mentions: "/mentions-legales",
  cookies: "/cookies",
} as const;

export type LegalDocument = keyof typeof LEGAL_DOCUMENTS;

/**
 * Adresse de contact publiee dans `legal.privacy.sections.rights.exercise`
 * (placeholder ICU `{email}`).
 */
export const CONTACT_EMAIL = "contact@hashcode.reboot";

/** Une valeur du corpus : texte, liste de valeurs, ou bloc cle -> valeur. */
export type LegalNode = string | LegalNode[] | { [key: string]: LegalNode };

/** Un champ resolu : la cle d'origine, puis sa valeur finale. */
export type LegalField = [string, LegalNode];

/** Lecture d'un message par son chemin, valeurs ICU deja fournies. */
export type LegalReader = (key: string) => string;

/**
 * Resout un noeud du corpus, recursivement.
 *
 * `t.raw` renvoie la valeur JSON brute : les scalaires repassent par le lecteur
 * pour que les placeholders ICU soient interpoles. Les elements d'un tableau
 * restent bruts — le lecteur n'adresse pas `items[0]`.
 *
 * Une chaine vide est eliminee (`null`) : une traduction manquante ne doit pas
 * laisser un paragraphe vide a l'ecran.
 *
 * @param path chemin du noeud dans le namespace, `null` a l'interieur d'un tableau.
 */
export function resolveLegalNode(
  node: LegalNode,
  path: string | null,
  read: LegalReader,
): LegalNode | null {
  if (typeof node === "string") {
    const text = path === null ? node : read(path);
    return text.trim() === "" ? null : text;
  }

  if (Array.isArray(node)) {
    const items: LegalNode[] = [];
    for (const item of node) {
      const resolved = resolveLegalNode(item, null, read);
      if (resolved !== null) items.push(resolved);
    }
    return items.length > 0 ? items : null;
  }

  const entries: [string, LegalNode][] = [];
  for (const [key, value] of Object.entries(node)) {
    const resolved = resolveLegalNode(value, path === null ? null : `${path}.${key}`, read);
    if (resolved !== null) entries.push([key, resolved]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** Resout une liste de champs et supprime ceux qui resolusent a vide. */
export function resolveLegalFields(
  fields: LegalField[],
  path: string,
  read: LegalReader,
): LegalField[] {
  const out: LegalField[] = [];
  for (const [key, value] of fields) {
    const resolved = resolveLegalNode(value, `${path}.${key}`, read);
    if (resolved !== null) out.push([key, resolved]);
  }
  return out;
}

/**
 * Cle de la valeur associee a un libelle, dans un bloc de type fiche
 * (`legal.mentions.sections.editor`).
 *
 * Deux formes coexistent dans le corpus : le suffixe `Value`
 * (`address` / `addressValue`, `siret` / `siretValue`, ...) et la paire
 * `label` / `value`. Retourne `null` quand la valeur suit sous une autre forme
 * — `email` n'a par exemple aucun `emailValue`.
 */
export function legalValueKey(labelKey: string): string | null {
  return labelKey === "label" ? "value" : `${labelKey}Value`;
}
