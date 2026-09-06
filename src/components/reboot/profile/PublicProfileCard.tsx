"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { HashSymbol } from "@/components/brand/logo";
import { MonoLabel } from "../shared";

export interface PublicProfile {
  id: string;
  firstName: string;
  archetype: string;
  domain: string;
  level: string;
  goal: string;
  availability: string;
  mentoring: string | null;
  threeMonthGoal: string | null;
  tags: string[];
  accessLane: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  web: "Web Development",
  cybersecurity: "Cybersecurity",
  ai: "Applied AI",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratique",
  autonomous: "Autonome",
  advanced: "Avancé",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  fulltime: "Temps plein",
  parttime: "Temps partiel",
  weekends: "Weekends",
  evenings: "Soirs",
};

export function PublicProfileCard({ profile }: { profile: PublicProfile }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime/70 to-transparent" />

      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-lime">
              <HashSymbol size={32} />
            </span>
            <div>
              <MonoLabel className="text-muted-foreground">Profil public</MonoLabel>
              <h1 className="text-2xl sm:text-3xl font-display font-bold italic text-foreground mt-1">
                {profile.firstName}
              </h1>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-lime/40 bg-lime/5 text-lime mono-label text-xs">
            <span className="size-1.5 rounded-full bg-lime animate-pulse" />
            HASHCODE
          </span>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl" aria-hidden>
              #
            </span>
            <h2 className="text-xl sm:text-2xl font-display font-bold italic text-lime">
              {profile.archetype}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 rounded-md bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Domaine</p>
            <p className="font-medium text-sm">
              {DOMAIN_LABELS[profile.domain] ?? profile.domain}
            </p>
          </div>
          <div className="p-3 rounded-md bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Niveau</p>
            <p className="font-medium text-sm">
              {LEVEL_LABELS[profile.level] ?? profile.level}
            </p>
          </div>
          <div className="p-3 rounded-md bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Disponibilité</p>
            <p className="font-medium text-sm">
              {AVAILABILITY_LABELS[profile.availability] ?? profile.availability}
            </p>
          </div>
          <div className="p-3 rounded-md bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Objectif</p>
            <p className="font-medium text-sm">{profile.goal}</p>
          </div>
        </div>

        {profile.mentoring && (
          <div className="mb-6 p-4 rounded-md bg-lime/5 border border-lime/20">
            <p className="text-xs text-lime mb-1 font-medium mono-label">Ouvert au mentorat</p>
            <p className="text-sm text-foreground">{profile.mentoring}</p>
          </div>
        )}

        {profile.threeMonthGoal && (
          <div className="mb-6">
            <p className="text-xs text-muted-foreground mb-2">Objectif 3 mois</p>
            <p className="text-sm text-foreground">{profile.threeMonthGoal}</p>
          </div>
        )}

        {profile.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-xs rounded-sm bg-muted text-muted-foreground border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border/60 bg-muted/20">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-lime hover:underline"
        >
          ← Rejoins le réseau HASHCODE
        </a>
      </div>
    </div>
  );
}
