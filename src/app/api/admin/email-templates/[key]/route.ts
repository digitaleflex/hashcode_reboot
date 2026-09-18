import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireAdminRole,
  checkCSRF,
  readAdminCookie,
  getAdminRoleFromToken,
} from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { bodyLimit } from "@/lib/body-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import {
  getTemplateDefinition,
  getTemplateVariables,
  isCategoryEditable,
  previewValues,
} from "@/lib/email-templates/registry";
import { renderEmailTemplate } from "@/lib/email-templates/render";
import { invalidateActiveTemplates } from "@/lib/email-templates/active";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_HTML = 60_000;

const patchSchema = z
  .object({
    subject: z.string().trim().min(1).max(200).optional(),
    preheader: z.string().trim().max(200).optional(),
    bodyHtml: z.string().max(MAX_BODY_HTML).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Aucun champ à mettre à jour.");

/** Métadonnées d'un template, registre + ligne en base. */
async function loadTemplate(key: string) {
  const row = await db.emailTemplate.findUnique({ where: { key } });
  const def = getTemplateDefinition(key);
  return { row, def };
}

/**
 * GET /api/admin/email-templates/[key] — détail + aperçu rendu côté serveur.
 * Les variables du registre sont remplies avec leurs valeurs d'exemple.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!requireAdminRole(req, "viewer")) {
    return NextResponse.json({ error: "Non autorisé.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { key } = await params;
  const { row, def } = await loadTemplate(key);

  if (!row) {
    return NextResponse.json(
      {
        error: def
          ? `Template « ${key} » connu du code mais absent en base. Lance le seed.`
          : `Template « ${key} » introuvable.`,
        code: "NOT_FOUND",
      },
      { status: 404 },
    );
  }

  const variables = getTemplateVariables(key);
  const rendered = renderEmailTemplate(
    { subject: row.subject, preheader: row.preheader, bodyHtml: row.bodyHtml },
    variables,
    Object.fromEntries(variables.map((v) => [v.key, v.preview])),
  );

  return NextResponse.json({
    ok: true,
    template: {
      key: row.key,
      name: row.name,
      category: row.category,
      description: def?.description ?? "Template créé depuis l'admin.",
      source: def?.source ?? null,
      editable: isCategoryEditable(row.category),
      inRegistry: Boolean(def),
      subject: row.subject,
      preheader: row.preheader,
      bodyHtml: row.bodyHtml,
      isActive: row.isActive,
      version: row.version,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
      variables: variables.map((v) => ({ key: v.key, label: v.label, kind: v.kind })),
    },
    preview: { html: rendered.html, subject: rendered.subject, warnings: rendered.warnings },
  });
}

/**
 * PATCH /api/admin/email-templates/[key] — met à jour le contenu ou l'activation.
 *
 * Refusé pour les catégories verrouillées (`notification`, `code`) : ces
 * templates transportent des liens et des secrets d'authentification.
 * Le contenu est rendu AVANT écriture : un template cassé (variable inconnue,
 * URL invalide) n'est jamais enregistré.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;

  const rl = await rateLimit(`email-template-write:${rateKey(req)}`, {
    capacity: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé. Rôle operator requis.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }

  const { key } = await params;
  const { row, def } = await loadTemplate(key);
  if (!row) {
    return NextResponse.json({ error: `Template « ${key} » introuvable.`, code: "NOT_FOUND" }, { status: 404 });
  }

  if (!isCategoryEditable(row.category)) {
    return NextResponse.json(
      {
        error:
          `Template « ${key} » verrouillé (catégorie ${row.category}) : il transporte des liens ou ` +
          "des secrets d'authentification. Son contenu reste géré dans le code.",
        code: "LOCKED",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide.", code: "INVALID_PAYLOAD" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const patch = parsed.data;

  const next = {
    subject: patch.subject ?? row.subject,
    preheader: patch.preheader ?? row.preheader,
    bodyHtml: patch.bodyHtml ?? row.bodyHtml,
  };

  // Rendu de contrôle : on refuse d'enregistrer un template qui ne rend pas.
  const variables = getTemplateVariables(key);
  const probe = renderEmailTemplate(
    next,
    variables,
    Object.fromEntries(variables.map((v) => [v.key, v.preview])),
  );
  if (probe.warnings.length > 0) {
    return NextResponse.json(
      {
        error: "Contenu refusé : corriger les problèmes signalés avant d'enregistrer.",
        code: "INVALID_CONTENT",
        warnings: probe.warnings,
      },
      { status: 422 },
    );
  }

  const contentChanged =
    patch.subject !== undefined || patch.preheader !== undefined || patch.bodyHtml !== undefined;

  const updated = await db.emailTemplate.update({
    where: { key },
    data: {
      ...next,
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(contentChanged ? { version: { increment: 1 } } : {}),
      updatedBy: getAdminRoleFromToken(readAdminCookie(req)) ?? null,
    },
    select: { key: true, isActive: true, version: true, updatedAt: true },
  });

  // Le cache d'envoi doit refléter la modification immédiatement (même instance).
  invalidateActiveTemplates();

  void audit(
    "email_template.update",
    "email_template",
    key,
    {
      contentChanged,
      isActive: updated.isActive,
      fields: Object.keys(patch),
    },
    { type: "admin", role: getAdminRoleFromToken(readAdminCookie(req)) ?? "operator" },
  );

  return NextResponse.json({
    ok: true,
    template: updated,
    preview: { html: probe.html, subject: probe.subject, warnings: probe.warnings },
  });
}
