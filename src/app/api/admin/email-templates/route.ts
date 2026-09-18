import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole, checkCSRF, readAdminCookie, getAdminRoleFromToken } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { bodyLimit } from "@/lib/body-limit";
import {
  TEMPLATE_REGISTRY,
  CUSTOM_TEMPLATE_VARIABLES,
  getTemplateDefinition,
  isCategoryEditable,
} from "@/lib/email-templates/registry";
import { renderEmailTemplate } from "@/lib/email-templates/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_HTML = 60_000;

/** Corps de départ d'un template créé depuis l'admin (charte respectée). */
const STARTER_BODY = `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">
<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:#C5F441;margin:0 0 12px 0;">SUR-TITRE</div>
<h1 style="margin:0 0 12px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Bonjour {{firstName}},</h1>
<p style="margin:0 0 16px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#F8FAFC;">Écris ton message ici.</p>
<p style="margin:20px 0 0 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#F8FAFC;">À très vite,<br /><span style="color:#94A3B8;">L&apos;équipe HASHCODE</span></p>
</td></tr>`;

const createSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{3,40}$/, "clé : minuscules, chiffres et _ uniquement (3-40)"),
  name: z.string().trim().min(2).max(120),
  subject: z.string().trim().min(1).max(200),
  preheader: z.string().trim().max(200).optional().default(""),
  bodyHtml: z.string().max(MAX_BODY_HTML).optional(),
});

/**
 * GET /api/admin/email-templates — liste des templates.
 *
 * Fusionne le registre (clés liées au code) et les lignes en base, y compris
 * les templates créés depuis l'admin (absents du registre).
 */
export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "viewer")) {
    return NextResponse.json({ error: "Non autorisé.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const rows = await db.emailTemplate.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
    select: {
      key: true,
      name: true,
      category: true,
      subject: true,
      preheader: true,
      isActive: true,
      version: true,
      updatedAt: true,
      updatedBy: true,
    },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const templates = TEMPLATE_REGISTRY.map((def) => {
    const row = byKey.get(def.key);
    return {
      key: def.key,
      name: row?.name ?? def.name,
      category: def.category,
      description: def.description,
      source: def.source,
      variables: def.variables.map((v) => ({ key: v.key, label: v.label, kind: v.kind })),
      editable: isCategoryEditable(def.category),
      seeded: Boolean(row),
      missing: !row,
      subject: row?.subject ?? null,
      isActive: row?.isActive ?? false,
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
      custom: false,
    };
  });

  const custom = rows
    .filter((r) => !getTemplateDefinition(r.key))
    .map((r) => ({
      key: r.key,
      name: r.name,
      category: r.category,
      description: "Template créé depuis l'admin (non relié à un envoi automatique).",
      source: null,
      variables: CUSTOM_TEMPLATE_VARIABLES.map((v) => ({ key: v.key, label: v.label, kind: v.kind })),
      editable: isCategoryEditable(r.category),
      seeded: true,
      missing: false,
      subject: r.subject,
      isActive: r.isActive,
      version: r.version,
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy,
      custom: true,
    }));

  return NextResponse.json({
    ok: true,
    templates: [...templates, ...custom],
    counts: {
      total: templates.length + custom.length,
      marketing: templates.filter((t) => t.category === "marketing").length,
      active: rows.filter((r) => r.isActive).length,
      missing: templates.filter((t) => t.missing).length,
    },
  });
}

/** POST /api/admin/email-templates — crée un template (brouillon marketing). */
export async function POST(req: NextRequest) {
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé. Rôle operator requis.", code: "FORBIDDEN" }, { status: 403 });
  }
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide.", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const existing = await db.emailTemplate.findUnique({ where: { key: d.key }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: `La clé « ${d.key} » existe déjà.`, code: "CONFLICT" },
      { status: 409 },
    );
  }

  const bodyHtml = d.bodyHtml?.trim() ? d.bodyHtml : STARTER_BODY;

  // Le contenu de départ doit être rendable : on refuse un template cassé.
  // Rendu de contrôle : un template créé cassé n'entre pas en base.
  const probe = renderEmailTemplate(
    { subject: d.subject, preheader: d.preheader, bodyHtml },
    CUSTOM_TEMPLATE_VARIABLES,
    Object.fromEntries(CUSTOM_TEMPLATE_VARIABLES.map((v) => [v.key, v.preview])),
  );
  if (probe.warnings.length > 0) {
    return NextResponse.json(
      {
        error: "Contenu refusé : corriger les problèmes signalés avant de créer.",
        code: "INVALID_CONTENT",
        warnings: probe.warnings,
      },
      { status: 422 },
    );
  }

  const created = await db.emailTemplate.create({
    data: {
      key: d.key,
      name: d.name,
      category: "marketing",
      subject: d.subject,
      preheader: d.preheader,
      bodyHtml,
      isActive: false,
      updatedBy: getAdminRoleFromToken(readAdminCookie(req)) ?? null,
    },
    select: { key: true, name: true, category: true },
  });

  void audit(
    "email_template.create",
    "email_template",
    created.key,
    { name: created.name, warnings: probe.warnings.length },
    { type: "admin", role: getAdminRoleFromToken(readAdminCookie(req)) ?? "operator" },
  );

  return NextResponse.json({ ok: true, template: created, warnings: probe.warnings }, { status: 201 });
}
