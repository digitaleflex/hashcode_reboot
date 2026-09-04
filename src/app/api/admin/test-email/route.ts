import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { WHATSAPP_URL } from "@/lib/profiling/auto-controls";
import { sendInvitationEmail, sendWelcomeEmail } from "@/lib/mail";

export const runtime = "nodejs";

const testEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  kind: z.enum(["welcome", "invite", "both"]),
});

/** POST /api/admin/test-email — envoi réel de test (admin-only). */
export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  // Anti-abus : 5 envois de test par IP toutes les 10 minutes.
  const rl = rateLimit(`admin-test-email:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const parsed = testEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Données invalides.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }
  const { email, kind } = parsed.data;

  const sent: string[] = [];
  if (kind === "welcome" || kind === "both") {
    const res = await sendWelcomeEmail({
      to: email,
      firstName: "Test",
      archetype: "CYBER BUILDER",
    });
    if (res.ok) sent.push("welcome");
  }
  if (kind === "invite" || kind === "both") {
    const res = await sendInvitationEmail({
      to: email,
      firstName: "Test",
      whatsappUrl: WHATSAPP_URL,
    });
    if (res.ok) sent.push("invite");
  }

  const expected = kind === "both" ? 2 : 1;
  const ok = sent.length === expected;
  // Traçabilité d'usage sans PII : kind + résultat uniquement, jamais l'email.
  console.log(`[admin-test-email] kind=${kind} ok=${ok}`);
  return NextResponse.json({ ok, sent });
}
