import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AuthError, ValidationError, errorToResponse } from "@/lib/errors";
import { fetchEmailOps } from "@/lib/admin/aggregates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// D16 — `revalidate = 0` retiré : redondant, `force-dynamic` l'implique déjà.

const querySchema = z.object({
  /** Taille de lot utilisée pour exprimer la capacité restante (« vagues »). */
  batchSize: z.coerce.number().int().min(1).max(1000).optional().default(48),
  /** Fenêtre du débit mesuré, en minutes. */
  minutes: z.coerce.number().int().min(5).max(1440).optional().default(60),
});

/**
 * Forme d'une alerte de quota. D29 : elle n'est plus écrite deux fois — celle
 * d'ici est un simple renvoi vers le module d'agrégats, qui fait autorité.
 * Le nom historique `EmailOpsAlert` est conservé parce que c'est le contrat
 * public de cette route.
 */
export type { OpsAlert as EmailOpsAlert } from "@/lib/admin/aggregates";

/**
 * GET /api/admin/email-ops — supervision des envois en TEMPS RÉEL (admin-only).
 *
 * Complète /api/admin/email-deliverability, qui travaille sur des agrégats
 * JOURNALIERS collectés par cron (jusqu'à 24 h de retard) : ici, on lit les
 * envois réellement acceptés depuis 00:00 UTC, pour pouvoir agir avant de
 * dépasser un quota.
 *
 * D29 : la lecture des quotas, le débit et la traduction des niveaux en
 * messages (`buildOpsAlerts`) sont dans `@/lib/admin/aggregates`. La route
 * n'ajoute plus que son propre contrat : le `ok: true` historique.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthed(req))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      batchSize: searchParams.get("batchSize") ?? undefined,
      minutes: searchParams.get("minutes") ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidationError("Paramètres invalides.", parsed.error.flatten());
    }
    const { batchSize, minutes } = parsed.data;

    const ops = await fetchEmailOps(batchSize, minutes);

    return NextResponse.json({ ok: true, ...ops });
  } catch (err) {
    return errorToResponse(err);
  }
}