import { NextResponse } from "next/server";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { AuthError, errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
    const memberId = session.member.id;

    const [referrals, ledger] = await Promise.all([
      db.referral.findMany({
        where: { referrerId: memberId },
        include: { referee: { select: { firstName: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.pointsLedger.findMany({
        where: { memberId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const balance = ledger.reduce((s, l) => s + l.delta, 0);
    const validated = referrals.filter((r) => r.status === "validated").length;

    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
    return NextResponse.json({
      ok: true,
      code: memberId,
      url: `${base}?ref=${memberId}`,
      balance,
      totalReferrals: referrals.length,
      validatedReferrals: validated,
      referrals: referrals.map((r) => ({
        name: r.referee.firstName,
        status: r.status,
        createdAt: r.createdAt,
      })),
      ledger: ledger.map((l) => ({
        delta: l.delta,
        reason: l.reason,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
