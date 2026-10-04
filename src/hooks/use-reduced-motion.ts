"use client";

import { useSyncExternalStore } from "react";

/**
 * Hook pour détecter prefers-reduced-motion
 * Respecte le choix utilisateur au niveau OS/navigateur.
 *
 * Implémenté sur `useSyncExternalStore` plutôt que `useState` + `useEffect` :
 * la media query est une source externe, et `useState` dans un effet
 * provoquait un rendu en cascade (`react-hooks/set-state-in-effect`).
 *
 * - `getServerSnapshot` renvoie `false` : côté serveur on suppose que le
 *   mouvement est autorisé, ce qui garantit un HTML initial identique sur
 *   les deux rendus (pas de déshydratation).
 * - L'abonnement est mis en place et démonté par React, sans effet manuel.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia(QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(QUERY).matches;
}

/** Snapshot serveur : toujours `false` (pas de divergence au premier rendu). */
function getServerSnapshot() {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}