import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AuthError, errorToResponse } from "@/lib/errors";
import { fetchCronHealth } from "@/lib/admin/aggregates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// D16 — `revalidate = 0` retiré : redondant, `force-dynamic` l'implique déjà.

/**
 * GET /api/admin/cron-health — dernier passage de chaque cron/lot (admin-only).
 * Si un cron quotidien ne tourne plus, le dashboard l'affiche en alerte.
 *
 * D29 : la liste des crons surveillés ET la règle de santé (« dans les temps »
 * tant que l'âge ne dépasse pas 2 x la fréquence attendue ; un cron manuel
 * n'est jamais périmé) vivent dans `@/lib/admin/aggregates`. `fetchCronHealth`
 * prend le « maintenant » en paramètre pour rester testable : la route le
 * passe explicitement, elle ne le contourne pas.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthed(req))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }

    const crons = await fetchCronHealth(Date.now());

    return NextResponse.json({ ok: true, crons });
  } catch (err) {
    return errorToResponse(err);
  }
}