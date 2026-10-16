import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
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

/** GET /api/export — CSV (admin). Filtres whitelistés + `segment=` + `fields=`.
 * Colonnes par défaut minimisées (#153) ; `fields=adminNote,adminRole` en opt-in.
 * Plafond signalé par headers X-Export-*. */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthed(req))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }
    // Anti-abus : 20 exports par IP toutes les 10 minutes.
    const rl = await rateLimit(`export:${rateKey(req)}`, {
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
    const headers = resolveExportColumns(filters.fields);
    const where = await buildExportWhere(filters);

    const [total, members] = await Promise.all([
      db.member.count({ where }),
      db.member.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: EXPORT_MAX,
      }),
    ]);

    const esc = (v: unknown): string => {
      const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
      // RFC 4180 quoting.
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = members.map((m) => {
      const row = m as unknown as Record<string, unknown>;
      return headers.map((h) => esc(row[h])).join(",");
    });

    const csv = [headers.map(esc).join(","), ...rows].join("\r\n");
    const truncated = total > EXPORT_MAX;
    await auditExport(req, { format: "csv", exported: members.length, total, truncated });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hashcode-reboot-members-${Date.now()}.csv"`,
        "Cache-Control": "no-store",
        ...(truncated
          ? { "X-Export-Truncated": "1", "X-Export-Total": String(total) }
          : {}),
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
