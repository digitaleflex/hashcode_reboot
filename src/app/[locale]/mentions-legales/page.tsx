import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocumentBody } from "@/components/reboot/legal/legal-document";

/**
 * /mentions-legales — Mentions legales.
 *
 * Le texte vient de `legal.mentions` (titre, sous-titre, sections), les
 * metadonnees de `legal.mentions.metaTitle` / `metaDescription`. D21 a remplace
 * le composant « document non publie » par le rendu reel du corpus.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.mentions" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default function LegalNoticePage() {
  return <LegalDocumentBody doc="mentions" />;
}
