import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { checkCSRF, getAdminRole, requireAdminRole } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  AppError,
  errorToResponse,
  ForbiddenError,
  parseJsonBody,
  RateLimitError,
} from "@/lib/errors";
import {
  CSV_MAX_BYTES,
  parseCsvRecords,
  parseCsvTable,
  pickField,
} from "@/lib/import/csv";
import {
  importRowSchema,
  type ImportError,
  type ImportRow,
} from "@/lib/import/schema";

export const runtime = "nodejs";

/** Limite conservée : 500 lignes max par import. */
const MAX_ROWS = 500;
/** Taille des chunks createMany (100-200). */
const CREATE_CHUNK_SIZE = 150;

const bodySchema = z.object({
  /** Lignes déjà parsées côté client (rétro-compat ImportCsvDialog). */
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  /** CSV brut parsé côté serveur via csv.ts (PapaParse). */
  csvText: z.string().min(1).max(CSV_MAX_BYTES).optional(),
});

/** Mappe un enregistrement PapaParse (clés = en-têtes normalisés) vers une ligne. */
function recordToRow(rec: Record<string, string>): Record<string, unknown> {
  return {
    email: pickField(rec, ["email", "e-mail", "adresse"]),
    name: pickField(rec, ["name", "nom", "pseudo"]),
    level: pickField(rec, ["level", "niveau"]) || undefined,
    country: pickField(rec, ["country", "pays"]) || undefined,
    domain: pickField(rec, ["domain", "domaine"]) || undefined,
    accessLane:
      pickField(rec, ["accesslane", "access_lane", "lane", "voie", "acces"]) ||
      undefined,
  };
}

/** Mapping positionnel (fallback sans en-tête) : email,name,level,country,domain,accessLane. */
function positionalToRow(cols: string[]): Record<string, unknown> {
  return {
    email: cols[0] ?? "",
    name: cols[1] ?? "",
    level: cols[2] || undefined,
    country: cols[3] || undefined,
    domain: cols[4] || undefined,
    accessLane: cols[5] || undefined,
  };
}

/** POST /api/members/import — bulk CSV import (admin-only). */
export async function POST(req: NextRequest) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Opérateur requis.");
    }
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }

    const rl = await rateLimit(`import:${rateKey(req)}`, {
      capacity: 10,
      windowMs: 600000, // 10 minutes
    });
    if (!rl.ok) {
      throw new RateLimitError("Trop d'imports. Réessaie plus tard.", rl.retryAfterMs);
    }

    const body = await parseJsonBody(req);
    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      throw new AppError("Champ 'rows' (array) ou 'csvText' (string) requis.", {
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    // ── Source des lignes : rows (rétro-compat) OU csvText (PapaParse) ──
    let rawRows: Record<string, unknown>[];
    if (parsedBody.data.rows !== undefined) {
      rawRows = parsedBody.data.rows;
    } else if (parsedBody.data.csvText !== undefined) {
      const { records, hasHeader } = parseCsvRecords(parsedBody.data.csvText);
      if (hasHeader) {
        rawRows = records.map(recordToRow);
      } else {
        const { rows } = parseCsvTable(parsedBody.data.csvText);
        rawRows = rows.map(positionalToRow);
      }
    } else {
      throw new AppError("Champ 'rows' (array) ou 'csvText' (string) requis.", {
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    if (rawRows.length === 0) {
      throw new AppError("Aucune ligne à importer.", { status: 400, code: "BAD_REQUEST" });
    }
    if (rawRows.length > MAX_ROWS) {
      throw new AppError("Maximum 500 lignes par import.", { status: 400, code: "TOO_MANY_ROWS" });
    }

    const errors: ImportError[] = [];
    const seen = new Set<string>();
    const validRows: ImportRow[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i] as Record<string, unknown>;
      const parsed = importRowSchema.safeParse({
        email: row.email,
        name: row.name ?? row.firstName,
        level: row.level,
        country: row.country,
        domain: row.domain ?? row.primaryDomain,
        accessLane: row.accessLane,
      });

      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({
            row: i + 1,
            field: issue.path.join("."),
            message: issue.message,
          });
        }
        continue;
      }

      const data = parsed.data;
      const email = data.email.toLowerCase();

      if (seen.has(email)) {
        // Dedup: keep first occurrence, skip subsequent
        continue;
      }
      seen.add(email);

      validRows.push({ ...data, email });
    }

    if (errors.length > 0) {
      throw new AppError("Erreurs de validation.", {
        status: 422,
        code: "VALIDATION_ERROR",
        details: { errors },
      });
    }

    if (validRows.length === 0) {
      throw new AppError("Aucune ligne valide.", { status: 422, code: "NO_VALID_ROWS" });
    }

    // Check existing emails to determine create vs update
    const existing = await db.member.findMany({
      where: { email: { in: validRows.map((r) => r.email) } },
      select: { email: true },
    });
    const existingSet = new Set(existing.map((e) => e.email));

    const toCreate = validRows.filter((r) => !existingSet.has(r.email));
    const toUpdate = validRows.filter((r) => existingSet.has(r.email));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    try {
      // Create new members, chunké (100-200) pour rester sous les limites
      // de variables des drivers. P2002 (doublon en course) → skip ligne.
      for (let i = 0; i < toCreate.length; i += CREATE_CHUNK_SIZE) {
        const chunk = toCreate.slice(i, i + CREATE_CHUNK_SIZE);
        try {
          const createResult = await db.member.createMany({
            data: chunk.map((r) => ({
              email: r.email,
              firstName: r.name,
              lastName: null,
              primaryDomain: r.domain || "web",
              level: r.level || "beginner",
              goal: "",
              mentoringInterest: null,
              budgetRange: null,
              profileStatus: "PENDING",
              communityStatus: "NOT_INVITED",
              accessLane: r.accessLane || "pending",
              country: r.country || "",
              availability: "5-10h",
              learningStyle: "practice",
            })),
          });
          created += createResult.count;
        } catch (chunkErr) {
          if (
            chunkErr instanceof Prisma.PrismaClientKnownRequestError &&
            chunkErr.code === "P2002"
          ) {
            // Fallback ligne à ligne : les doublons sont ignorés (skipped).
            for (const r of chunk) {
              try {
                await db.member.create({
                  data: {
                    email: r.email,
                    firstName: r.name,
                    lastName: null,
                    primaryDomain: r.domain || "web",
                    level: r.level || "beginner",
                    goal: "",
                    mentoringInterest: null,
                    budgetRange: null,
                    profileStatus: "PENDING",
                    communityStatus: "NOT_INVITED",
                    accessLane: r.accessLane || "pending",
                    country: r.country || "",
                    availability: "5-10h",
                    learningStyle: "practice",
                  },
                });
                created++;
              } catch (rowErr) {
                if (
                  rowErr instanceof Prisma.PrismaClientKnownRequestError &&
                  rowErr.code === "P2002"
                ) {
                  skipped++;
                } else {
                  throw rowErr;
                }
              }
            }
          } else {
            throw chunkErr;
          }
        }
      }

      // Update existing members (partial update: only non-null fields)
      if (toUpdate.length > 0) {
        const updatePromises = toUpdate.map(async (r) => {
          const updateData: Record<string, unknown> = {};
          if (r.level) updateData.level = r.level;
          if (r.country) updateData.country = r.country;
          if (r.domain) updateData.primaryDomain = r.domain;
          if (r.accessLane) updateData.accessLane = r.accessLane;

          if (Object.keys(updateData).length === 0) {
            skipped++;
            return;
          }

          await db.member.update({
            where: { email: r.email },
            data: updateData,
          });
          updated++;
        });

        await Promise.all(updatePromises);
      }
    } catch (err) {
      console.error("Import error:", err);
      throw new AppError("INTERNAL_ERROR", { status: 500, code: "INTERNAL_ERROR" });
    }

    // Audit log
    const role = (await getAdminRole(req)) ?? "operator";
    void audit(
      "member.import",
      "member",
      undefined,
      { created, updated, skipped, total: validRows.length },
      { type: "admin", role },
    );
    try {
      await db.analyticsEvent.create({
        data: toServerEventData({
          type: "admin_import",
          ref: `admin-import:${created}/${updated}`,
          value: created + updated,
        }),
      });
    } catch {
      /* audit optional */
    }

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
