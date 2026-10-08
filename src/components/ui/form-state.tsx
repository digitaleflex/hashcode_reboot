import * as React from "react"

import { cn } from "@/lib/utils"

/* ============================================================================
   form-state — micro-composants d'etat pour les formulaires de capture
   (diagnostic -> capture -> conversion : email, OTP, RSVP, profil).
   ADDITIF DS-127 : ne modifie ni Input ni Form shadcn. A associer aux champs
   via aria-describedby (ex. <Input aria-describedby={...} aria-invalid />).
   Tokens : --muted-foreground (hint), --destructive (error),
   --primary (success). Voir docs/design-system-reboot.md.
   ============================================================================ */

function FieldHint({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-hint"
      className={cn(
        "text-muted-foreground text-[13px] leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

function FieldError({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn(
        "text-destructive text-[13px] font-medium leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

function FieldSuccess({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-success"
      role="status"
      className={cn(
        "text-[13px] font-medium leading-relaxed text-primary",
        className
      )}
      {...props}
    />
  )
}

export { FieldHint, FieldError, FieldSuccess }
