"use client";

import * as React from "react";
import { PublicEvents } from "@/components/reboot/public-events";
import { EventsHeader } from "./events/events-header";
import { EventsHero } from "./events/events-hero";
import { EventsFooter } from "./events/events-footer";
import type { PublicEvent } from "./events/types";

/**
 * Enveloppe de la page publique /evenements : header + hero + liste
 * interactive + footer.
 *
 * `onJoin` ne peut pas venir du serveur (fonction non sérialisable), d'où
 * cette frontière cliente. Le contenu, lui, est rendu côté serveur via
 * `initialEvents` : la page reste lisible et indexable sans JavaScript.
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
  initialEvents?: PublicEvent[];
  /** true si la requête serveur a abouti (évite un spinner infini sans JS). */
  initialLoaded?: boolean;
}) {
  const handleJoin = React.useCallback(() => {
    window.location.assign("/");
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-lime/60 focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-lime"
      >
        Aller au contenu
      </a>

      <EventsHeader isAuthed={isAuthed} onJoin={handleJoin} />

      <main id="contenu" className="flex-1 focus:outline-none">
        <div className="mx-auto w-full max-w-[1120px] px-5 sm:px-6">
          <EventsHero events={initialEvents} isAuthed={isAuthed} firstName={firstName} />
          <PublicEvents
            isAuthed={isAuthed}
            firstName={firstName}
            onJoin={handleJoin}
            initialEvents={initialEvents}
            initialLoaded={initialLoaded}
          />
        </div>
      </main>

      <EventsFooter />
    </div>
  );
}
