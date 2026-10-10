"use client";

import { cn } from "@/lib/utils";

/**
 * Skip Link — Accessibilité WCAG 2.4.1 (Level A)
 * 
 * Permet aux utilisateurs clavier/lecteurs d'écran de sauter
 * directement au contenu principal.
 * 
 * Doit être le PREMIER élément focusable dans <body>.
 */
export function SkipLink({
  targetId = "main-content",
  label = "Aller au contenu principal",
  className,
}: {
  targetId?: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "sr-only focus:not-sr-only",
        "fixed top-4 left-4 z-[100]",
        "inline-flex items-center gap-2 rounded-md",
        "bg-lime px-4 py-2.5 text-sm font-medium text-black",
        "shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "transition-colors",
        className
      )}
    >
      {label}
    </a>
  );
}

/**
 * Variante pour sauter à la navigation principale
 */
export function SkipToNavigation({
  targetId = "main-navigation",
  label = "Aller à la navigation",
  className,
}: {
  targetId?: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "sr-only focus:not-sr-only",
        "fixed top-4 left-4 z-[100]",
        "inline-flex items-center gap-2 rounded-md",
        "bg-blue-500 px-4 py-2.5 text-sm font-medium text-white",
        "shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "transition-colors",
        className
      )}
    >
      {label}
    </a>
  );
}

/**
 * Groupe de skip links (contenu + navigation)
 * À placer au tout début de <body> dans layout.tsx
 */
export function SkipLinks({
  contentTargetId = "main-content",
  navigationTargetId = "main-navigation",
  className,
}: {
  contentTargetId?: string;
  navigationTargetId?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)} role="list" aria-label="Liens d'évitement">
      <SkipLink targetId={contentTargetId} />
      <SkipToNavigation targetId={navigationTargetId} />
    </div>
  );
}