import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole, checkCSRF } from "@/lib/admin-auth";
import { bodyLimit } from "@/lib/body-limit";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import {
  getTemplateDefinition,
  getTemplateVariables,
  previewValues,
} from "@/lib/email-templates/registry";
import { renderEmailTemplate } from "@/lib/email-templates/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_HTML = 60_000;

const previewSchema = z.object({
  key: z.string().trim().min(1).max(60),
  subject: z.string().max(200),
  preheader: z.string().max(200),
  bodyHtml: z.string().max(MAX_BODY_HTML),
});

/**
 * POST /api/admin/email-templates/preview — rend un contenu NON enregistré.
 *
 * Utilisé par l'éditeur pour l'aperçu live. Passe par exactement le même
 * renderer que l'envoi : ce que voit l'admin est ce qui serait envoyé.
 * Variables remplies avec leurs valeurs d'exemple (aucune donnée membre).
 */
export async function POST(req: NextRequest) {
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;

  const rl = await rateLimit(`email-template-preview:${rateKey(req)}`, {
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  if (!requireAdminRole(req, "viewer")) {
    return NextResponse.json({ error: "Non autorisé.", code: "UNAUTHORIZED" }, { status: 401 });
  }
  // Invariant uniforme : toute route POST admin vérifie le CSRF.
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed.", code: "CSRF_FAILED" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide.", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const d = parsed.data;

  // Registre si la clé est connue, sinon jeu de repli des templates admin.
  const variables = getTemplateVariables(d.key);

  const rendered = renderEmailTemplate(
    { subject: d.subject, preheader: d.preheader, bodyHtml: d.bodyHtml },
    variables,
    Object.fromEntries(variables.map((v) => [v.key, v.preview])),
  );

  return NextResponse.json({
    ok: true,
    html: rendered.html,
    subject: rendered.subject,
    text: rendered.text,
    warnings: rendered.warnings,
  });
}
