import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkCSRF, requireAdminOrThrow } from "@/lib/admin-auth";
import { bodyLimit } from "@/lib/body-limit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { AppError, RateLimitError, ValidationError, errorToResponse, parseJsonBody } from "@/lib/errors";
import { getTemplateVariables } from "@/lib/email-templates/registry";
import { renderEmailTemplate } from "@/lib/email-templates/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// D16 — `revalidate = 0` retiré : redondant, `force-dynamic` l'implique déjà.

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
  try {
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;

  const rl = await rateLimit(`email-template-preview:${rateKey(req)}`, {
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
  }

  await requireAdminOrThrow(req, "viewer");
  // Invariant uniforme : toute route POST admin vérifie le CSRF.
  if (!checkCSRF(req)) {
    throw new AppError("CSRF validation failed.", { status: 403, code: "CSRF_FAILED" });
  }

  const body = await parseJsonBody(req);

  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Données invalides.",
      parsed.error.flatten(),
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
  } catch (err) {
    return errorToResponse(err);
  }
}
