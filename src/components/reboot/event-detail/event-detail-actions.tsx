"use client";

import * as React from "react";
import { CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { InterestButton } from "@/components/reboot/events/interest-button";

/**
 * État d'inscription d'un événement — partagé entre le bloc de CTA en ligne
 * et la barre sticky mobile.
 *
 * Isolé dans `event-detail/` (et non dans `events/`) : la page de détail a
 * été écrite séparément de la refonte de la liste, pour éviter deux
 * propriétaires sur les mêmes fichiers.
 *
 * Le stockage local et la déduplication du signal d'intérêt reprennent ceux
 * de la liste (même clé, même règle « une seule émission »), afin qu'un
 * visiteur ayant déclaré son intérêt depuis la liste retrouve exactement le
 * même état ici.
 */

const INTEREST_STORAGE_KEY = "hashcode:event-interest";

function readInterested(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INTEREST_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeInterested(ids: string[]) {
  try {
    window.localStorage.setItem(INTEREST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* stockage indisponible : la déduplication est best-effort */
  }
}

export interface EventSignupState {
  myRsvp: string | null;
  interestCount: number;
  interested: boolean;
  pending: boolean;
  onInterest: (eventId: string, nextActive: boolean) => void;
  onRsvp: (status: "going" | "maybe") => void;
  /** Libellé + variante du CTA primaire, dérivés de l'état. */
  primary: { label: string; icon: "users" | "check"; disabled: boolean; active: boolean };
}

export function useEventSignup({
  eventId,
  initialMyRsvp,
  initialInterestCount,
  isFull,
}: {
  eventId: string;
  initialMyRsvp: string | null;
  initialInterestCount: number;
  isFull: boolean;
}): EventSignupState {
  const [myRsvp, setMyRsvp] = React.useState<string | null>(initialMyRsvp);
  const [interestCount, setInterestCount] = React.useState(initialInterestCount);
  const [interested, setInterested] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  // Ids pour lesquels le signal a DÉJÀ été émis. Le toggle est réversible
  // côté UI, mais on n'émet qu'une fois par navigateur et par événement :
  // sinon `interestCount` gonflerait à chaque aller-retour.
  const signalled = React.useRef<Set<string> | null>(null);

  React.useEffect(() => {
    const ids = readInterested();
    setInterested(ids.includes(eventId));
    signalled.current = new Set(ids);
  }, [eventId]);

  const onInterest = React.useCallback((id: string, nextActive: boolean) => {
    setInterested((isActive) => {
      if (nextActive === isActive) return isActive;
      const next = nextActive
        ? [...new Set([...readInterested(), id])]
        : readInterested().filter((x) => x !== id);
      writeInterested(next);
      setInterestCount((c) => Math.max(0, c + (nextActive ? 1 : -1)));
      if (nextActive && !signalled.current?.has(id)) {
        signalled.current?.add(id);
        track({ type: "event_interest", ref: id });
      }
      return nextActive;
    });
  }, []);

  const onRsvp = React.useCallback(
    async (status: "going" | "maybe") => {
      const next = myRsvp === status ? null : status;
      setPending(true);
      setMyRsvp(next);
      try {
        if (next === null) {
          await fetch(`/api/events/${eventId}/rsvp`, { method: "DELETE" });
        } else {
          await fetch(`/api/events/${eventId}/rsvp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next }),
          });
        }
        track({ type: "event_rsvp", ref: eventId });
      } catch {
        setMyRsvp(myRsvp);
      } finally {
        setPending(false);
      }
    },
    [eventId, myRsvp],
  );

  const primary: EventSignupState["primary"] =
    myRsvp === "going"
      ? { label: "Inscrit · Annuler", icon: "check", disabled: pending, active: true }
      : myRsvp === "maybe"
        ? { label: "Peut-être · Annuler", icon: "check", disabled: pending, active: true }
        : { label: isFull ? "Complet" : "Je participe", icon: "users", disabled: pending || isFull, active: false };

  return { myRsvp, interestCount, interested, pending, onInterest, onRsvp, primary };
}

/* ── Boutons (présentational : l'état vient du hook) ─────────────────────── */

const BASE =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md px-4 text-sm font-medium leading-none transition-colors duration-150 focus-lime cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

function PrimaryIcon({ icon }: { icon: "users" | "check" }) {
  return icon === "check" ? (
    <CheckCircle2 className="size-4" aria-hidden />
  ) : (
    <Users className="size-4" aria-hidden />
  );
}

export function SignupButtons({
  state,
  isAuthed,
  onJoin,
  size = "block",
}: {
  state: EventSignupState;
  isAuthed: boolean;
  onJoin: () => void;
  size?: "block" | "bar";
}) {
  if (!isAuthed) {
    return (
      <button
        type="button"
        onClick={onJoin}
        className={cn(BASE, "bg-lime text-background hover:bg-lime/90", size === "block" && "w-full")}
      >
        Créer mon profil pour m&apos;inscrire
      </button>
    );
  }

  return (
    <div className={cn("flex gap-2", size === "block" && "flex-col")}>
      <button
        type="button"
        onClick={() => void state.onRsvp(state.myRsvp === "maybe" ? "maybe" : "going")}
        disabled={state.primary.disabled}
        className={cn(
          BASE,
          "flex-1",
          state.primary.active
            ? "border border-lime/50 bg-lime/10 text-lime hover:bg-lime/20"
            : "bg-lime text-background hover:bg-lime/90",
        )}
      >
        <PrimaryIcon icon={state.primary.icon} />
        {state.primary.label}
      </button>

      {state.myRsvp !== "going" && (
        <button
          type="button"
          onClick={() => void state.onRsvp("maybe")}
          disabled={state.pending}
          className={cn(
            BASE,
            "flex-1 border border-border text-foreground hover:border-lime/50 hover:text-lime",
          )}
        >
          Peut-être
        </button>
      )}
    </div>
  );
}

export function InterestControl({
  state,
  eventId,
  eventTitle,
  className,
}: {
  state: EventSignupState;
  eventId: string;
  eventTitle: string;
  className?: string;
}) {
  return (
    <InterestButton
      eventId={eventId}
      eventTitle={eventTitle}
      active={state.interested}
      count={state.interestCount}
      onToggle={state.onInterest}
      className={className}
    />
  );
}