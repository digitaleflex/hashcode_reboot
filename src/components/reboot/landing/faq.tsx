"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslations } from "next-intl";

/* ------------------------------------------------------------------ */
/* FAQ — accordion using shadcn/ui Accordion                           */
/* ------------------------------------------------------------------ */

export function Faq({ onOpenPrivacy }: { onOpenPrivacy?: () => void }) {
  const t = useTranslations("landing.faq");
  const faqItems = t.raw("items") as Array<{ id: string; q: string; a: string }>;
  return (
    <Accordion type="single" collapsible className="w-full">
      {faqItems.map((f, i) => {
        // Identification par clé stable, plus par position dans le tableau.
        const isPrivacy = f.id === "privacy";
        return (
          <AccordionItem key={f.id || i} value={f.id || `item-${i}`} className="border-border/60">
            <AccordionTrigger className="min-h-[56px] py-4 text-left font-display text-base font-medium text-foreground transition-colors hover:text-lime hover:no-underline sm:text-lg">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {f.a}
              {isPrivacy && onOpenPrivacy && (
                <>
                  {" "}
                  <button
                    onClick={onOpenPrivacy}
                    className="-mx-1 inline-flex min-h-[44px] items-center px-1 text-lime underline underline-offset-4 transition-colors hover:text-lime/80 focus-lime"
                  >
                    {t("privacyLink")}
                  </button>
                </>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}