"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { GeneratedProfile } from "@/lib/profiling/types";
import { HashSymbol } from "@/components/brand/logo";
import { MonoLabel, Tag } from "./shared";

/**
 * The HASHCODE profile card — the "reward" for completing the flow.
 * Engineered, not a generic SaaS confirmation. Resembles an ID card.
 */
export function ProfileCard({
  profile,
  goal,
  firstName,
  variant = "default",
}: {
  profile: GeneratedProfile;
  goal?: string;
  firstName?: string;
  variant?: "default" | "compact";
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Domaine", value: profile.domainLabel },
    { label: "Niveau", value: profile.levelLabel },
    { label: "Objectif", value: profile.goalLabel },
    { label: "Rythme", value: profile.availabilityLabel },
    { label: "Style", value: profile.styleLabel },
    { label: "Mentorat", value: profile.mentoringLabel },
  ];

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-card overflow-hidden lift-on-hover",
        variant === "default" && "p-6 sm:p-7",
      )}
    >
      {/* Top hairline + corner ticks (engineered motif) */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime/70 to-transparent" />
      <div className="absolute top-2 left-2 text-lime/50 mono-label text-[8px]">
        ┌
      </div>
      <div className="absolute top-2 right-2 text-lime/50 mono-label text-[8px]">
        ┐
      </div>
      {/* Bottom-left lime glow (subtle depth) */}
      <div
        className="absolute -bottom-12 -left-12 size-32 rounded-full blur-3xl opacity-[0.05] pointer-events-none"
        style={{ background: "var(--primary)" }}
        aria-hidden
      />

      <div className={cn(variant === "compact" && "p-5 sm:p-6")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-lime">
              <HashSymbol size={28} />
            </span>
            <MonoLabel className="text-muted-foreground">
              {firstName ? `Profil · ${firstName}` : "Profil HASHCODE"}
            </MonoLabel>
          </div>
          {/* Archetype badge ribbon — premium stamp */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-lime/40 bg-lime/5 text-lime mono-label text-[9px]">
            <span className="size-1 rounded-full bg-lime animate-hash-pulse" aria-hidden />
            REBOOT
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden>
            {profile.archetypeEmoji}
          </span>
          <h3 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-foreground italic">
            {profile.archetype}
          </h3>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
          {rows.map((r) => (
            <div key={r.label}>
              <MonoLabel className="text-muted-foreground">{r.label}</MonoLabel>
              <div className="mt-0.5 text-sm sm:text-base text-foreground font-medium leading-snug">
                {r.value}
              </div>
            </div>
          ))}
        </div>

        {goal && (
          <div className="mt-5 pt-5 border-t border-border/70">
            <MonoLabel className="text-muted-foreground">
              Objectif à 3 mois
            </MonoLabel>
            <p className="mt-1 text-foreground italic font-display text-base leading-snug">
              « {goal} »
            </p>
          </div>
        )}

        {profile.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {profile.tags.slice(0, 8).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}
      </div>

      {/* Bottom hairline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
    </div>
  );
}
