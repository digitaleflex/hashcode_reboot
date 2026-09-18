"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQS } from "./data";

/* ------------------------------------------------------------------ */
/* FAQ — accordion using shadcn/ui Accordion                           */
/* ------------------------------------------------------------------ */

export function Faq({ onOpenPrivacy }: { onOpenPrivacy?: () => void }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {FAQS.map((f, i) => {
        const isPrivacy = f.q.includes("protégées");
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
                    Voir la politique de confidentialité
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
