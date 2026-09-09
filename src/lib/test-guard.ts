import { NextResponse } from "next/server";

/**
 * test-guard.ts — Empêche les writes en production quand TESTING=1.
 *
 * Utilisation dans une route :
 *   import { blockIfTesting } from "@/lib/test-guard";
 *   const blocked = blockIfTesting();
 *   if (blocked) return blocked;
 *
 * En prod (Vercel) : TESTING n'est pas défini → aucune action.
 * En test (integration) : TESTING=1 → retourne 403 et bloque l'écriture.
 * En dev local : TESTING n'est pas défini → fonctionne normalement.
 */

export function blockIfTesting(): NextResponse | null {
  if (process.env.TESTING === "1" || process.env.TESTING === "true") {
    return NextResponse.json(
      {
        error: "Write blocked: TESTING mode active.",
        code: "TESTING_GUARD",
      },
      { status: 403 },
    );
  }
  return null;
}
