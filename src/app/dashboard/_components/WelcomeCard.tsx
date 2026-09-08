import * as React from "react";
import { HashSymbol } from "@/components/brand/logo";
import {
  STATUS_STYLES,
  type AccountProfile,
  type AccountStatus,
} from "@/app/account/_components/types";

/**
 * Carte de bienvenue — prénom + archétype + badge statut.
 * Server component.
 */
export function WelcomeCard({
  firstName,
  profile,
  status,
}: {
  firstName: string;
  profile: AccountProfile | null;
  status: AccountStatus;
}) {
  const style = STATUS_STYLES[status.profileStatus];

  return (
    <header className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-7">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="text-lime shrink-0">
            <HashSymbol size={40} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
              Bonjour {firstName}
            </h1>
            {profile ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="mr-1">{profile.archetypeEmoji}</span>
                <span className="text-foreground font-medium">
                  {profile.archetype}
                </span>
                <span className="mx-2 text-border">·</span>
                <span>{profile.domainLabel}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Profil en cours de génération…
              </p>
            )}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium mono-label ${style.badge}`}
        >
          <span className={`inline-block size-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
      </div>
    </header>
  );
}
