"use client";

import { SectionHeader, Tag } from "../shared";
import { useTranslations } from "next-intl";

export function Audience({ onJoin }: { onJoin: () => void }) {
  const t = useTranslations("landing.audience");
  const audienceItems = t.raw("items") as string[];
  return (
    <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-16 sm:py-24 cv-auto">
      <SectionHeader
        index={t("index")}
        title={t("title")}
        intro={t("intro")}
        className="mb-8"
      />
      <div className="flex flex-wrap gap-2">
        {audienceItems.map((a) => (
          <Tag key={a} onClick={onJoin}>
            {a}
          </Tag>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {t("note")}
      </p>
    </section>
  );
}