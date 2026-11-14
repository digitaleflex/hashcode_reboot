import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Placeholder: returns a referral link based on member id.
// Auth: member session (better-auth). For now, accept memberId via query for dev.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId requis" }, { status: 400 });
  }
  const member = await db.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
  const code = member.id;
  return NextResponse.json({ ok: true, code, url: `${base}?ref=${code}` });
}
