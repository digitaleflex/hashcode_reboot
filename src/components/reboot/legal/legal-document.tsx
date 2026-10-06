import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import {
  CONTACT_EMAIL,
  LEGAL_DOCUMENTS,
  legalValueKey,
  resolveLegalFields,
  type LegalDocument,
  type LegalField,
  type LegalNode,
  type LegalReader,
} from "@/lib/legal-content";

/** Meme ordre que la navigation croisee rendue sous chaque document. */
const NAV: Record<LegalDocument, LegalDocument[]> = {
  terms: ["mentions", "privacy", "cookies"],
  privacy: ["mentions", "terms", "cookies"],
  mentions: ["privacy", "terms", "cookies"],
  cookies: ["mentions", "privacy", "terms"],
};

/**
 * D21 — rendu reel des quatre documents juridiques.
 *
 * Le corpus `legal.<document>` existe et est complet dans `messages/fr.json`
 * ET `messages/en.json` : les pages le consomment enfin au lieu d'afficher un
 * « document non publie ». Le commentaire de l'ancien
 * `pending-document.tsx` (« namespaces that were never added to
 * `messages/*.json` ») etait faux.
 *
 * Le corpus est heterogene : paragraphes, listes a puces, sous-blocs titres,
 * listes d'objets `{label, desc}` et fiches label/valeur. Plutot que d'ecrire
 * quatre rendus specifiques, on rend ce que la donnee contient, dans l'ordre
 * des cles du fichier. Aucune cle n'est renommee, aucun texte n'est reformule.
 */
export async function LegalDocumentBody({ doc }: { doc: LegalDocument }) {
  const t = await getTranslations(`legal.${doc}`);
  const sections = t.raw("sections") as Record<string, Record<string, LegalNode>>;

  /**
   * Un seul texte du corpus porte un placeholder ICU : `{email}` dans
   * `privacy.sections.rights.exercise`. On lui fournit l'adresse de contact
   * deja presente dans le depot.
   *
   * `legal.<document>.lastUpdated` en porte un second (`{date}`), mais aucune
   * date de redaction n'existe dans le depot : ce texte n'est volontairement pas
   * rendu, plutot que d'afficher un `{date}` litteral ou une date inventee.
   */
  const read: LegalReader = (key) =>
    doc === "privacy" && key === "sections.rights.exercise"
      ? t(key, { email: CONTACT_EMAIL })
      : t(key);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("backHome")}
        </Link>

        <header className="mt-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">{t("subtitle")}</p>
        </header>

        {Object.entries(sections).map(([id, section]) => (
          <LegalSection key={id} id={id} section={section} read={read} />
        ))}

        <nav aria-label={t("navAria")} className="mt-12 border-t border-border pt-8">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {NAV[doc].map((target) => (
              <li key={target}>
                <Link
                  href={LEGAL_DOCUMENTS[target]}
                  className="inline-flex min-h-[44px] items-center text-muted-foreground transition-colors hover:text-lime"
                >
                  {t(`nav.${target}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}

/** Une section du document : son titre, puis ses champs dans l'ordre du fichier. */
function LegalSection({
  id,
  section,
  read,
}: {
  id: string;
  section: Record<string, LegalNode>;
  read: LegalReader;
}) {
  const title = typeof section.title === "string" ? section.title : "";
  const headingId = `legal-${id}`;
  const fields = resolveLegalFields(
    Object.entries(section).filter(([key]) => key !== "title"),
    `sections.${id}`,
    read,
  );

  return (
    <section aria-labelledby={title ? headingId : undefined} className="mt-10">
      {title ? (
        <h2
          id={headingId}
          className="font-display text-xl font-semibold tracking-tight text-foreground"
        >
          {title}
        </h2>
      ) : null}
      <Fields fields={fields} lead={false} />
    </section>
  );
}

/**
 * Champs d'un bloc, rendus dans l'ordre du fichier.
 *
 * @param lead le premier texte du bloc sert de sous-titre (`{label, desc}`,
 *   `{title, items}`, ...) plutot que de paragraphe.
 */
function Fields({ fields, lead }: { fields: LegalField[]; lead: boolean }) {
  const rows: ReactNode[] = [];
  let isLead = lead;

  for (let i = 0; i < fields.length; i += 1) {
    const [key, value] = fields[i];
    const next = fields[i + 1];

    // Fiche label/valeur (`legal.mentions.sections.editor`) : les deux libelles
    // sont sur la meme ligne. On n'utilise pas `<dt>/<dd>` : le bloc melange
    // paires et libelle isole (`editor.email` n'a pas de valeur).
    const valueKey = legalValueKey(key);
    if (
      typeof value === "string" &&
      valueKey !== null &&
      next !== undefined &&
      next[0] === valueKey &&
      typeof next[1] === "string"
    ) {
      rows.push(
        <div key={key} className="mt-2 flex flex-col gap-0.5 sm:flex-row sm:gap-4">
          <span className="text-sm font-medium text-foreground sm:w-56">{value}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{next[1]}</span>
        </div>,
      );
      i += 1;
      isLead = false;
      continue;
    }

    if (typeof value === "string") {
      rows.push(isLead ? <Lead key={key}>{value}</Lead> : <Para key={key}>{value}</Para>);
      isLead = false;
      continue;
    }

    // Un sous-bloc titre (`{title, items}`) garde son titre de sous-titre.
    rows.push(<Node key={key} node={value} lead={"title" in value} />);
    isLead = false;
  }

  return <>{rows}</>;
}

/** Une valeur du corpus : paragraphe, liste, ou bloc. */
function Node({ node, lead }: { node: LegalNode; lead: boolean }) {
  if (typeof node === "string") {
    return lead ? <Lead>{node}</Lead> : <Para>{node}</Para>;
  }

  if (Array.isArray(node)) {
    return (
      <ul className="mt-2 list-disc list-inside space-y-1.5 marker:text-lime">
        {node.map((item, index) => (
          <li key={index} className="text-sm leading-relaxed text-muted-foreground">
            {typeof item === "string" ? item : <Node node={item} lead={true} />}
          </li>
        ))}
      </ul>
    );
  }

  return <Fields fields={Object.entries(node)} lead={lead} />;
}

function Para({ children }: { children: string }) {
  return <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Lead({ children }: { children: string }) {
  return <p className="text-sm font-medium text-foreground">{children}</p>;
}
