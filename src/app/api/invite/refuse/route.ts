import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1).max(64),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/invite/refuse
 *
 * Route PUBLIQUE — pas besoin d'auth.
 * Désactivée : le flux d'invitation réel utilise /verify-otp?email=&code=&next=
 * avec OTP envoyé séparément par Better Auth.
 * Toutes les requêtes renvoient une erreur générique pour éviter l'énumération
 * et préserver le taux de limitation.
 */
export async function POST(req: NextRequest) {
  // Rate limiting pour protéger contre le bruteforce (10 req/IP/10min)
  const rl = await rateLimit(`invite-refuse:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }

  // Toujours retourner la même erreur pour éviter l'énumération d'emails
  // Le corps est parsé seulement pour valider la forme du schéma Zod
  // mais n'est utilisé nulle part (route délibérément inerte)
  bodySchema.safeParse(await req.json());

  return NextResponse.json(
    { error: "Lien invalide ou expiré." },
    { status: 403 },
  );
}

/**
 * GET /api/invite/refuse?email=...&token=...
 *
 * Affiche une page HTML de confirmation de refus (pas besoin de JS).
 * Cette route reste inchangée car elle est uniquement utilisée pour afficher
 * une page statique après un refus réussi via le flux réel (qui ne passe pas
 * par cette route). En pratique, cette route n'est jamais appelée car le
 * flux de refus réel utilise le POST ci-dessus suivi d'une redirection côté
 * client ou d'une page de confirmation intégrée.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  if (!email || !token) {
    return new NextResponse(
      `<html><body style="background:#0A0A0A;color:#F8FAFC;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;"><div style="text-align:center;"><h1>Lien invalide</h1><p style="color:#94A3B8;">Ce lien de refus n'est pas valide.</p></div></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } },
    );
  }

  // Appeler le handler POST pour traiter le refus (même logique inerte)
  const postReq = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token }),
  });
  const postRes = await POST(postReq as NextRequest);
  const postData = await postRes.json();

  const bgColor = "#0A0A0A";
  const cardBg = "#141414";
  const lime = "#C5F441";
  const text = "#F8FAFC";
  const muted = "#94A3B8";

  if (postData.ok) {
    return new NextResponse(
      `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;aligniments:center;min-height:100vh;"><div style="max-width:480px;width:100%;padding:32px;"><div style="background:${cardBg};border:1px solid #262626;border-radius:12px;padding:32px;"><div style="font-size:48px;margin-bottom:16px;">👋</div><h1 style="margin:0 0 12px 0;font-size:24px;color:${text};">Invitation refusée</h1><p style="margin:0;font-size:15px;line-height:1.6;color:${muted};">Merci pour ta réponse. Tu ne recevras plus d'emails d'invitation de la part de HASHCODE REBOOT.</p><div style="border-top:1px solid #262626;padding-top:16px;"><p style="margin:0;font-size:12px;color:#64748B;">HASHCODE · REBOOT</p></div></div></div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  return new NextResponse(
    `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:${bgColor};font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;"><div style="max-width:480px;width:100%;padding:32px;"><div style="background:${cardBg};border:1px solid #262626;border-radius:12px;padding:32px;"><div style="font-size:48px;margin-bottom:16px;">⚠️</div><h1 style="margin:0 0 12px 0;font-size:24px;color:${text};">Erreur</h1><p style="margin:0;font-size:15px;color:${muted};">${postData.error || "Une erreur est survenue."}</p></div></div></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html" } },
  );
}