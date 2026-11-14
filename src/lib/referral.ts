import { db } from "@/lib/db";

/** Crédite les points au parrain quand le filleul est validé (APPROVED). */
export async function creditReferralPoints(refereeId: string): Promise<void> {
  try {
    const referral = await db.referral.findUnique({
      where: { refereeId },
      include: { referrer: { select: { id: true } } },
    });
    if (!referral || referral.status === "validated") return;

    await db.$transaction([
      db.referral.update({
        where: { id: referral.id },
        data: { status: "validated", validatedAt: new Date() },
      }),
      db.pointsLedger.create({
        data: {
          memberId: referral.referrerId,
          delta: 100,
          reason: "referral_validated",
          referralId: referral.id,
        },
      }),
    ]);
  } catch {
    /* best-effort */
  }
}