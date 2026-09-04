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
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-base",
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
        "inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-180 focus-lime disabled:opacity-50 disabled:pointer-events-none",
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

/** Mono section label — engineered metadata feel. */
export function MonoLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("mono-label", className)}>{children}</span>;
}

/** Section header with mono index + title. */
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
      <MonoLabel className="text-lime">{index}</MonoLabel>
      <h2 className="mt-3 font-display font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
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

/** Tag chip — neutral, hairline, mono. */
export function Tag({
  children,
  className,
  active,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs mono-label !tracking-wider",
        active
          ? "border-lime/60 text-lime bg-lime/5"
          : "border-border text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Big italic display wordmark block for hero.
 * Staggered entrance: HASHCODE slides in first, REBOOT follows 120ms later. */
export function RebootTitle({
  className,
}: {
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "font-display font-extrabold italic tracking-tight leading-[0.92] text-foreground",
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
