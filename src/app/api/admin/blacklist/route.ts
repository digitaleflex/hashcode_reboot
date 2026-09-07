import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole, checkCSRF } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { addToBlacklist, getBlacklist, BLACKLIST_REASONS } from "@/lib/blacklist";

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
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
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
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (!checkCSRF(req)) {
    return NextResponse.json(
      { error: "Jeton CSRF invalide." },
      { status: 403 },
    );
  }
  // Anti-abus
  const rl = await rateLimit(`admin-blacklist-add:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop d'ajouts. Réessaie dans quelques minutes." },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Données invalides.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
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
    return NextResponse.json(
      { error: "Erreur lors de l'ajout à la blacklist." },
      { status: 500 },
    );
  }
}
