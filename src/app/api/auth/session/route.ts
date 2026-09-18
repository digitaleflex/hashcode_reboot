import { NextResponse } from "next/server";
import { getSession } from "@/lib/account-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/auth/session — état de session du membre (sonde légère).
 *
 * Volontairement HORS du matcher `/api/account/*` du middleware : pour un
 * visiteur anonyme, on renvoie `200 { authenticated: false }` plutôt qu'un 401,
 * ce qui évite une erreur rouge dans la console du navigateur sur les pages
 * publiques (et permet au client de distinguer « anonyme » de « panne »).
 *
 * Aucune donnée sensible : uniquement un booléen et le prénom d'affichage.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store, max-age=0" };

  const session = await getSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { headers });
  }

  return NextResponse.json(
    {
      authenticated: true,
      firstName: session.member.firstName || null,
    },
    { headers },
  );
}
