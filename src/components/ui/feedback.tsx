import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/* ============================================================================
   Feedback — banniere d'etat du parcours
   landing -> diagnostic -> capture -> conversion.
   ADDITIF DS-127 : ne modifie aucun variant existant (button/badge/alert
   shadcn intouches). Roles ARIA : "alert" pour error/warning (annonce
   immediate), "status" pour info/success/loading (annonce polie).
   Tokens : --card/--border/--primary/--destructive/--chart-3, utilitaires
   .ds-state-* (globals.css §4 DS-127). Voir docs/design-system-reboot.md.
   ============================================================================ */

const feedbackVariants = cva(
  "relative flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm",
  {
    variants: {
      tone: {
        info: "bg-card text-card-foreground",
        success:
          "bg-card text-card-foreground ds-state-success [&_svg]:text-primary",
        warning:
          "bg-card text-card-foreground ds-state-error [&_svg]:text-[var(--chart-3)]",
        error:
          "bg-card text-card-foreground ds-state-error [&_svg]:text-destructive",
        loading: "bg-card text-card-foreground ds-loading-bar",
      },
    },
    defaultVariants: {
      tone: "info",
    },
  }
)

const toneIcon = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  loading: Loader2,
} as const

type FeedbackTone = keyof typeof toneIcon

function Feedback({
  className,
  tone = "info",
  title,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof feedbackVariants> & {
    tone?: FeedbackTone
    title?: string
  }) {
  const Icon = toneIcon[tone ?? "info"]
  const isAlert = tone === "error" || tone === "warning"
  return (
    <div
      data-slot="feedback"
      data-tone={tone}
      role={isAlert ? "alert" : "status"}
      aria-busy={tone === "loading" ? true : undefined}
      className={cn(feedbackVariants({ tone }), className)}
      {...props}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "loading" && "animate-spin"
        )}
        aria-hidden
      />
      <div className="grid min-w-0 flex-1 justify-items-start gap-0.5">
        {title ? (
          <p className="font-medium tracking-tight">{title}</p>
        ) : null}
        <div className="text-muted-foreground text-sm [&_p]:leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}

export { Feedback, feedbackVariants }
