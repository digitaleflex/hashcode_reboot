"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { RebootButton } from "@/components/reboot/shared";
import { PublicEvents } from "@/components/reboot/public-events";
import { cn } from "@/lib/utils";

/**
 * Enveloppe cliente de la page publique /evenements : header public + liste
 * interactive. `onJoin` ne peut pas venir du serveur (fonction non sérialisable),
 * d'où cette frontière cliente.
 */
export function PublicEventsPage({
  isAuthed,
  firstName,
  initialEvents = [],
  initialLoaded = false,
}: {
  isAuthed: boolean;
  firstName?: string | null;
  /** Événements pré-rendus côté serveur (SEO + affichage sans JS). */
  initialEvents?: React.ComponentProps<typeof PublicEvents>["initialEvents"];
  /** true si la requête serveur a abouti (évite un spinner infini sans JS). */
  initialLoaded?: boolean;
}) {
  const handleJoin = React.useCallback(() => {
    window.location.assign("/");
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="shrink-0 focus-lime" aria-label="HASHCODE — accueil">
            <Logo variant="full" size="sm" />
          </Link>

          <nav className="flex items-center gap-4" aria-label="Navigation">
            <Link
              href="/evenements"
              aria-current="page"
              className={cn(
                "hidden sm:inline-flex min-h-[44px] items-center text-sm text-lime transition-colors",
              )}
            >
              Événements
            </Link>
            <Link
              href="/#axes"
              className="hidden md:inline-flex min-h-[44px] items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Axes
            </Link>
            <Link
              href="/#faq"
              className="hidden md:inline-flex min-h-[44px] items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              FAQ
            </Link>
            {isAuthed ? (
              <Link
                href="/dashboard"
                className="min-h-[44px] inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Mon espace
              </Link>
            ) : (
              <Link
                href="/login"
                className="min-h-[44px] inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Se connecter
              </Link>
            )}
            {!isAuthed && (
              <RebootButton size="md" onClick={handleJoin} className="hidden sm:inline-flex">
                Rejoindre
              </RebootButton>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-14">
          <PublicEvents
            isAuthed={isAuthed}
            firstName={firstName}
            onJoin={handleJoin}
            initialEvents={initialEvents}
            initialLoaded={initialLoaded}
          />
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-3">
          <span className="mono-label">
            HASHCODE · REBOOT — Édition 2026
          </span>
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-lime transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </footer>
    </div>
  );
}
