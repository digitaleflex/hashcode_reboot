import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkCSRF, requireAdmin, adminGuardResponse } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { addToBlacklist, getBlacklist, BLACKLIST_REASONS } from "@/lib/blacklist";
import {
  AppError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";

/**
 * GET /api/admin/blacklist
 * Query params:
 *   - page (default 1)
 *   - perPage (default 25, max 100)
 *   - reason : filter par raison
 *   - search : filtre par email
 *   - onlyActive : true = exclut les expirés
 *
 * POST /api/admin/blacklist
 * Body: { email, reason, note?, expiresAt? }
 * Crée ou met à jour l'entrée.
 */
export async function GET(req: NextRequest) {
  const adminGuard = await requireAdmin(req, "operator");
  if (!adminGuard.ok) return adminGuardResponse(adminGuard);
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const perPage = Math.min(
    100,
    Math.max(1, Number(searchParams.get("perPage") ?? "25")),
  );
  const reason = searchParams.get("reason") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const onlyActive = searchParams.get("onlyActive") === "true";

  const result = await getBlacklist({ page, perPage, reason, search, onlyActive });
  return NextResponse.json(result);
}

const addSchema = z.object({
  email: z.string().trim().email("Email invalide").max(254),
  reason: z.enum(BLACKLIST_REASONS as unknown as [string, ...string[]]),
  note: z.string().trim().max(500).optional().nullable(),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null)),
});

export async function POST(req: NextRequest) {
  try {
  const adminGuard = await requireAdmin(req, "operator");
  if (!adminGuard.ok) return adminGuardResponse(adminGuard);
  if (!checkCSRF(req)) {
    // D26 — 403 conservé, `code` ajouté.
    throw new ForbiddenError("Jeton CSRF invalide.");
  }
  // Anti-abus
  const rl = await rateLimit(`admin-blacklist-add:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    throw new RateLimitError(
      "Trop d'ajouts. Réessaie dans quelques minutes.",
      rl.retryAfterMs,
    );
  }

  // D26 — `parseJsonBody` rend le 400 « Corps de requête invalide. » d'avant.
  const body = await parseJsonBody(req);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    // 422 : le tableau passe de la clé `issues` à `details` (clé que
    // personne ne lit — cf. rapport D26).
    throw new ValidationError(
      "Données invalides.",
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    );
  }

  try {
    const row = await addToBlacklist({
      email: parsed.data.email,
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
      expiresAt: parsed.data.expiresAt ?? null,
      autoAdded: false,
    });
    await audit("blacklist.add", "blacklist", row.id, {
      email: parsed.data.email,
      reason: parsed.data.reason,
      expiresAt: parsed.data.expiresAt ?? null,
    });
    return NextResponse.json({ ok: true, id: row.id, email: row.email });
  } catch (e) {
    console.error("[blacklist/add] error:", e);
    throw new AppError("Erreur lors de l'ajout à la blacklist.");
  }
  } catch (err) {
    return errorToResponse(err);
  }
}
