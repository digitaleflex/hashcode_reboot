import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocumentBody } from "@/components/reboot/legal/legal-document";

/**
 * /cgu — Conditions generales d'utilisation.
 *
 * Le texte vient de `legal.terms` (titre, sous-titre, sections), les
 * metadonnees de `legal.terms.metaTitle` / `metaDescription`. D21 a remplace le
 * composant « document non publie » par le rendu reel du corpus.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default function TermsPage() {
  return <LegalDocumentBody doc="terms" />;
}
