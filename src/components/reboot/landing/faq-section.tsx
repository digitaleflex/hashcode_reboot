"use client";

import { RebootButton, CtaArrow, SectionHeader } from "../shared";
import { Faq } from "./faq";
import { useTranslations } from "next-intl";

export function FaqSection({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: () => void;
  onOpenPrivacy?: () => void;
}) {
  const t = useTranslations("landing.faq");
  return (
    <section
      id="faq"
      className="mx-auto max-w-3xl w-full px-5 sm:px-8 py-16 sm:py-24 scroll-mt-20 cv-auto"
    >
      <SectionHeader
        index={t("index")}
        title={t("title")}
        intro={t("intro")}
        className="mb-8"
      />
      <Faq onOpenPrivacy={onOpenPrivacy} />
      <div className="mt-8 flex justify-center">
        <RebootButton size="lg" onClick={onJoin} className="group w-full sm:w-auto">
          {t("cta")}
          <CtaArrow />
        </RebootButton>
      </div>
    </section>
  );
}