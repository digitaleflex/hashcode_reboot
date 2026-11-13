import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "@/components/reboot/legal/legal-document";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legalPending" });
  return {
    title: `${t("docs.privacy.title")}${t("metaTitleSuffix")}`,
    description: t("metaDescription"),
  };
}

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" />;
}