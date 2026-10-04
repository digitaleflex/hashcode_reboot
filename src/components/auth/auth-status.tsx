"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Surface d'information / confirmation — le pendant positif de `AuthError`.
 *
 * `role="status"` (donc `aria-live="polite"`) : les messages dynamiques
 * (code envoyé, compte à rebours de renvoi, « Connexion réussie. ») sont
 * annoncés sans interrompre la lecture en cours.
 */
export function AuthStatus({
  id,
  tone = "info",
  children,
  className,
}: {
  id?: string;
  tone?: "info" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground",
        tone === "success"
          ? "border-lime/45 bg-lime/[0.06]"
          : "border-border bg-card/50",
        className,
      )}
    >
      <CheckCircle2
        className={cn(
          "mt-px size-4 shrink-0",
          tone === "success" ? "text-lime" : "text-muted-foreground",
        )}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}