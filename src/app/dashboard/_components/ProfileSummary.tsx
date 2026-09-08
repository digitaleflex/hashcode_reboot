import * as React from "react";
import {
  Globe,
  Target,
  Clock,
  BookOpen,
} from "lucide-react";
import type { AccountProfile } from "@/app/account/_components/types";

/**
 * Résumé du profil — domaine, niveau, objectif, disponibilité.
 * Server component.
 */
export function ProfileSummary({
  profile,
  member,
}: {
  profile: AccountProfile | null;
  member: { city: string | null; country: string };
}) {
  if (!profile) {
    return (
      <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6">
        <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase mb-4">
          Mon profil
        </h2>
        <p className="text-sm text-muted-foreground">
          Profil en cours de génération…
        </p>
      </section>
    );
  }

  const items = [
    {
      icon: <Globe className="size-4" />,
      label: "Domaine",
      value: profile.domainLabel,
    },
    {
      icon: <BookOpen className="size-4" />,
      label: "Niveau",
      value: profile.levelLabel,
    },
    {
      icon: <Target className="size-4" />,
      label: "Objectif",
      value: profile.goalLabel,
    },
    {
      icon: <Clock className="size-4" />,
      label: "Disponibilité",
      value: profile.availabilityLabel,
    },
  ];

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6">
      <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase mb-4">
        Mon profil
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-muted-foreground shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium truncate">{item.value}</p>
            </div>
          </div>
        ))}
        {member.city && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground shrink-0">
              <Globe className="size-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Localisation</p>
              <p className="text-sm font-medium truncate">
                {member.city}, {member.country}
              </p>
            </div>
          </div>
        )}
      </div>
      {profile.tags.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="flex flex-wrap gap-1.5">
            {profile.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-0.5 text-xs text-muted-foreground mono-label"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
