import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { notifyWhere, EVENT_DOMAINS, EVENT_LEVELS } from "@/lib/events-validation";

export const runtime = "nodejs";

/** GET /api/events/notify-count?domain=&level= — combien de membres
 *  recevraient la notification (même filtre que l'envoi réel). */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain") || null;
  const level = searchParams.get("level") || null;
  if (domain && !(EVENT_DOMAINS as readonly string[]).includes(domain)) {
    return NextResponse.json(
      { error: "Domaine invalide.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  if (level && !(EVENT_LEVELS as readonly string[]).includes(level)) {
    return NextResponse.json(
      { error: "Niveau invalide.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const count = await db.member.count({ where: notifyWhere({ domain, level }) });
  return NextResponse.json({ count, domain, level });
}
