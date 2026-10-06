import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AppError, AuthError, errorToResponse } from "@/lib/errors";
import { fetchEmailEngagement } from "@/lib/admin/aggregates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// D16 — `revalidate = 0` retiré : redondant, `force-dynamic` l'implique déjà.

/**
 * GET /api/email-stats — email engagement per category + relance funnel (admin-only).
 *
 * D29 : l'agrégat entier (ventilation par catégorie sémantique, tunnel de
 * relance) est calculé par `fetchEmailEngagement()`, dans
 * `@/lib/admin/aggregates` — un seul endroit où la formule existe. Cette route
 * n'en garde que son CONTRAT HTTP : elle ne renvoie pas le bloc `categories`
 * que l'agrégat produit pour le dashboard, parce qu'elle ne l'a jamais exposé.
 * Factoriser la formule ne doit pas changer la réponse publique d'un endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthed(req))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }

    try {
      const { summary, byCategory, relance } = await fetchEmailEngagement();

      return NextResponse.json({ summary, byCategory, relance });
    } catch {
      throw new AppError("Erreur interne.", { status: 500, code: "INTERNAL_ERROR" });
    }
  } catch (err) {
    return errorToResponse(err);
  }
}