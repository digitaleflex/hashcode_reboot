import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/audit-log
 * 
 * Query params:
 *   format  - "json" (default) or "csv"
 *   limit   - max records (default 1000, max 10000)
 *
 * Requires operator role.
 */
export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit
      ? Math.min(Math.max(1, Number(rawLimit) || 1), 10000)
      : 1000;

    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (format === "csv") {
      const escape = (s: string | null): string => {
        if (!s) return "";
        const escaped = s.replace(/"/g, '""');
        return `"${escaped}"`;
      };

      const header = "id,createdAt,actor,action,entityType,entityId,metadata\n";
      const rows = logs
        .map(
          (l) =>
            [
              l.id,
              l.createdAt.toISOString(),
              escape(l.actor),
              escape(l.action),
              escape(l.entityType),
              escape(l.entityId),
              escape(l.metadata),
            ].join(","),
        )
        .join("\n");

      return new NextResponse(header + rows, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-log-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ logs, total: logs.length });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}