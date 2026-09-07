import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!isAdminAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.$queryRaw<
    Array<{
      cohort: string;
      total: bigint;
      week1: bigint;
      week2: bigint;
      week4: bigint;
      week8: bigint;
    }>
  >`
    SELECT
      to_char(date_trunc('week', "createdAt"), 'IYYY-IW') AS cohort,
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE "profileStatus" NOT IN ('PENDING', 'REJECTED')
          AND "createdAt" + INTERVAL '1 week' <= NOW()
          AND "deletedAt" IS NULL
      ) AS week1,
      COUNT(*) FILTER (
        WHERE "profileStatus" NOT IN ('PENDING', 'REJECTED')
          AND "createdAt" + INTERVAL '2 weeks' <= NOW()
          AND "deletedAt" IS NULL
      ) AS week2,
      COUNT(*) FILTER (
        WHERE "profileStatus" NOT IN ('PENDING', 'REJECTED')
          AND "createdAt" + INTERVAL '4 weeks' <= NOW()
          AND "deletedAt" IS NULL
      ) AS week4,
      COUNT(*) FILTER (
        WHERE "profileStatus" NOT IN ('PENDING', 'REJECTED')
          AND "createdAt" + INTERVAL '8 weeks' <= NOW()
          AND "deletedAt" IS NULL
      ) AS week8
    FROM "Member"
    WHERE "deletedAt" IS NULL
    GROUP BY cohort
    ORDER BY cohort DESC
    LIMIT 16
  `;

  return NextResponse.json(
    rows.map((r) => ({
      cohort: r.cohort,
      total: Number(r.total),
      week1: Number(r.week1),
      week2: Number(r.week2),
      week4: Number(r.week4),
      week8: Number(r.week8),
    })),
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
