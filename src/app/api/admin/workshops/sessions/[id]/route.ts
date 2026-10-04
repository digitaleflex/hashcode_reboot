import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAdminRole,
  checkCSRF,
  getAdminRole,
} from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Body partiel accepté :
 *  - unlockOverride : boolean — déverrouille (true) ou reverrouille (false)
 *    la séance pour tous les membres, en primant sur la chaîne séquentielle
 *    et le gate calendaire.
 *  - scheduledAt    : ISO string | null — change la date de déblocage
 *    calendaire (null = supprime le gate de date).
 * Les deux champs sont indépendants : on peut ne passer qu'un seul.
 */
interface SessionPatchBody {
  unlockOverride?: unknown;
  scheduledAt?: unknown;
}

function parseBody(body: Record<string, unknown>): {
  ok: true;
  data: { unlockOverride?: boolean; scheduledAt?: Date | null };
} | { ok: false; error: string } {
  const data: { unlockOverride?: boolean; scheduledAt?: Date | null } = {};

  if (body.unlockOverride !== undefined) {
    if (typeof body.unlockOverride !== "boolean") {
      return { ok: false, error: "unlockOverride doit être un booléen." };
    }
    data.unlockOverride = body.unlockOverride;
  }

  if (body.scheduledAt !== undefined) {
    if (body.scheduledAt === null || body.scheduledAt === "") {
      data.scheduledAt = null;
    } else if (typeof body.scheduledAt === "string") {
      const d = new Date(body.scheduledAt);
      if (isNaN(d.getTime())) {
        return { ok: false, error: "scheduledAt : date invalide." };
      }
      data.scheduledAt = d;
    } else {
      return { ok: false, error: "scheduledAt doit être une date ISO ou null." };
    }
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Rien à mettre à jour." };
  }
  return { ok: true, data };
}

/**
 * GET /api/admin/workshops/sessions/[id] — détail d'une séance pour pilotage.
 * Renvoie l'état du verrou (chaîne recalculée pour le premier membre inscrit,
 * non pertinent côté admin) et les champs de déblocage.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    if (!(await requireAdminRole(req, "viewer"))) {
      throw new ForbiddenError("Accès refusé.");
    }

    const rl = await rateLimit(`admin-session-read:${rateKey(req)}`, {
      capacity: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
    }

    const { id } = await params;
    const session = await db.workshopSession.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        title: true,
        objective: true,
        deliverableRequired: true,
        quizRequired: true,
        eventId: true,
        scheduledAt: true,
        unlockOverride: true,
        week: {
          select: {
            number: true,
            title: true,
            workshop: { select: { id: true, slug: true, title: true, status: true } },
          },
        },
      },
    });
    if (!session) {
      throw new NotFoundError("Séance introuvable.");
    }

    return NextResponse.json({ session });
  } catch (err) {
    return errorToResponse(err);
  }
}

/**
 * PATCH /api/admin/workshops/sessions/[id] — déverrouille / reverrouille une
 * séance, ajuste sa date de déblocage calendaire (admin operator uniquement).
 *
 * Sécurité : RBAC operator + CSRF + rate-limit + TESTING guard + audit log.
 * L'override ne touche JAMAIS aux données pédagogiques : le serveur recalcule
 * l'état de chaque séance à chaque requête membre (ADR-001) — le verrou est
 * simplement levé quand unlockOverride=true.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;

    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé. Rôle operator requis.");
    }
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }

    const rl = await rateLimit(`admin-session-write:${rateKey(req)}`, {
      capacity: 30,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
    }

    const { id } = await params;
    const existing = await db.workshopSession.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        title: true,
        scheduledAt: true,
        unlockOverride: true,
        week: { select: { workshop: { select: { id: true, title: true } } } },
      },
    });
    if (!existing) {
      throw new NotFoundError("Séance introuvable.");
    }

    const body = (await parseJsonBody(req)) as Record<string, unknown>;

    const parsed = parseBody(body);
    if (!parsed.ok) {
      throw new ValidationError(parsed.error);
    }

    const session = await db.workshopSession.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        number: true,
        title: true,
        scheduledAt: true,
        unlockOverride: true,
      },
    });

    const adminRole = (await getAdminRole(req)) ?? "operator";
    void audit(
      "workshop-session.unlock",
      "workshop_session",
      id,
      {
        fields: Object.keys(parsed.data),
        unlockOverride: session.unlockOverride,
        scheduledAt: session.scheduledAt?.toISOString() ?? null,
        workshopId: existing.week.workshop.id,
        workshopTitle: existing.week.workshop.title,
        sessionNumber: existing.number,
        sessionTitle: existing.title,
      },
      { type: "admin", role: adminRole },
    );

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    return errorToResponse(err);
  }
}
