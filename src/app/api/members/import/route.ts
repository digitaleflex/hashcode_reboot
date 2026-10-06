import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { AppError, errorToResponse, parseJsonBody, RateLimitError } from "@/lib/errors";

export const runtime = "nodejs";

const VALID_LEVELS = ["beginner", "practicing", "autonomous", "advanced"];
const VALID_DOMAINS = ["web", "cybersecurity", "ai"];

const rowSchema = z.object({
  email: z.string().email("Email invalide").max(254),
  name: z.string().min(1, "Nom requis").max(120),
  level: z.string().max(30).optional(),
  country: z.string().max(2).optional(),
  domain: z.string().max(30).optional(),
});

interface ImportError {
  row: number;
  field?: string;
  message: string;
}

/** POST /api/members/import — bulk CSV import (admin-only). */
export async function POST(req: NextRequest) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    await requireAdminOrThrow(req, "operator");

    const rl = await rateLimit(`import:${rateKey(req)}`, {
      capacity: 10,
      windowMs: 600000, // 10 minutes
    });
    if (!rl.ok) {
      throw new RateLimitError("Trop d'imports. Réessaie plus tard.", rl.retryAfterMs);
    }

    const body = await parseJsonBody(req);

    const { rows } = body as { rows: unknown[] };
    if (!Array.isArray(rows)) {
      throw new AppError("Champ 'rows' requis (array).", { status: 400, code: "BAD_REQUEST" });
    }
    if (rows.length === 0) {
      throw new AppError("Aucune ligne à importer.", { status: 400, code: "BAD_REQUEST" });
    }
    if (rows.length > 500) {
      throw new AppError("Maximum 500 lignes par import.", { status: 400, code: "TOO_MANY_ROWS" });
    }

  const errors: ImportError[] = [];
  const seen = new Set<string>();
  const validRows: { email: string; name: string; level?: string; country?: string; domain?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const parsed = rowSchema.safeParse({
      email: row.email,
      name: row.name,
      level: row.level,
      country: row.country,
      domain: row.domain,
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

    validRows.push({
      email,
      name: data.name,
      level: data.level,
      country: data.country,
      domain: data.domain,
    });
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
    // Create new members (skip duplicates)
    if (toCreate.length > 0) {
      const createResult = await db.member.createMany({
        data: toCreate.map((r) => ({
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
          accessLane: "pending",
          country: r.country || "",
          availability: "5-10h",
          learningStyle: "practice",
        })),
      });
      created = createResult.count;
    }

    // Update existing members (partial update: only non-null fields)
    if (toUpdate.length > 0) {
      const updatePromises = toUpdate.map(async (r) => {
        const updateData: Record<string, unknown> = {};
        if (r.level) updateData.level = r.level;
        if (r.country) updateData.country = r.country;
        if (r.domain) updateData.primaryDomain = r.domain;

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
  try {
    await db.analyticsEvent.create({
      data: {
        type: "admin_import",
        ref: `admin-import:${created}/${updated}`,
        value: created + updated,
      },
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