"use client";

import { MonoLabel, SectionHeader } from "../shared";
import { cn } from "@/lib/utils";
import { COMING } from "./data";
import { useTranslations } from "next-intl";

export function Coming() {
  const t = useTranslations("landing.coming");
  const comingItems = t.raw("items") as Array<{ t: string; d: string; status: string }>;
  return (
    <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-16 sm:py-24 cv-auto">
      <SectionHeader
        index={t("index")}
        title={t("title")}
        intro={t("intro")}
        className="mb-10"
      />
      <ol className="relative grid gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
        {comingItems.map((c, i) => {
          const originalItem = COMING[i];
          return (
            <li
              key={c.t}
              className="bg-card p-6 sm:p-7 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 items-start"
            >
              <MonoLabel className={cn(originalItem.live ? "text-lime" : "text-muted-foreground")}>
                {String(i + 1).padStart(2, "0")}
              </MonoLabel>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-semibold text-foreground">
                    {c.t}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium tracking-[0.01em] leading-none",
                      originalItem.live
                        ? "border-lime/60 text-lime bg-lime/10"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {originalItem.live && (
                      <span className="mr-1.5 size-1.5 rounded-full bg-lime animate-hash-pulse" aria-hidden />
                    )}
                    {c.status}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm mt-1">{c.d}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}