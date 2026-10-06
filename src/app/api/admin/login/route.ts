import { NextRequest, NextResponse } from "next/server";
import { adminAllowList, checkCSRF } from "@/lib/admin-auth";
import { rateLimit, rateKey, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { auth } from "@/lib/auth";
import {
  errorToResponse,
  parseJsonBody,
  AuthError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

/**
 * D05 — budget de confiance du captcha.
 *
 * Le widget Turnstile n'est monté par le client qu'après 3 échecs, et ce
 * compteur vit dans un `useState` : il part de zéro au rechargement de la page
 * et n'est alimenté que par les réponses 401 du serveur. Un attaquant n'a donc
 * qu'à **ne jamais envoyer** `captchaToken` pour que la vérification ne soit
 * jamais exécutée — l'ancien `if (!token) return true` rendait le captcha
 * décoratif.
 *
 * `REQUIRE_CAPTCHA_WHEN_CONFIGURED` porte le choix de politique :
 *   - `true`  → fail-closed. Secret présent ⇒ token obligatoire, sans exception.
 *   - `false` → le captcha redevient un indice (fail-open assumé).
 *
 * Une constante nommée plutôt qu'un littéral : ce réglage mérite d'être lu comme
 * une décision de sécurité datée, et d'être basculé sciemment si le coût UX
 * s'avère trop élevé — pas d'être redécouvert en relisant une condition.
 */
const REQUIRE_CAPTCHA_WHEN_CONFIGURED = true;

/**
 * Longueur maximale d'un token Turnstile. Les tokens émis par Cloudflare font
 * ~1 000 caractères ; au-delà, la valeur n'est pas un token mais une charge
 * utile arbitraire qu'on n'a pas à transmettre à un tiers. Refus sans appel
 * réseau : un attaquant ne peut pas utiliser ce chemin comme amplificateur.
 */
const MAX_TURNSTILE_TOKEN_LENGTH = 2048;

/**
 * Timeout de l'appel siteverify. Fail-closed oblige à borner l'attente : sans
 * `signal`, un Cloudflare lent bloque la requête de connexion jusqu'au timeout
 * d'infrastructure, et le rate-limit devient la seule chose qui protège le
 * serveur — exactement le trou qu'on est en train de refermer.
 */
const TURNSTILE_VERIFY_TIMEOUT_MS = 5000;

/**
 * Avertissement « aucun secret Turnstile configuré » émis **une seule fois par
 * instance**. Sans secret, aucune requête ne peut être vérifiée : ce n'est pas
 * un bug de cette route (déploiement local sans captcha = choix) mais c'est un
 * trou de sécurité à distance, donc il doit être visible. Le flag évite de
 * noyer les logs : une ligne par requête transformerait le signal en bruit.
 */
let turnstileMisconfigWarned = false;

/** Vérifie un token Turnstile. Ne jetable que si le secret est absent (cf. D05). */
async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (!turnstileMisconfigWarned) {
      turnstileMisconfigWarned = true;
      console.warn(
        "[security] TURNSTILE_SECRET_KEY absent : /api/admin/login n'effectue AUCUNE " +
          "vérification de captcha. La connexion admin ne repose que sur le rate-limit " +
          "(10 req / 10 s) et sur ADMIN_OPERATORS. À configurer avant toute exposition publique.",
      );
    }
    return true;
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    // Réseau indisponible / timeout / réponse illisible : fail-closed. Préférer
    // un refus ponctuel à une connexion admin ouverte.
    return false;
  }
}

function auditLogin(ip: string, ref: "success" | "failure", reason?: string) {
  void audit(
    "admin.login",
    "admin_key",
    undefined,
    { result: ref, ...(reason ? { reason } : {}) },
    { type: "ip", ip },
  );
}

/** POST /api/admin/login — sign in with Better Auth email/password (+ Turnstile). */
export async function POST(req: NextRequest) {
  try {
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }

    const rawBody = await parseJsonBody(req);
    const body = (rawBody ?? {}) as { email?: string; password?: string; captchaToken?: unknown };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    // Le corps est du JSON non typé : `captchaToken` peut valoir un nombre, un
    // objet ou un tableau. On l'aplatit en chaîne au lieu de faire confiance au
    // cast — sinon `.trim()` lèverait une TypeError et la requête recevrait un
    // 500 « erreur interne », au lieu d'un refus net.
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken.trim() : "";

    const ip = rateKey(req);
    const rl = await rateLimit(`admin-login:${ip}`, RATE_LIMITS.login);
    if (!rl.ok) {
      throw new RateLimitError(undefined, rl.retryAfterMs);
    }
    if (!email || !password) {
      throw new ValidationError("Email et mot de passe requis.");
    }

    // D05 — décision de sécurité, appliquée CÔTÉ SERVEUR.
    //
    // Avant : `if (captchaToken) { … }`. La condition venait du client, donc
    // l'attaquant la supprimait. Le secret configuré n'était jamais lu si aucun
    // token n'était fourni.
    //
    // Maintenant, seul le serveur décide, et il décide fail-closed :
    //
    //  - secret ABSENT → on laisse passer, parce que le captcha n'est de toute
    //    façon pas disponible (pas de clé site, pas de widget). C'est un choix de
    //    déploiement, pas une faille de cette requête ; le trou est signalé une
    //    fois dans les logs (voir `turnstileMisconfigWarned`), sinon il resterait
    //    invisible jusqu'à un incident.
    //  - secret PRÉSENT → le captcha est obligatoire. Un token absent est traité
    //    comme un token invalide : refuser ici est le seul comportement qui n'est
    //    pas contournable, car « ne pas envoyer de token » ne peut plus signifier
    //    « ne pas être vérifié ».
    //
    // Pourquoi c'est jouable côté client officiel, et pourquoi un 401 : le
    // formulaire n'affiche le widget qu'après 3 réponses 401
    // (`failedAttempts >= 3`). Il suffit donc de répondre `UNAUTHORIZED` : le
    // client compte l'échec, monte le captcha et renvoie le token au 4e essai.
    // Un code dédié (ex. CAPTCHA_REQUIRED) tomberait dans la branche `else` du
    // client, qui n'incrémente PAS le compteur → verrouillage définitif de
    // l'espace admin. Et le 401 ne crée pas d'oracle : un attaquant ne peut pas
    // distinguer « mauvais mot de passe » de « captcha manquant ».
    const captchaMissing =
      REQUIRE_CAPTCHA_WHEN_CONFIGURED &&
      Boolean(process.env.TURNSTILE_SECRET_KEY) &&
      !captchaToken;

    if (captchaMissing) {
      auditLogin(ip, "failure", "captcha_missing");
      throw new AuthError("Captcha requis.", "UNAUTHORIZED");
    }

    if (captchaToken) {
      if (captchaToken.length > MAX_TURNSTILE_TOKEN_LENGTH) {
        auditLogin(ip, "failure", "captcha_oversized");
        throw new AuthError("Captcha invalide. Réessaie.", "UNAUTHORIZED");
      }
      const captchaValid = await verifyTurnstileToken(captchaToken);
      if (!captchaValid) {
        auditLogin(ip, "failure", "captcha_invalid");
        throw new AuthError("Captcha invalide. Réessaie.", "UNAUTHORIZED");
      }
    }

    // Delegate the credential check + session cookie issuance to Better Auth.
    const authRes = await auth.handler(
      new Request("https://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );

    if (!authRes.ok) {
      auditLogin(ip, "failure");
      throw new AuthError("Email ou mot de passe invalide.", "UNAUTHORIZED");
    }

    // Ensure the signed-in user is actually an admin (env allow-list).
    // Fail-closed : une liste vide signifie « personne n'est admin ».
    // Avant, `adminEmails.length === 0` ouvrait l'espace admin à TOUT compte
    // Better Auth valide dès que ADMIN_EMAILS/ADMIN_OPERATORS manquaient.
    if (!adminAllowList().includes(email)) {
      auditLogin(ip, "failure");
      throw new ForbiddenError("Compte non autorisé pour l'espace admin.");
    }

    auditLogin(ip, "success");
    const setCookie = authRes.headers.get("set-cookie") ?? "";
    return NextResponse.json(
      { ok: true },
      { headers: { "Set-Cookie": setCookie } },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
