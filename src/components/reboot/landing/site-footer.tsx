"use client";

import { Logo } from "@/components/brand/logo";
import { scrollToId } from "./scroll";
import { SocialProofBar } from "./social-proof";

export function SiteFooter({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: () => void;
  onOpenPrivacy?: () => void;
}) {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background pb-24">
      {/* Social proof stats bar — modeste et crédible */}
      <SocialProofBar />
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 grid gap-6 sm:grid-cols-3 items-start">
        <div className="space-y-3">
          <Logo variant="full" size="sm" />
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            La nouvelle communauté dev, cyber &amp; IA. Ton premier
            challenge t’attend cette semaine, où que tu sois.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-1">
          <p className="text-sm font-semibold text-foreground">Liens</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              <button
                onClick={onJoin}
                className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
              >
                Construire mon profil
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToId("axes")}
                className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
              >
                Voir les 3 axes
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToId("faq")}
                className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
              >
                Questions fréquentes
              </button>
            </li>
          </ul>
        </div>
        <div className="space-y-2 sm:text-right">
          <p className="text-sm font-semibold text-foreground sm:text-right">Confidentialité</p>
          <p className="text-sm text-muted-foreground max-w-xs sm:ml-auto leading-relaxed">
            Minimum nécessaire, zéro revente, zéro pub. Suppression en
            1 message, à tout moment.
          </p>
          <button
            onClick={onOpenPrivacy}
            className="min-h-[44px] text-sm text-lime hover:text-lime/80 transition-colors focus-lime inline-flex items-center gap-1 sm:justify-end"
          >
            Lire la politique complète →
          </button>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[12px] tracking-[0.06em] text-muted-foreground">
            © 2026 Hashcode · Reboot
          </span>
          <span className="text-[12px] tracking-[0.06em] text-muted-foreground">
            Née au Bénin · Ouverte à toutes et tous
          </span>
        </div>
      </div>
    </footer>
  );
}
