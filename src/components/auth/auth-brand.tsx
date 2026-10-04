"use client";

import * as React from "react";
import { HashSymbol } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * Bloc de marque des écrans d'auth.
 *
 * UN seul lockup : le symbole « H » shearé + le wordmark HASHCODE / REBOOT,
 * empilés et centrés. L'ancienne version affichait en plus un `HashSymbol`
 * dans le corps de la page EN PLUS du `Logo` dans le header — deux marques
 * dans un écran de 400px, donc illisible.
 *
 * Le symbole est rendu ici (et non via `Logo`) pour choisir sa taille
 * indépendamment de celle du wordmark : 40px, lisible dès 320px.
 * La pile tient dans ~150px de large, donc aucun débordement à 320px.
 */
export function AuthBrand({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col items-center gap-3", className)}
      // Le nom accessible est porté par le role + aria-label : le texte du
      // wordmark est ainsi lu une seule fois par les lecteurs d'écran.
      role="img"
      aria-label="HASHCODE REBOOT"
    >
      <span className="text-lime">
        <HashSymbol size={40} />
      </span>
      <span className="inline-flex flex-col items-center leading-none">
        <span className="wordmark-italic font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          HASHCODE
        </span>
        <span className="mt-1.5 inline-flex items-center gap-2">
          <span className="wordmark-tracking font-display text-[11px] font-medium uppercase text-lime">
            REBOOT
          </span>
          <span className="block h-px w-8 bg-lime/80" aria-hidden="true" />
        </span>
      </span>
    </div>
  );
}