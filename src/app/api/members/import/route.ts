import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";

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
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const rl = rateLimit(`import:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop d'imports. Réessaie plus tard.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { rows } = body as { rows: unknown[] };
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "Champ 'rows' requis (array).", code: "BAD_REQUEST" }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "Aucune ligne à importer.", code: "BAD_REQUEST" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Maximum 500 lignes par import.", code: "TOO_MANY_ROWS" }, { status: 400 });
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
    return NextResponse.json(
      { error: "Erreurs de validation.", code: "VALIDATION_ERROR", errors },
      { status: 422 },
    );
  }

  if (validRows.length === 0) {
    return NextResponse.json(
      { error: "Aucune ligne valide.", code: "NO_VALID_ROWS" },
      { status: 422 },
    );
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
          communityStatus: "PENDING",
          accessLane: "PENDING",
          country: r.country || "FR",
        })),
        skipDuplicates: true,
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
    return NextResponse.json(
      { error: "INTERNAL_ERROR", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
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
}