/**
 * Export admin des leads (#101) — logique partagée CSV/JSON.
 *
 * Garanties :
 *   - filtres whitelistés (Zod, 422 sinon) — jamais de SQL libre ;
 *   - colonnes par défaut MINIMISÉES (#153) : adminNote/adminRole exclus,
 *     opt-in explicite via `fields=` ;
 *   - `segment=` : définition Segment compilée (whitelist #104), AND avec
 *     les filtres ad-hoc ; 404 si inconnu, 422 si obsolète ;
 *   - plafond 2000 signalé (headers X-Export-*) ;
 *   - audit (qui/quand/filtre/volume/type) + événement analytics, best-effort.
 */
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/admin-audit";
import { getAdminRole } from "@/lib/admin-auth";
import { toServerEventData } from "@/lib/analytics";
import type { NextRequest } from "next/server";
import { compileSegmentWhere, parseSegmentDefinition } from "./segments";
import { AppError } from "./errors";

export const EXPORT_MAX = 2000;

/** Colonnes par défaut : utiles aux opérations, sans internes. */
export const EXPORT_DEFAULT_COLUMNS = [
  "id",
  "createdAt",
  "firstName",
  "lastName",
  "email",
  "phone",
  "country",
  "city",
  "gender",
  "primaryDomain",
  "domainSpecialty",
  "level",
  "goal",
  "goalProjectStage",
  "goalSituation",
  "availability",
  "learningStyle",
  "mentoringInterest",
  "mentoringMaybeReason",
  "mentoringTypes",
  "mentoringFrequency",
  "mentoringDomain",
  "budgetRange",
  "threeMonthGoal",
  "profileArchetype",
  "tags",
  "profileStatus",
  "communityStatus",
  "accessLane",
  "invitationStatus",
  "source",
] as const;

/** Internes : uniquement sur demande explicite `fields=`. */
export const EXPORT_SENSITIVE_COLUMNS = ["adminNote", "adminRole"] as const;

export const EXPORT_ALL_COLUMNS = [
  ...EXPORT_DEFAULT_COLUMNS,
  ...EXPORT_SENSITIVE_COLUMNS,
] as const;

const filterSchema = z.object({
  domain: z.enum(["web", "cybersecurity", "ai"]).optional(),
  country: z.string().trim().min(1).max(8).optional(),
  level: z
    .enum(["beginner", "practicing", "autonomous", "advanced"])
    .optional(),
  mentoring: z.enum(["no", "maybe", "yes"]).optional(),
  budget: z.string().trim().min(1).max(20).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "WAITLIST"]).optional(),
  lane: z.enum(["immediate", "pending"]).optional(),
  type: z.enum(["registered", "invited"]).optional(),
  invitationStatus: z
    .enum(["NOT_INVITED", "INVITED", "ACCEPTED", "REFUSED", "BOUNCED", "EXPIRED"])
    .optional(),
  q: z.string().trim().min(1).max(100).optional(),
  fields: z.string().max(2000).optional(),
  segment: z.string().trim().min(1).max(64).optional(),
});

export type ExportFilters = z.infer<typeof filterSchema>;

export function parseExportFilters(searchParams: URLSearchParams): ExportFilters {
  const raw: Record<string, string> = {};
  for (const k of [
    "domain",
    "country",
    "level",
    "mentoring",
    "budget",
    "status",
    "lane",
    "type",
    "invitationStatus",
    "q",
    "fields",
    "segment",
  ]) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") raw[k] = v;
  }
  const parsed = filterSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("Filtre invalide.", {
      status: 422,
      code: "INVALID_FILTER",
    });
  }
  return parsed.data;
}

/** Colonnes résolues : défaut minimisé, ou sous-ensemble demandé (sensibles incluses si nommées). */
export function resolveExportColumns(fieldsParam?: string): string[] {
  if (!fieldsParam) return [...EXPORT_DEFAULT_COLUMNS];
  const requested = fieldsParam
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const cols = EXPORT_ALL_COLUMNS.filter((h) => requested.includes(h));
  if (cols.length === 0) {
    throw new AppError("Aucune colonne valide demandée.", {
      status: 422,
      code: "INVALID_FIELDS",
    });
  }
  return [...cols];
}

/** Where Prisma : filtres validés (+ segment AND). Supprimés toujours exclus. */
export async function buildExportWhere(
  f: ExportFilters,
): Promise<Prisma.MemberWhereInput> {
  const where: Prisma.MemberWhereInput = { deletedAt: null };
  if (f.domain) where.primaryDomain = f.domain;
  if (f.country) where.country = f.country;
  if (f.level) where.level = f.level;
  if (f.mentoring) where.mentoringInterest = f.mentoring;
  if (f.budget) where.budgetRange = f.budget;
  if (f.status) where.profileStatus = f.status;
  if (f.lane) where.accessLane = f.lane;
  if (f.invitationStatus) where.invitationStatus = f.invitationStatus;
  else if (f.type === "registered") where.invitationStatus = "NOT_INVITED";
  else if (f.type === "invited") where.invitationStatus = { not: "NOT_INVITED" };
  if (f.q) {
    where.OR = [
      { firstName: { contains: f.q, mode: "insensitive" } },
      { email: { contains: f.q, mode: "insensitive" } },
    ];
  }
  if (f.segment) {
    const seg = await db.segment.findUnique({ where: { id: f.segment } });
    if (!seg) {
      throw new AppError("Segment introuvable.", { status: 404, code: "SEGMENT_NOT_FOUND" });
    }
    const parsed = parseSegmentDefinition(seg.definition);
    if (!parsed.success) {
      throw new AppError("Définition de segment obsolète.", {
        status: 422,
        code: "STALE_DEFINITION",
      });
    }
    return { AND: [where, compileSegmentWhere(parsed.data)] };
  }
  return where;
}

/** Traçabilité (best-effort, ne casse jamais l'export). */
export async function auditExport(
  req: NextRequest,
  opts: { format: "csv" | "json"; exported: number; total: number; truncated: boolean },
): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: toServerEventData({
        type: "community_cta_clicked",
        ref: `admin-export-${opts.format}:${opts.exported}/${opts.total}`,
      }),
    });
  } catch {
    /* ignore */
  }
  void audit(
    "member.export",
    "member",
    undefined,
    {
      format: opts.format,
      exported: opts.exported,
      total: opts.total,
      truncated: opts.truncated,
    },
    {
      type: "admin",
      role: (await getAdminRole(req)) ?? "operator",
    },
  );
}
