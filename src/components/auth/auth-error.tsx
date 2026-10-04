"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Surface d'erreur unique, partagée par les deux étapes.
 *
 * - `role="alert"` : annoncée immédiatement par les lecteurs d'écran.
 * - Icône + texte : l'erreur n'est JAMAIS signalée par la couleur seule
 *   (exigence WCAG 1.4.1). Le texte reste en `text-foreground` (contraste AA
 *   sur fond sombre) ; le rouge est porté par l'icône et la bordure.
 * - L'identifiant est transmis par l'appelant et relié au champ via
 *   `aria-describedby` + `aria-invalid`.
 */
export function AuthError({
  id,
  children,
  className,
}: {
  /** id à référencer depuis `aria-describedby` du champ concerné. */
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-destructive/45 bg-destructive/[0.06] px-3 py-2.5",
        "text-[13.5px] leading-relaxed text-foreground",
        className,
      )}
    >
      <CircleAlert
        className="mt-px size-4 shrink-0 text-destructive"
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}