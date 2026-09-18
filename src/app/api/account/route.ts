import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import {
  getSession,
  clearSessionCookie,
  destroyAllSessions,
} from "@/lib/account-auth";
import { db } from "@/lib/db";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { audit } from "@/lib/admin-audit";
import { addToBlacklist } from "@/lib/blacklist";
import {
  isDeleteConfirmed,
  DELETE_CONFIRM_WORD,
} from "@/lib/account-rgpd";

export const runtime = "nodejs";

/**
 * DELETE /api/account
 *
 * Suppression de compte RGPD par le membre lui-même :
 * - soft-delete (deletedAt, même convention que la suppression admin) :
 *   le profil disparaît de toutes les requêtes et l'auth est bloquée ;
 * - brouillon de profilage supprimé (stoppe les relances) ;
 * - toutes les sessions révoquées (déconnexion partout) ;
 * - email ajouté à la blacklist anti-relance (best-effort) ;
 * - action auditée (sans donnée personnelle dans la ref).
 *
 * Confirmation explicite obligatoire : corps { confirm: "SUPPRIMER" }.
 * Anti-abus : 5 suppressions / IP / 10 min.
 */
export async function DELETE(req: NextRequest) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;

  const rl = await rateLimit(`account-delete:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  if (!isDeleteConfirmed(body)) {
    return NextResponse.json(
      {
        error: `Confirmation requise : écris ${DELETE_CONFIRM_WORD} pour supprimer ton compte.`,
        code: "CONFIRM_REQUIRED",
      },
      { status: 422 },
    );
  }

  const memberId = session.member.id;
  const email = session.member.email;

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { id: true, email: true, deletedAt: true },
  });
  if (!member || member.deletedAt) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  await db.member.update({
    where: { id: memberId },
    data: { deletedAt: new Date() },
  });

  // Le brouillon stoppe les relances email (clé = email).
  try {
    await db.profilingDraft.deleteMany({ where: { email } });
  } catch (draftErr) {
    console.warn("[account-delete] failed to delete draft:", draftErr);
  }

  // Déconnexion partout (y compris cet appareil).
  try {
    await destroyAllSessions(memberId);
  } catch (sessErr) {
    console.warn("[account-delete] failed to revoke sessions:", sessErr);
  }

  // Anti-relance : l'email ne doit plus recevoir d'emails automatiques.
  try {
    await addToBlacklist({
      email,
      reason: "other",
      note: `Auto-blocked après suppression volontaire du compte (${new Date().toISOString()})`,
      autoAdded: true,
    });
  } catch (blErr) {
    console.warn("[account-delete] failed to add to blacklist:", blErr);
  }

  await audit("member.self-delete", "member", memberId, { soft: true });
  await clearSessionCookie();

  return NextResponse.json({ ok: true, deleted: true });
}
