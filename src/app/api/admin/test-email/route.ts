import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkCSRF, requireAdmin, adminGuardResponse } from "@/lib/admin-auth";
import { blockIfTesting } from "@/lib/test-guard";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { sendInvitationEmail, sendWelcomeEmail } from "@/lib/mail";
import {
  ForbiddenError,
  RateLimitError,
  ValidationError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";

const testEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  kind: z.enum(["welcome", "invite", "both"]),
});

/** POST /api/admin/test-email — envoi réel de test (admin-operator only). */
export async function POST(req: NextRequest) {
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;

  const adminGuard = await requireAdmin(req, "operator");
  if (!adminGuard.ok) return adminGuardResponse(adminGuard);
  // CSRF protection: ensure same-origin request
  if (!checkCSRF(req)) {
    // D26 — 403 conservé, `code` ajouté.
    throw new ForbiddenError("CSRF validation failed.");
  }
  // Anti-abus : 5 envois de test par IP toutes les 10 minutes.
  const rl = await rateLimit(`admin-test-email:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    throw new RateLimitError(
      "Trop de requêtes. Réessaie dans quelques minutes.",
      rl.retryAfterMs,
    );
  }

  const body = await parseJsonBody(req);

  const parsed = testEmailSchema.safeParse(body);
  if (!parsed.success) {
    // D26 — 422 : clé `issues` renommée `details` (personne ne la lit).
    throw new ValidationError(
      "Données invalides.",
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
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
    const siteBase =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_URL ||
      "https://reboot.joinhashcode.com";
    const res = await sendInvitationEmail({
      to: email,
      firstName: "Test",
      dashboardUrl: `${siteBase.replace(/\/$/, "")}/dashboard`,
    });
    if (res.ok) sent.push("invite");
  }

  const expected = kind === "both" ? 2 : 1;
  const ok = sent.length === expected;
  // Traçabilité d'usage sans PII : kind + résultat uniquement, jamais l'email.
  console.log(`[admin-test-email] kind=${kind} ok=${ok}`);
  return NextResponse.json({ ok, sent });
  } catch (err) {
    return errorToResponse(err);
  }
}
