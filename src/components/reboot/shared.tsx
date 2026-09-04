"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

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
  size = "md",
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "ghost" | "outline";
}) {
  const sizes = {
    sm: "min-h-[44px] h-11 px-4 text-sm",
    md: "min-h-[44px] h-11 px-5 text-sm",
    lg: "min-h-[48px] h-12 px-6 text-base",
  };
  const variants = {
    primary:
      "bg-lime text-black hover:bg-lime/90 font-medium border border-transparent",
    ghost:
      "bg-transparent text-foreground hover:bg-secondary border border-transparent",
    outline:
      "bg-transparent text-foreground border border-border hover:border-lime/60 hover:text-lime",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-180 focus-lime disabled:opacity-50 disabled:pointer-events-none min-h-[44px] cursor-pointer",
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Arrow used after CTAs (slight italic feel via skew on hover). */
export function CtaArrow({ className }: { className?: string }) {
  return (
    <ArrowRight
      className={cn(
        "size-4 transition-transform duration-180 group-hover:translate-x-0.5",
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
    <p className={cn("eyebrow-mono text-lime flex items-center gap-2.5", className)}>
      <span className="h-px w-6 bg-lime/70 shrink-0" aria-hidden />
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
      <h2 className="mt-3 font-display font-bold text-2xl sm:text-3xl tracking-tight text-foreground text-balance">
        {title}
      </h2>
      {intro && (
        <p className="mt-3 text-muted-foreground text-base sm:text-lg leading-relaxed">
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
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("group", className)}
    >
      <RebootButton size={size} className="w-full sm:w-auto">
        {children}
        <CtaArrow />
      </RebootButton>
    </Link>
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
      : "min-h-[36px]",
    active
      ? "border-lime/60 text-lime bg-lime/5"
      : "border-border text-muted-foreground",
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
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
  return (
    <h1
      className={cn(
        "font-display font-extrabold italic tracking-tight leading-[0.92] text-foreground text-balance break-words text-[clamp(2.75rem,13vw,6rem)] sm:text-7xl lg:text-8xl",
        className,
      )}
    >
      <span
        className="block animate-hash-in"
        style={{ animationDelay: "0ms", animationFillMode: "both" }}
      >
        HASHCODE
      </span>
      <span
        className="block text-lime text-glow-lime mt-1 animate-hash-in"
        style={{ animationDelay: "120ms", animationFillMode: "both" }}
      >
        REBOOT
      </span>
    </h1>
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
