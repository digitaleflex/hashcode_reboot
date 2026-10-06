import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocumentBody } from "@/components/reboot/legal/legal-document";

/**
 * /confidentialite — Politique de confidentialite.
 *
 * Le texte vient de `legal.privacy` (titre, sous-titre, sections), les
 * metadonnees de `legal.privacy.metaTitle` / `metaDescription`. D21 a remplace le
 * composant « document non publie » par le rendu reel du corpus.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default function PrivacyPage() {
  return <LegalDocumentBody doc="privacy" />;
}
