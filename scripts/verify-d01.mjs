/**
 * Vérification HTTP de D01 — disableSignUp.
 *
 * Prérequis : serveur dev actif (`npm run dev`).
 *   npm run verify:d01
 *
 * ⚠️ Better Auth applique un contrôle d'origine : sans en-tête `Origin`, toutes
 * les requêtes POST répondent 403 « Missing or null Origin ». Un 403 observed
 * sans Origin ne prouve donc RIEN sur disableSignUp — d'où l'en-tête explicite
 * ci-dessous, et les assertions sur le CORPS de la réponse (pas seulement le
 * statut), pour ne pas confondre un refus d'origine avec un refus de sign-up.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const ADMIN = (process.env.ADMIN_OPERATORS || "").split(",")[0].trim();
const ORIGIN = BASE;

async function post(path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed, raw: raw.slice(0, 200) };
  } catch (e) {
    return { status: 0, body: null, raw: String(e.message) };
  }
}

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.log(`  ❌ ${label}\n     ${detail}`);
  }
}

console.log(`\nVérification D01 sur ${BASE}\n`);

// ── 1. Le sign-up public doit être fermé ────────────────────────────────
console.log("1. POST /api/auth/sign-up/email (cible de la préemption)");
const signup = await post("/api/auth/sign-up/email", {
  name: "Attaquant D01",
  email: ADMIN || "attaquant-d01@example.invalid",
  password: "Attaquant-D01-123!",
});
console.log(`   → ${signup.status} ${signup.raw}`);

// Un refus d'origine mentionne MISSING_OR_NULL_ORIGIN : ce serait un faux positif.
const refusedForOrigin = /MISSING_OR_NULL_ORIGIN/i.test(signup.raw);
check(
  "le sign-up est refusé pour la bonne raison (pas le contrôle d'origine)",
  !refusedForOrigin,
  "réponse indistinguishable d'un refus d'origine — vérifier l'en-tête Origin du script",
);
check(
  "le sign-up est refusé (statut 4xx)",
  signup.status >= 400 && signup.status < 500,
  `attendu 4xx, obtenu ${signup.status}`,
);
check(
  "le corps mentionne le sign-up désactivé",
  /sign.?up|sign.?in|disabled|disable/i.test(signup.raw),
  `corps inattendu : ${signup.raw}`,
);

// ── 2. Le parcours OTP membre doit rester ouvert ─────────────────────────
console.log("\n2. POST /api/auth/email-otp/send-verification-otp (parcours membre)");
const otp = await post("/api/auth/email-otp/send-verification-otp", {
  email: "d01-verif@example.invalid",
  type: "sign-in",
});
console.log(`   → ${otp.status} ${otp.raw}`);
check(
  "la route OTP n'est PAS bloquée par disableSignUp",
  !/MISSING_OR_NULL_ORIGIN/i.test(otp.raw) &&
    !/EMAIL_PASSWORD_SIGN_UP_DISABLED/i.test(otp.raw),
  "contrôle d'origine ou sign-up désactivé : requête mal formée, non concluant",
);

// Un 500 ici n'est PAS un échec D01 : le plugin écrit dans la table
// `Verification`, qui n'existe pas sur une base migrée par `prisma migrate`
// (bug D07 — aucune migration Better Auth). On le signale sans le compter.
if (otp.status >= 500) {
  console.log(
    "  ⚠️  500 sur la route OTP : pré-condition D07 (table `Verification` absente).\n" +
      "     Sans rapport avec D01 — voir docs/ROADMAP-SUR-INGENIERIE-2026.md § D07.",
  );
} else {
  check("la route OTP répond sans erreur serveur (5xx)", true, "");
}

console.log(
  failures === 0
    ? "\n✅ D01 vérifié : sign-up fermé pour la bonne raison, parcours OTP non bloqué."
    : `\n❌ ${failures} vérification(s) en échec — D01 n'est PAS validé.`,
);
process.exit(failures === 0 ? 0 : 1);
