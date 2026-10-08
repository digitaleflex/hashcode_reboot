import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { checkDb, checkMail } from "@/lib/health";
import {
  DISCORD_COLOR_ERROR,
  DISCORD_COLOR_WARN,
  sendDiscordAlert,
} from "@/lib/discord";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/cron/health-alert — alerte Discord sur l'état de santé de l'app.
 *
 * Même auth Bearer que les autres routes cron (secret CRON_SECRET, comparaison
 * à temps constant). Appelé par le cron interne : quand tout va bien on ne
 * notifie RIEN, sinon le salon Discord déborde d'alertes vertes et l'on finit
 * par ignorer le canal — un canal bruité est un canal muet.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    return NextResponse.json(
      { ok: false, error: "health-alert non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  if (!isCronAuthed(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Même bilan que /api/health : la base décide de down, le mail de degraded.
  const [dbCheck, mail] = await Promise.all([checkDb(), checkMail()]);
  const status = !dbCheck.ok
    ? "down"
    : mail.status === "valid"
      ? "ok"
      : "degraded";

  const details = [
    {
      name: "Base de données",
      value: dbCheck.ok
        ? `connectée — ${dbCheck.latencyMs} ms`
        : "INJOIGNABLE (SELECT 1 échoué ou timeout 8 s)",
      inline: true,
    },
    {
      name: "Email (Resend)",
      value: `${mail.status} — ${mail.detail}`,
      inline: true,
    },
  ];

  if (status === "ok") {
    // 200 et pas d'envoi : le cron n'a rien à signaler, il le dit.
    return NextResponse.json({ ok: true, status });
  }
  if (status === "degraded") {
    await sendDiscordAlert({
      title: "⚠️ Application dégradée",
      description:
        "La base répond mais un service annexe est dégradé. L'application reste utilisable.",
      color: DISCORD_COLOR_WARN,
      fields: details,
    });
    return NextResponse.json({ ok: true, status });
  }
  await sendDiscordAlert({
    title: "🚨 Application HS",
    description:
      "La base de données est injoignable : l'application ne répond plus à ses utilisateurs.",
    color: DISCORD_COLOR_ERROR,
    fields: details,
  });
  return NextResponse.json({ ok: true, status });
}