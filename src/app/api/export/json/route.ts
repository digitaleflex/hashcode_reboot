import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminRole, isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { AuthError, RateLimitError, errorToResponse } from "@/lib/errors";
import {
  EXPORT_MAX,
  auditExport,
  buildExportWhere,
  parseExportFilters,
  resolveExportColumns,
} from "@/lib/admin-export";

export const runtime = "nodejs";

/**
 * GET /api/export/json — JSON (admin). Mêmes filtres whitelistés que le CSV
 * (`segment=`, `fields=` inclus). Colonnes minimisées par défaut (#153) :
 * adminNote/adminRole uniquement via `fields=` explicite ET rôle operator
 * (403 FORBIDDEN_FIELDS sinon, #221). Plafond signalé.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthed(req))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }
    // Anti-abus : 20 exports par IP toutes les 10 minutes.
    const rl = await rateLimit(`export-json:${rateKey(req)}`, {
      capacity: 20,
      windowMs: 600000, // 10 minutes
    });
    if (!rl.ok) {
      throw new RateLimitError(
        "Trop de requêtes. Réessaie dans quelques minutes.",
        rl.retryAfterMs,
      );
    }

    const { searchParams } = new URL(req.url);
    const filters = parseExportFilters(searchParams);
    const role = await getAdminRole(req);
    const columns = resolveExportColumns(filters.fields, role);
    const where = await buildExportWhere(filters);

    const [total, members] = await Promise.all([
      db.member.count({ where }),
      db.member.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: EXPORT_MAX,
      }),
    ]);

    const decode = <T,>(s: string, fallback: T): T => {
      try {
        return JSON.parse(s) as T;
      } catch {
        return fallback;
      }
    };

    const clean = members.map((m) => {
      const row = m as unknown as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const c of columns) {
        let v = c === "createdAt" && row[c] instanceof Date ? row[c] : row[c];
        if (["secondaryDomains", "domainSpecialty", "mentoringTypes", "tags"].includes(c)) {
          v = decode<string[]>(String(row[c] ?? "[]"), []);
        }
        out[c] = v instanceof Date ? v.toISOString() : v;
      }
      return out;
    });

    const truncated = total > EXPORT_MAX;
    await auditExport(req, { format: "json", exported: clean.length, total, truncated });

    return NextResponse.json(
      { exportedAt: new Date().toISOString(), count: clean.length, members: clean },
      {
        headers: {
          "Content-Disposition": `attachment; filename="hashcode-reboot-members-${Date.now()}.json"`,
          "Cache-Control": "no-store",
          ...(truncated
            ? { "X-Export-Truncated": "1", "X-Export-Total": String(total) }
            : {}),
        },
      },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
