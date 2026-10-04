import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { AppError, ForbiddenError, errorToResponse } from "@/lib/errors";

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
  try {
  if (!(await requireAdminRole(req, "operator"))) {
    throw new ForbiddenError("Accès refusé.");
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

    // Enrichit les logs liés à un membre avec email/prénom/statut pour le détail par user
    const memberIds = [
      ...new Set(
        logs
          .filter((l) => l.entityType === "member" && l.entityId)
          .map((l) => l.entityId as string),
      ),
    ];
    const members =
      memberIds.length > 0
        ? await db.member.findMany({
            where: { id: { in: memberIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileStatus: true,
              country: true,
              city: true,
            },
          })
        : [];
    const memberById = new Map(members.map((m) => [m.id, m]));
    const enriched = logs.map((l) => ({
      ...l,
      member:
        l.entityType === "member" && l.entityId
          ? (memberById.get(l.entityId) ?? null)
          : null,
    }));

    if (format === "csv") {
      const escape = (s: string | null): string => {
        if (!s) return "";
        const escaped = s.replace(/"/g, '""');
        return `"${escaped}"`;
      };

      const header =
        "id,createdAt,actor,action,entityType,entityId,memberEmail,memberName,metadata\n";
      const rows = enriched
        .map((l) => {
          const m = (l as { member?: { email?: string; firstName?: string; lastName?: string | null } | null }).member;
          return [
            l.id,
            l.createdAt.toISOString(),
            escape(l.actor),
            escape(l.action),
            escape(l.entityType),
            escape(l.entityId),
            escape(m?.email ?? null),
            escape(m ? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || null : null),
            escape(l.metadata),
          ].join(",");
        })
        .join("\n");

      return new NextResponse(header + rows, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-log-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ logs: enriched, total: enriched.length });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Erreur interne.", { status: 500, code: "INTERNAL_ERROR" });
  }
  } catch (err) {
    return errorToResponse(err);
  }
}