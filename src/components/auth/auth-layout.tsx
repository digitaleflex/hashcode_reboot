"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { AuthBrand } from "./auth-brand";
import { AuthProgress } from "./auth-progress";
import { cn } from "@/lib/utils";

/**
 * Entrée en scène : utilitaire CSS maison `.animate-hash-in` (8px de
 * montée + fondu, 320ms), le même que le hero de la landing.
 *
 * Pourquoi CSS et non les primitives `Stagger` / `StaggerItem` : celles-ci
 * rendent le contenu à `opacity: 0` côté serveur et ne le révèlent qu'après
 * le passage de l'IntersectionObserver. Sur un écran de connexion, un
 * formulaire qui reste invisible si l'observateur ne déclenche pas — ou si la
 * détection de mouvement réduit n'est pas encore résolue à l'hydratation —
 * est un échec d'accessibilité, pas un détail. `.animate-hash-in` est
 * explicitement neutralisée par le media query `prefers-reduced-motion` de
 * globals.css : le contenu est alors affiché d'emblée, sans animation.
 */
const RISE = "animate-hash-in";

/** Cascade de 60ms, comme `RebootTitle` sur la landing. */
function rise(delayMs: number): React.CSSProperties {
  return { animationDelay: `${delayMs}ms`, animationFillMode: "both" };
}

/**
 * Coquille partagée par /login et /verify-otp.
 *
 * Choix de mise en page, et pourquoi :
 * - `min-h-dvh` et non `100vh` : sur mobile la barre d'adresse réduit la
 *   hauteur visible, et `dvh` suit la hauteur réelle du viewport (clavier
 *   logiciel compris).
 * - PAS de centrage vertical sur mobile (`items-start`) : quand le clavier
 *   s'ouvre, un bloc centré verticalement se fait rogner par le bas et le CTA
 *   devient inatteignable. À partir de `sm` on recentre, car il n'y a plus de
 *   clavier à ce niveau de confort.
 * - Colonne `max-w-[420px]` : une ligne de formulaire au-delà devient difficile
 *   à parcourir à l'œil. Jamais plus large, quelle que soit la taille d'écran.
 * - Le contenu entre une seule fois à l'affichage (`.animate-hash-in`, 320ms,
 *   cascade de 60ms) : aucune animation permanente, conformément à la
 *   direction visuelle.
 */
export function AuthLayout({
  step,
  title,
  subtitle,
  aside,
  backHref,
  backLabel,
  children,
  className,
}: {
  /** 1 = email, 2 = code. Pilote l'indicateur d'étape. */
  step: 1 | 2;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Ligne secondaire optionnelle sous le titre (ex. adresse masquée). */
  aside?: React.ReactNode;
  /** Destination du lien de retour discret, en haut à gauche. */
  backHref: string;
  /**
   * Libellé du lien de retour. Par défaut « Retour à HASHCODE REBOOT » ;
   * l'étape 2 le remplace par « Utiliser une autre adresse », qui est la
   * seule action utile à ce stade du parcours.
   */
  backLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("auth.common");

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {/* Lumière rasante, très basse opacité : casse le plat du fond noir
          sans jamais devenir un « glow » décoratif. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_65%_100%_at_50%_0%,rgba(197,244,65,0.07),transparent_70%)]"
      />

      <a
        href={`#auth-form`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-lime/60 focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-lime"
      >
        {t("skipToForm")}
      </a>

      <header className="relative border-b border-border/60">
        <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center px-4 sm:h-16 sm:px-6">
          <Link
            href={backHref}
            className="-ml-1 inline-flex min-h-[44px] items-center gap-2 rounded-md px-1 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground focus-lime"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {/* Version courte sous `sm` : le libellé complet tiendrait mal dans
                la barre à 320px et se ferait tronquer. */}
            {backLabel ?? (
              <>
                <span className="sm:hidden">{t("backHomeShort")}</span>
                <span className="hidden sm:inline">{t("backHome")}</span>
              </>
            )}
          </Link>
        </div>
      </header>

      <div className="relative flex flex-1 justify-center px-4 py-9 sm:items-center sm:py-14">
        <div className={cn("w-full max-w-[420px]", className)}>
          <div className={RISE} style={rise(0)}>
            <AuthBrand />
          </div>

          {/* L'indicateur d'étape vit dans la colonne, pas dans la barre :
              c'est une information sur le formulaire, et la barre ne contient
              plus que le lien de retour — pas de débordement à 320px. */}
          <div className={cn(RISE, "mt-6")} style={rise(60)}>
            <AuthProgress step={step} />
          </div>

          <div className={cn(RISE, "mt-6")} style={rise(120)}>
            <h1 className="text-center font-display text-[26px] font-bold leading-tight tracking-tight text-foreground text-balance sm:text-[30px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mx-auto mt-2 max-w-[34ch] text-center text-[15px] leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
            {aside}
          </div>

          <div className={cn(RISE, "mt-6")} style={rise(180)}>
            <div id="auth-form" tabIndex={-1} className="focus:outline-none">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}