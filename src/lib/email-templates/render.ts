/**
 * Rendu des templates d'email.
 *
 * Le HTML final est produit par `emailShell()` (src/lib/email-templates/shell.ts)
 * — la MÊME coquille que l'envoi réel. Conséquence : l'aperçu admin est
 * structurellement identique à l'email envoyé, il n'y a pas deux rendus.
 *
 * Substitution : `{{variable}}`. Seules les variables déclarées dans le
 * registre pour ce template sont remplacées ; toute autre reste littérale et
 * déclenche un avertissement (jamais d'injection silencieuse).
 */

import { emailShell, escapeHtml } from "@/lib/email-templates/shell";
import type { TemplateVariable } from "@/lib/email-templates/registry";

/** Contenu stocké en base. */
export interface TemplateContent {
  subject: string;
  preheader: string;
  bodyHtml: string;
}

export interface RenderedTemplate {
  subject: string;
  preheader: string;
  html: string;
  /** Version texte dérivée du HTML (approximation, pour les clients sans HTML). */
  text: string;
  warnings: string[];
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Remplace les `{{variable}}` d'un fragment.
 * - texte : échappé (les valeurs viennent de la base membres)
 * - url : doit être http(s) après substitution, sinon la valeur est vidée
 */
function substitute(
  input: string,
  variables: readonly TemplateVariable[],
  values: Record<string, string>,
  warnings: string[],
  onMissing: (key: string) => void = () => {},
): string {
  const byKey = new Map(variables.map((v) => [v.key, v]));
  return input.replace(PLACEHOLDER_RE, (match, rawKey: string) => {
    const def = byKey.get(rawKey);
    if (!def) {
      warnings.push(`Variable inconnue ignorée : {{${rawKey}}}`);
      onMissing(rawKey);
      return "";
    }
    const raw = values[def.key];
    if (raw === undefined) {
      warnings.push(`Variable non fournie : {{${rawKey}}}`);
      onMissing(rawKey);
      return "";
    }
    if (def.kind === "url") {
      const trimmed = raw.trim();
      if (!isHttpUrl(trimmed)) {
        warnings.push(`URL invalide pour {{${rawKey}}} (http/https requis) — valeur ignorée.`);
        return "";
      }
      return escapeHtml(trimmed);
    }
    return escapeHtml(raw);
  });
}

/** Rend un template complet (sujet + préheader + corps → e-mail HTML). */
export function renderEmailTemplate(
  content: TemplateContent,
  variables: readonly TemplateVariable[],
  values: Record<string, string>,
): RenderedTemplate {
  const warnings: string[] = [];
  const subject = substitute(content.subject, variables, values, warnings);
  const preheader = substitute(content.preheader, variables, values, warnings);
  const bodyHtml = substitute(content.bodyHtml, variables, values, warnings);

  return {
    subject,
    preheader,
    html: emailShell(preheader, bodyHtml),
    text: htmlToText(bodyHtml),
    warnings,
  };
}

/**
 * Opération inverse de `substitute`, utilisée au seed : à partir d'un rendu
 * obtenu avec les valeurs d'exemple, réinsère les `{{variable}}`.
 * Les remplacements les plus longs passent en premier (évite les collisions
 * de préfixe entre deux URLs d'exemple).
 */
export function encodeFromSample(
  rendered: string,
  variables: readonly TemplateVariable[],
): string {
  let out = rendered;
  const ordered = [...variables].sort((a, b) => b.sample.length - a.sample.length);
  for (const v of ordered) {
    const variants = new Set([v.sample, escapeHtml(v.sample)]);
    for (const variant of variants) {
      if (!variant) continue;
      out = out.split(variant).join(`{{${v.key}}}`);
    }
  }
  return out;
}

/** Conversion HTML → texte lisible (approximation pour les clients sans HTML). */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|tr|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
