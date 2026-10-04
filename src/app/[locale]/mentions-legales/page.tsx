import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PendingLegalDocument } from "@/components/reboot/legal/pending-document";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legalPending" });
  return {
    title: `${t("docs.mentions.title")}${t("metaTitleSuffix")}`,
    description: t("metaDescription"),
  };
}

export default function LegalNoticePage() {
  return <PendingLegalDocument doc="mentions" />;
}