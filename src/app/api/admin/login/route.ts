import { NextRequest, NextResponse } from "next/server";
import { adminCookieHeader, issueAdminToken, getAdminPasscode } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** POST /api/admin/login — verify passcode, issue admin cookie. */
export async function POST(req: NextRequest) {
  let body: { passcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const passcode = (body.passcode ?? "").trim();
  if (!passcode) {
    return NextResponse.json({ error: "Passcode requis." }, { status: 422 });
  }
  // Constant-time compare.
  const expected = getAdminPasscode();
  if (passcode.length !== expected.length) {
    return NextResponse.json({ error: "Passcode invalide." }, { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < passcode.length; i++) {
    diff |= passcode.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return NextResponse.json({ error: "Passcode invalide." }, { status: 401 });
  }
  const token = issueAdminToken();
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": adminCookieHeader(token) } },
  );
}
