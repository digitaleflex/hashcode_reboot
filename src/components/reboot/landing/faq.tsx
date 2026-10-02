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
  const faqItems = t.raw("items") as Array<{ q: string; a: string }>;
  return (
    <Accordion type="single" collapsible className="w-full">
      {faqItems.map((f, i) => {
        // La question sur la protection des données est toujours la 6ème (index 5)
        const isPrivacy = i === 5;
        return (
          <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
            <AccordionTrigger className="min-h-[56px] text-left font-display font-medium text-base sm:text-lg text-foreground hover:text-lime transition-colors py-4 hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm sm:text-base text-muted-foreground leading-relaxed pb-4">
              {f.a}
              {isPrivacy && onOpenPrivacy && (
                <>
                  {" "}
                  <button
                    onClick={onOpenPrivacy}
                    className="min-h-[44px] px-1 -mx-1 inline-flex items-center text-lime hover:text-lime/80 underline underline-offset-4 focus-lime"
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