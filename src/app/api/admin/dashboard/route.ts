import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AuthError, ValidationError, errorToResponse } from "@/lib/errors";
import {
  collectErrors,
  fetchCronHealth,
  fetchEmailAudience,
  fetchEmailDeliverability,
  fetchEmailEngagement,
  fetchEmailOps,
  fetchFunnel,
  fetchStats,
  settle,
} from "@/lib/admin/aggregates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  /** Nombre de jours d'historique pour la delivrabilite email. */
  deliveryDays: z.coerce.number().int().min(1).max(365).optional().default(30),
  /** Taille de lot pour exprimer la capacite restante en vagues. */
  batchSize: z.coerce.number().int().min(1).max(1000).optional().default(48),
  /** Fenetre du debit mesure, en minutes. */
  throughputMinutes: z.coerce.number().int().min(5).max(1440).optional().default(60),
});

/**
 * GET /api/admin/dashboard - vue d'ensemble 360 (admin-only).
 *
 * Cette route ne contient plus aucune formule : les 7 agregats vivent dans
 * `@/lib/admin/aggregates`, un seul endroit ou ils sont calcules. Elle ne fait
 * que lire les parametres, lancer les agregats en parallele et assembler la
 * reponse.
 *
 * Composition cote serveur, volontairement. Appeler les 7 endpoints `/api/*`
 * depuis le navigateur aurait fait 7 allers-retours et rejouerait les memes
 * requetes DB sept fois. Ici : un seul point d'entree, 41 requetes DB au total,
 * comme avant D29.
 *
 * Chaque bloc est isole : une source en echec renvoie `null` et une entree dans
 * `errors`, sans eteindre les six autres. La forme de la reponse est
 * inchangee (voir `page.tsx`), c'est une contrainte de D29.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthed(req))) {
      // Chaîne identique à l'original (accents inclus) : ce message fait partie
      // du corps de la réponse 401, il ne doit pas changer.
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      deliveryDays: searchParams.get("deliveryDays") ?? undefined,
      batchSize: searchParams.get("batchSize") ?? undefined,
      throughputMinutes: searchParams.get("throughputMinutes") ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidationError("Paramètres invalides.", parsed.error.flatten());
    }
    const { deliveryDays, batchSize, throughputMinutes } = parsed.data;

    // ── Toutes les sources en parallele, chacune isolee ──────────────
    const [stats, funnel, emailStats, emailDeliverability, emailOps, cronHealth, audience] =
      await Promise.all([
        settle(fetchStats),
        settle(fetchFunnel),
        settle(fetchEmailEngagement),
        settle(() => fetchEmailDeliverability(deliveryDays)),
        settle(() => fetchEmailOps(batchSize, throughputMinutes)),
        settle(fetchCronHealth),
        settle(fetchEmailAudience),
      ]);

    const errors = collectErrors({
      stats,
      funnel,
      emailStats,
      emailDeliverability,
      emailOps,
      cronHealth,
      audience,
    });

    return NextResponse.json({
      ok: errors === undefined,
      generatedAt: new Date().toISOString(),
      stats: stats.value,
      funnel: funnel.value,
      emailStats: emailStats.value,
      emailDeliverability: emailDeliverability.value,
      emailOps: emailOps.value,
      cronHealth: cronHealth.value,
      audience: audience.value,
      errors,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
