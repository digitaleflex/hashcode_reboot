import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { notifyWhere, EVENT_DOMAINS, EVENT_LEVELS } from "@/lib/events-validation";
import { AuthError, ValidationError, errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";

/** GET /api/events/notify-count?domain=&level= — combien de membres
 *  recevraient la notification (même filtre que l'envoi réel). */
export async function GET(req: NextRequest) {
  try {
  if (!(await isAdminAuthed(req))) {
    throw new AuthError("Non autorisé.", "UNAUTHORIZED");
  }
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain") || null;
  const level = searchParams.get("level") || null;
  if (domain && !(EVENT_DOMAINS as readonly string[]).includes(domain)) {
    throw new ValidationError("Domaine invalide.");
  }
  if (level && !(EVENT_LEVELS as readonly string[]).includes(level)) {
    throw new ValidationError("Niveau invalide.");
  }
  const count = await db.member.count({ where: notifyWhere({ domain, level }) });
  return NextResponse.json({ count, domain, level });
  } catch (err) {
    return errorToResponse(err);
  }
}
