"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2 } from "lucide-react";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { useTranslations } from "next-intl";

/* ============================================================
   HASHCODE REBOOT — shared brand primitives
   Engineered, not decorated. Lime is rare.
   ============================================================ */

/** Primary CTA — lime, dark text, hairline border, slight italic arrow. */
export function RebootButton({
  children,
  onClick,
  className,
  type = "button",
  disabled,
  loading = false,
  size = "md",
  variant = "primary",
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  /** État d'attente : désactive l'action, affiche un spinner et pose `aria-busy`. */
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "ghost" | "outline";
  /** Nom accessible explicite quand plusieurs CTA partagent le même libellé. */
  ariaLabel?: string;
}) {
  // Tailles et variantes portées par `buttonVariants` (shadcn) ; on n'ajoute
  // ici que la signature de marque : relief lumineux sur le primaire, verre
  // sur le secondaire, focus unifié via `.focus-lime`.
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={cn(
        buttonVariants({ variant: variant === "primary" ? "default" : variant === "outline" ? "outline" : "ghost", size: size === "lg" ? "lg" : size === "md" ? "default" : "sm" }),
        "min-h-[44px] rounded-full focus-lime",
        variant === "primary" &&
          "bg-primary text-primary-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(0,0,0,0.4)] hover:bg-primary/95 active:bg-primary/85",
        variant === "outline" &&
          "border border-[var(--line-strong)] bg-white/[0.03] backdrop-blur-sm hover:border-lime/60 hover:bg-lime/[0.06] hover:text-foreground active:border-lime/70",
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Arrow used after CTAs (slight italic feel via skew on hover). */
export function CtaArrow({ className }: { className?: string }) {
  return (
    <ArrowRight className={cn(
        "size-6 transition-transform duration-200 group-hover:translate-x-0.5",
        className,
      )}
      strokeWidth={2.2}
    />
  );
}

/** Mono section label — discret, éditorial. Casse naturelle, tracking doux. */
export function MonoLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("mono-label", className)}>{children}</span>;
}

/** Eyebrow éditorial — un seul par écran. Lime, 12.5px, tracking doux, sans uppercase forcé. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("eyebrow-mono text-lime inline-flex items-center gap-2.5", className)}>
      <span className="chip__dot shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Section header with eyebrow + title. Eyebrow en casse douce, pas en capitales. */
export function SectionHeader({
  index,
  title,
  intro,
  className,
}: {
  index: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <Eyebrow>{index}</Eyebrow>
      <h2 className="mt-4 ds-h2 text-gradient text-balance">
        {title}
      </h2>
      {intro && (
        <p className="mt-3 ds-lead text-muted-foreground">
          {intro}
        </p>
      )}
    </div>
  );
}

/** Hairline divider. */
export function Hairline({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

/** External link that opens WhatsApp/community safely. */
export function ExternalCta({
  href,
  children,
  className,
  size = "lg",
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}) {
  const sizes = {
    sm: "min-h-[44px] h-11 min-w-[44px] px-4 text-sm",
    md: "min-h-[44px] h-11 min-w-[44px] px-5 text-sm",
    lg: "min-h-[48px] h-12 min-w-[48px] px-6 text-base",
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus-lime bg-lime text-black border border-transparent cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] hover:-translate-y-px hover:shadow-[0_8px_32px_rgba(197,244,65,0.28)] active:translate-y-0",
        sizes[size],
        "w-full sm:w-auto",
        className,
      )}
    >
      {children}
      <CtaArrow />
    </a>
  );
}

/** Tag chip — humain, lisible : 13px, casse naturelle, tracking quasi nul.
 *  Renders a <button> when onClick is provided (44px min touch target). */
export function Tag({
  children,
  className,
  active,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const cls = cn(
    "inline-flex items-center rounded-full border px-3.5 py-2 text-[13px] font-medium tracking-[0.01em] leading-none transition-colors focus-lime",
    onClick
      ? "min-h-[44px] cursor-pointer hover:border-lime/60 hover:text-foreground hover:bg-lime/5 active:bg-lime/10"
      : // Étiquette statique : pas une cible tactile, inutile de lui imposer 44px.
        "min-h-8 py-1.5",
    active
      ? "border-lime/60 text-lime bg-lime/5"
      : "border-border text-muted-foreground",
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} aria-pressed={!!active}>
        {children}
      </button>
    );
  }
  return <span className={cls}>{children}</span>;
}

/** Big italic display wordmark block for hero.
 *  Staggered entrance: HASHCODE slides in first, REBOOT follows 120ms later.
 *  Clamp + balance keeps it clean on 360px without overflow. */
export function RebootTitle({
  className,
}: {
  className?: string;
}) {
  const t = useTranslations("landing.hero");
  return (
    <h1
      className={cn(
        "ds-display text-foreground text-balance break-words",
        className,
      )}
    >
      <span
        className="block animate-hero-rise"
        style={{ animationDelay: "0ms", animationFillMode: "both" }}
      >
        {t("brandTitle1")}
      </span>
      <span
        className="block text-lime text-glow-lime mt-1 animate-hero-rise"
        style={{ animationDelay: "120ms", animationFillMode: "both" }}
      >
        {t("brandTitle2")}
      </span>
    </h1>
  );
}

/** Simple card — rounded border, subtle bg. For flat containers only (no divide-y, no max-h). */
export function Card({
  className,
  children,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card/40 p-6", className)} {...rest}>
      {children}
    </div>
  );
}

/** Small inline H motif used as a bullet/connector. */
export function HashBullet({ className }: { className?: string }) {
  return (
    <span className={cn("text-lime inline-block", className)} aria-hidden>
      ✦
    </span>
  );
}

// Re-export des nouveaux composants d'accessibilité
export { EmptyState, EmptyMembers, EmptyEvents, EmptyWorkshops, EmptySearch, EmptyInvitations, OfflineState, SuccessState } from "./shared/EmptyState";
export { SkipLink, SkipToNavigation, SkipLinks } from "./shared/SkipLink";