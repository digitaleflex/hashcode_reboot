#!/usr/bin/env node
/**
 * Parcours complet de bout en bout (smoke test) contre un serveur qui tourne.
 *
 * visiteur → inscription (profilage) → connexion par code → espace membre
 * → l'admin crée une mission et un événement → le membre démarre, soumet,
 * s'inscrit → l'admin relit → contrôles de sécurité (rôles, CSRF, admin
 * supprimé).
 *
 * Usage (base de TEST uniquement) :
 *   DATABASE_URL=postgresql://... BASE_URL=http://localhost:3000 \
 *     node scripts/smoke-journey.cjs
 *
 * Sécurité : refuse de tourner si la base n'est pas locale, sauf
 * SMOKE_ALLOW_REMOTE=1. Les données créées portent un identifiant de run
 * (`smoke-<run>-…@example.com`) et sont supprimées à la fin (au mieux).
 *
 * Le code de connexion est lu directement dans la table Verification :
 * aucun fournisseur d'emails n'est nécessaire.
 * Sortie : code 0 si tout passe, 1 sinon.
 */
const { PrismaClient } = require("@prisma/client");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const RUN = Date.now().toString(36);
const MEMBER_EMAIL = `smoke-${RUN}-membre@example.com`;
const ADMIN_EMAIL = `smoke-${RUN}-admin@example.com`;

const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl) {
  console.error("DATABASE_URL manquant.");
  process.exit(2);
}
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(dbUrl) && process.env.SMOKE_ALLOW_REMOTE !== "1") {
  console.error("Base non locale : ce script écrit des données. Relance avec SMOKE_ALLOW_REMOTE=1 si tu es sûr.");
  process.exit(2);
}

const db = new PrismaClient();
let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Client HTTP avec jar de cookies. `origin: false` simule un appel sans Origin. */
class Client {
  constructor() {
    this.cookies = new Map();
    // Une IP fictive par client : les limites par IP (ex. 5 inscriptions
    // / 10 min) ne bloquent pas des lancements répétés. Valable derrière
    // un proxy qui ajoute l'IP réelle en fin d'en-tête ; en local, c'est
    // la valeur envoyée qui compte.
    this.ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  }
  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async req(method, path, body, { origin = true } = {}) {
    const headers = { "Content-Type": "application/json", "X-Forwarded-For": this.ip };
    if (origin) headers.Origin = BASE;
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    let json = null;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      /* corps non JSON */
    }
    return { status: res.status, json, text };
  }
}

const PROFILE = (email, firstName) => ({
  firstName,
  lastName: "Smoke",
  email,
  phone: "+22961000000",
  country: "BJ",
  city: "Cotonou",
  primaryDomain: "web",
  secondaryDomains: [],
  level: "beginner",
  goal: "project",
  availability: "5-10h",
  learningStyle: "practice",
  mentoringInterest: "no",
  threeMonthGoal: "Construire un portfolio de 3 projets web",
});

async function login(client, email) {
  const send = await client.req("POST", "/api/auth/email-otp/send-verification-otp", {
    email,
    type: "sign-in",
  });
  if (send.status !== 200) return { ok: false, step: "envoi du code", res: send };
  const row = await db.verification.findFirst({
    where: { identifier: `sign-in-otp-${email}` },
    orderBy: { createdAt: "desc" },
  });
  const otp = row?.value?.split(":")[0];
  if (!otp) return { ok: false, step: "code introuvable en base" };
  const signIn = await client.req("POST", "/api/auth/sign-in/email-otp", { email, otp });
  return { ok: signIn.status === 200, step: "connexion", res: signIn };
}

async function cleanup() {
  const emails = [MEMBER_EMAIL, ADMIN_EMAIL];
  const run = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      console.log(`  (nettoyage ${label} ignoré : ${String(e.message).split("\n")[0]})`);
    }
  };
  await run("événements", () => db.event.deleteMany({ where: { title: { startsWith: `Smoke ${RUN}` } } }));
  await run("missions", async () => {
    const ms = await db.mission.findMany({ where: { slug: { startsWith: `smoke-${RUN}` } }, select: { id: true } });
    const ids = ms.map((m) => m.id);
    await db.missionSubmission.deleteMany({ where: { missionId: { in: ids } } }).catch(() => {});
    await db.missionAssignment.deleteMany({ where: { missionId: { in: ids } } }).catch(() => {});
    await db.mission.deleteMany({ where: { id: { in: ids } } });
  });
  await run("sessions et utilisateurs", () => db.user.deleteMany({ where: { email: { in: emails } } }));
  await run("codes", () =>
    db.verification.deleteMany({ where: { identifier: { in: emails.map((e) => `sign-in-otp-${e}`) } } }),
  );
  await run("membres", async () => {
    await db.memberBlacklist.deleteMany({ where: { email: { in: emails } } });
    await db.member.deleteMany({ where: { email: { in: emails } } });
  });
}

async function main() {
  console.log(`Parcours de test — ${BASE} (run ${RUN})`);

  section("1. Le site répond");
  const anon = new Client();
  const health = await anon.req("GET", "/api/health");
  check("GET /api/health répond", health.status === 200, `statut ${health.status}`);

  section("2. Visiteur → inscription (profilage)");
  const m1 = await anon.req("POST", "/api/members", PROFILE(MEMBER_EMAIL, "Membre"));
  check("inscription du membre", (m1.status === 200 || m1.status === 201) && m1.json?.ok === true, `statut ${m1.status} ${m1.text.slice(0, 120)}`);
  check("profil généré (archétype)", !!m1.json?.profile?.archetype);
  check("accès immédiat ou file d'attente", ["immediate", "pending"].includes(m1.json?.accessLane), String(m1.json?.accessLane));
  const m1again = await new Client().req("POST", "/api/members", PROFILE(MEMBER_EMAIL, "Membre"));
  check("même email → pas de doublon", m1again.json?.duplicate === true);
  const m2 = await new Client().req("POST", "/api/members", PROFILE(ADMIN_EMAIL, "Admin"));
  check("inscription du futur admin", (m2.status === 200 || m2.status === 201) && m2.json?.ok === true);

  section("3. Connexion par code (membre)");
  const member = new Client();
  const l1 = await login(member, MEMBER_EMAIL);
  check("connexion par code réussie", l1.ok, l1.ok ? "" : `${l1.step} ${l1.res?.status ?? ""}`);
  const sess = await member.req("GET", "/api/auth/session");
  check("session active", sess.json?.authenticated === true);
  const me = await member.req("GET", "/api/account/me");
  check("profil accessible (/api/account/me)", me.status === 200 && me.json?.member?.email === MEMBER_EMAIL);
  const wrongOtp = await new Client().req("POST", "/api/auth/sign-in/email-otp", { email: MEMBER_EMAIL, otp: "000000" });
  check("mauvais code refusé", wrongOtp.status >= 400 && wrongOtp.status < 500, `statut ${wrongOtp.status}`);

  section("4. Rôles : un membre n'est pas admin");
  const memberOnAdmin = await member.req("GET", "/api/admin/missions");
  check("membre → /api/admin/missions refusé", [401, 403].includes(memberOnAdmin.status), `statut ${memberOnAdmin.status}`);
  const anonOnAdmin = await new Client().req("GET", "/api/admin/missions");
  check("anonyme → /api/admin/missions refusé", [401, 403].includes(anonOnAdmin.status), `statut ${anonOnAdmin.status}`);

  section("5. Admin : connexion et création de contenu");
  await db.member.update({ where: { email: ADMIN_EMAIL }, data: { adminRole: "operator" } });
  const admin = new Client();
  const l2 = await login(admin, ADMIN_EMAIL);
  check("connexion de l'admin", l2.ok, l2.ok ? "" : `${l2.step} ${l2.res?.status ?? ""}`);
  const verify = await admin.req("GET", "/api/admin/verify");
  check("rôle admin reconnu", verify.status === 200, `statut ${verify.status} ${verify.text.slice(0, 100)}`);

  const slug = `smoke-${RUN}-premiere-mission`;
  const noOrigin = await admin.req(
    "POST",
    "/api/admin/missions",
    { slug, title: `Smoke ${RUN} mission`, description: "Test", domain: "web", level: "beginner" },
    { origin: false },
  );
  check("création sans en-tête Origin refusée (CSRF)", noOrigin.status === 403, `statut ${noOrigin.status}`);
  const created = await admin.req("POST", "/api/admin/missions", {
    slug,
    title: `Smoke ${RUN} mission`,
    description: "Mission de test",
    domain: "web",
    level: "beginner",
  });
  check("création d'une mission", created.status === 201, `statut ${created.status} ${created.text.slice(0, 120)}`);
  const missionId = created.json?.mission?.id;
  const before = await member.req("GET", "/api/missions");
  check(
    "mission brouillon invisible pour le membre",
    !(before.json?.missions ?? []).some((x) => x.id === missionId),
  );
  const published = await admin.req("PATCH", `/api/admin/missions/${missionId}`, { status: "PUBLISHED" });
  check("publication de la mission", published.status === 200, `statut ${published.status}`);

  const startsAt = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  const ev = await admin.req("POST", "/api/events", {
    title: `Smoke ${RUN} événement`,
    description: "Événement de test",
    startsAt,
    type: "session",
  });
  check("création d'un événement", ev.status === 201 || ev.status === 200, `statut ${ev.status} ${ev.text.slice(0, 120)}`);
  const eventId = ev.json?.event?.id ?? ev.json?.id;

  section("6. Membre : mission et événement");
  const list = await member.req("GET", "/api/missions");
  check(
    "la mission publiée apparaît",
    (list.json?.missions ?? []).some((x) => x.id === missionId),
    `${(list.json?.missions ?? []).length} mission(s)`,
  );
  const start = await member.req("POST", `/api/missions/${missionId}/start`, {});
  check("démarrer la mission", start.status === 200 || start.status === 201, `statut ${start.status} ${start.text.slice(0, 120)}`);
  const submit = await member.req("POST", `/api/missions/${missionId}/submit`, {
    content: "Voici ma réalisation : https://example.com/mon-projet",
  });
  check("soumettre la réalisation", submit.status === 200 || submit.status === 201, `statut ${submit.status} ${submit.text.slice(0, 120)}`);
  const dbl = await member.req("POST", `/api/missions/${missionId}/submit`, { content: "Deuxième envoi" });
  check("double soumission en attente refusée (409)", dbl.status === 409, `statut ${dbl.status}`);

  if (eventId) {
    const evs = await member.req("GET", "/api/events");
    check("l'événement apparaît pour le membre", (evs.json?.events ?? []).some((e) => e.id === eventId));
    const rsvp = await member.req("POST", `/api/events/${eventId}/rsvp`, { status: "going" });
    check("inscription à l'événement (RSVP)", rsvp.status === 200 || rsvp.status === 201, `statut ${rsvp.status} ${rsvp.text.slice(0, 100)}`);
  } else {
    check("identifiant de l'événement récupéré", false, ev.text.slice(0, 120));
  }

  section("7. Admin : relecture de la soumission");
  const subs = await admin.req("GET", "/api/admin/mission-submissions?status=PENDING");
  const sub = (subs.json?.submissions ?? []).find((s) => s.missionId === missionId || s.mission?.id === missionId);
  check("la soumission est visible côté admin", !!sub, `statut ${subs.status}, ${(subs.json?.submissions ?? []).length} soumission(s)`);
  if (sub) {
    const review = await admin.req("POST", `/api/admin/mission-submissions/${sub.id}/review`, {
      decision: "APPROVED",
      feedback: "Bravo, c'est validé.",
    });
    check("validation de la soumission", review.status === 200, `statut ${review.status} ${review.text.slice(0, 120)}`);
    const after = await member.req("GET", "/api/missions");
    const mine = (after.json?.missions ?? []).find((x) => x.id === missionId);
    check("le membre voit la mission terminée", !!mine, JSON.stringify(mine ?? {}).slice(0, 160));
  }

  section("8. Données personnelles (RGPD)");
  const exp = await member.req("GET", "/api/account/export");
  check("export des données du membre", exp.status === 200, `statut ${exp.status}`);
  const consent = await new Client().req("POST", "/api/consents", {
    purpose: "cookies",
    choice: "granted",
    textVersion: "smoke",
  });
  check("consentement anonyme enregistré", consent.status === 201, `statut ${consent.status}`);
  const readOther = await new Client().req("GET", `/api/consents?email=${encodeURIComponent(MEMBER_EMAIL)}`);
  check("lecture du consentement d'un tiers refusée", readOther.status === 401 || readOther.status === 403, `statut ${readOther.status}`);

  section("9. Un admin supprimé perd son accès immédiatement");
  const beforeDel = await admin.req("GET", "/api/admin/missions");
  check("avant suppression : accès admin", beforeDel.status === 200, `statut ${beforeDel.status}`);
  await db.member.update({ where: { email: ADMIN_EMAIL }, data: { deletedAt: new Date() } });
  const afterDel = await admin.req("GET", "/api/admin/missions");
  check("après suppression : accès refusé", [401, 403].includes(afterDel.status), `statut ${afterDel.status}`);
  await db.member.update({ where: { email: ADMIN_EMAIL }, data: { deletedAt: null } });
  await db.memberBlacklist.create({ data: { email: ADMIN_EMAIL, reason: "other", note: "smoke" } });
  const afterBl = await admin.req("GET", "/api/admin/missions");
  check("après blacklist : accès refusé", [401, 403].includes(afterBl.status), `statut ${afterBl.status}`);
}

main()
  .catch((e) => {
    fail += 1;
    failures.push("erreur inattendue");
    console.error("\n💥 Erreur inattendue :", e);
  })
  .finally(async () => {
    console.log("\nNettoyage…");
    await cleanup();
    await db.$disconnect();
    console.log(`\nRésultat : ${pass} réussi(s), ${fail} échec(s).`);
    if (fail) console.log("Échecs :\n - " + failures.join("\n - "));
    process.exit(fail ? 1 : 0);
  });
