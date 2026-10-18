/**
 * E2E — Funnel acquisition → conversion (#113).
 *
 * Visitor → diagnostic (10-11 questions) → lead (POST /api/members) →
 * résultat. Plus : email invalide, double soumission (idempotence),
 * reprise brouillon (reload → prompt), consentement (retrait traçé),
 * gate handoff (sans consentement = pas de transmission possible).
 *
 * GARDE-FOU : ne s'exécute QUE si FUNNEL_DATABASE_URL est définie (base de
 * test isolée, jamais dev/prod). Le serveur testé DOIT utiliser la même base
 * (CI : job e2e-funnel avec Postgres éphémère ; local : build + start avec
 * DATABASE_URL=<base test>).
 * Emails uniques par run (example.com, jamais délivrés) + cleanup afterAll.
 *
 * Run local : BUILD puis
 *   DATABASE_URL=postgresql://hashcode:hashcode@127.0.0.1:5433/<test> \
 *   FUNNEL_DATABASE_URL=$DATABASE_URL \
 *   BASE_URL=http://localhost:3000 \
 *   npx playwright test tests/e2e/funnel-acquisition.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";

const ENABLED = !!process.env.FUNNEL_DATABASE_URL;
const RUN = `f113${Date.now().toString(36)}`;
const email = (tag: string) => `funnel-${RUN}-${tag}@example.com`;

function getDb() {
  return new PrismaClient({ datasources: { db: { url: process.env.FUNNEL_DATABASE_URL } } });
}

async function dismissCookies(page: Page) {
  const close = page.getByRole("button", { name: "Fermer et refuser" });
  if ((await close.count()) > 0) await close.first().click();
}

async function startProfiling(page: Page) {
  await page.goto("/fr", { waitUntil: "load" });
  await dismissCookies(page);
  await page.getByRole("button", { name: "Construire mon profil" }).first().click();
  await page.getByRole("button", { name: "Continuer" }).first().waitFor({ timeout: 60000 });
}

const SKIP_BTNS = /retour|continuer|passer|sélectionne|voir|découvrir|terminer|envoyer|recommencer|commencer|finaliser/i;

const isPost = (r: { url(): string; request(): { method(): string } }) =>
  r.url().includes("/api/members") && r.request().method() === "POST";

async function axeClean(
  page: Page,
  label: string,
): Promise<{ violations: number; passes: number }> {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  for (const v of r.violations) {
    console.log(`AXE ${label}: ${v.id} (${v.impact}) x${v.nodes.length}`);
  }
  expect(
    r.violations,
    `violations axe ${label}: ${r.violations.map((v) => v.id).join(",")}`,
  ).toEqual([]);
  return { violations: r.violations.length, passes: r.passes.length };
}

async function questionOf(page: Page): Promise<string> {
  const txt = ((await page.locator("body").first().innerText()) || "").replace(/\s+/g, " ");
  const qm = txt.match(/Question (\d+) sur (\d+)/);
  return qm ? `${qm[1]}/${qm[2]}` : "?";
}

async function answerStep(page: Page, mail: string): Promise<"advanced" | "review" | "stuck"> {
  await page.waitForTimeout(700);
  // Écran de relecture → Finaliser.
  const fin = page.getByRole("button", { name: "Finaliser mon profil" });
  if ((await fin.count()) > 0) {
    try {
      if (await fin.first().isVisible({ timeout: 3000 })) return "review";
    } catch {}
  }
  // Pays : ouvrir, vider la recherche, choisir, attendre fermeture.
  const paysBtn = page.getByRole("button", { name: /sélectionne ton pays/i });
  if ((await paysBtn.count()) > 0) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await paysBtn.first().click({ timeout: 5000 });
        await page.getByRole("dialog").first().waitFor({ timeout: 8000 });
        const search = page.getByRole("textbox", { name: /rechercher un pays/i });
        if ((await search.count()) > 0) await search.first().fill("");
        await page.getByRole("button", { name: "Bénin" }).first().click({ timeout: 8000 });
        await page.getByRole("dialog").waitFor({ state: "detached", timeout: 8000 });
        break;
      } catch {}
    }
  }
  // Textes (jamais la recherche pays).
  for (const b of await page.getByRole("textbox").all()) {
    try {
      if (!(await b.isVisible()) || (await b.inputValue()) !== "") continue;
      const hint = (
        ((await b.getAttribute("placeholder")) || "") +
        " " +
        ((await b.getAttribute("name")) || "") +
        " " +
        ((await b.getAttribute("aria-label")) || "")
      ).toLowerCase();
      if (/recherch/.test(hint)) continue;
      let v = "Sonde";
      if (/@/.test(hint)) v = mail;
      else if (/ville|city/.test(hint)) v = "Cotonou";
      else if (/tel|phone/.test(hint)) v = "+22990000003";
      else if (/objectif|goal|mois|month|vision|rêve|reve|projet/.test(hint))
        v = "Devenir autonome en développement";
      await b.fill(v);
    } catch {}
  }
  const cont = page.getByRole("button", { name: "Continuer" });
  const hasCont = (await cont.count()) > 0;
  // Choix unique SANS Continuer : la sélection fait avancer — cliquer avec
  // vérification (sinon "stuck" honnête au lieu de tourner).
  const digitBtns: string[] = [];
  for (const b of await page.getByRole("button").all()) {
    try {
      const t = ((await b.textContent()) || "").trim();
      if (!(await b.isVisible()) || SKIP_BTNS.test(t)) continue;
      if (/^[1-9][\s\S]/.test(t)) digitBtns.push(t);
    } catch {}
  }
  if (digitBtns.length > 0 && !hasCont) {
    const before = await questionOf(page);
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const b of await page.getByRole("button").all()) {
        try {
          const t = ((await b.textContent()) || "").trim();
          if (!(await b.isVisible()) || SKIP_BTNS.test(t)) continue;
          if (/^[1-9][\s\S]/.test(t)) {
            await b.click({ timeout: 4000 });
            break;
          }
        } catch {}
      }
      await page.keyboard.press("1").catch(() => {});
      await page.waitForTimeout(600);
      if ((await questionOf(page)) !== before) return "advanced";
    }
    return "stuck";
  }
  // Chips multi : exactement 2 (ni 0 ni tout).
  let chips = 0;
  for (const b of await page.getByRole("button").all()) {
    if (chips >= 2) break;
    try {
      const t = ((await b.textContent()) || "").trim();
      if (!(await b.isVisible()) || SKIP_BTNS.test(t) || /^[1-9][\s\S]/.test(t)) continue;
      await b.click();
      chips++;
      await page.waitForTimeout(250);
    } catch {}
  }
  if ((await page.getByRole("radio").count()) + (await page.getByRole("checkbox").count()) > 0) {
    await page.keyboard.press("1");
    await page.waitForTimeout(300);
  }
  if (hasCont) {
    try {
      await cont.first().click({ timeout: 5000 });
      return "advanced";
    } catch {}
  }
  return "stuck";
}

async function runToReview(page: Page, mail: string) {
  let lastQ = "";
  let sameCount = 0;
  for (let i = 0; i < 26; i++) {
    const st = await answerStep(page, mail);
    if (st === "review") return;
    if (st === "stuck") throw new Error(`funnel bloqué à l'étape ${i}`);
    const txt = ((await page.locator("body").first().innerText()) || "").replace(/\s+/g, " ");
    const qm = txt.match(/Question (\d+) sur (\d+)/);
    const q = qm ? qm[1] : "?";
    sameCount = q === lastQ ? sameCount + 1 : 0;
    lastQ = q;
    // 4 itérations sans avancer = état bloqué (pas de sens de continuer).
    if (sameCount >= 3) {
      const btns: string[] = [];
      for (const b of await page.getByRole("button").all()) {
        try {
          if (await b.isVisible())
            btns.push(`[${((await b.textContent()) || "").trim().slice(0, 24)}${await b.isDisabled() ? ":disabled" : ""}]`);
        } catch {}
      }
      throw new Error(`funnel bloqué sur ${txt.slice(0, 120)} :: ${btns.join(" ")}`);
    }
  }
  throw new Error("relecture jamais atteinte (26 étapes)");
}

test.describe("funnel acquisition → conversion", () => {
  test.skip(!ENABLED, "requiert FUNNEL_DATABASE_URL (base de test isolée)");

  test("parcours complet : visiteur → lead → conversion", async ({ browser }) => {
    test.slow();
    const mail = email("full");
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await startProfiling(page);
    await runToReview(page, mail);
    // Fin de parcours : relecture → aperçu → questions (maybeFinish exige
    // TOUTES les requises : une question sautée renvoie en arrière au lieu
    // de soumettre). Boucle : finaliser si présent, sinon répondre, jusqu'au
    // POST ou 12 rondes.
    // Capture attachée AVANT d'agir (le POST peut partir pendant un clic).
    let posted = false;
    const postPromise = page
      .waitForResponse(isPost, { timeout: 150000 })
      .then((r) => {
        posted = true;
        return r;
      })
      .catch(() => null);
    for (let round = 0; round < 20 && !posted; round++) {
      const fin = page.getByRole("button", { name: "Finaliser mon profil" });
      if ((await fin.count()) > 0) {
        try {
          if (await fin.first().isVisible({ timeout: 2000 })) await fin.first().click();
        } catch {}
      } else {
        const st = await answerStep(page, mail);
        if (st === "review") continue;
        if (st === "stuck") break;
      }
      await page.waitForTimeout(1500);
    }
    const resp = await postPromise;
    if (!resp) throw new Error("POST /api/members jamais émis (requis manquants ?)");
    expect([200, 201]).toContain(resp.status());
    const data = (await resp.json()) as { ok: boolean; memberId?: string; duplicate?: boolean };
    expect(data.ok).toBe(true);
    expect(data.duplicate).not.toBe(true);
    expect(data.memberId).toBeTruthy();
    // Écran résultat : sorti des questions, Finaliser parti.
    await expect(page.getByRole("button", { name: "Finaliser mon profil" })).toBeHidden({
      timeout: 15000,
    });
    await expect(page.locator("body")).not.toContainText(/Question \d+ sur/i);
    // DB : membre + qualification + analytics conversion.
    const db = getDb();
    try {
      const member = await db.member.findUnique({ where: { email: mail } });
      expect(member).toBeTruthy();
      expect(member?.firstName).toBe("Sonde");
      const quals = await db.qualification.count({ where: { memberId: member!.id } });
      expect(quals).toBeGreaterThanOrEqual(1);
      const completed = await db.analyticsEvent.count({
        where: { type: "profiling_completed" },
      });
      expect(completed).toBeGreaterThanOrEqual(1);
    } finally {
      await db.$disconnect();
    }
    await ctx.close();
  });

  test("état vide : démarrage sans brouillon, sans prompt", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await startProfiling(page);
    await expect(page.getByText(/brouillon en cours|déjà un compte/i)).toBeHidden({
      timeout: 10000,
    });
    await expect(page.locator("body")).toContainText(/Question 1 sur/i);
    await ctx.close();
  });

  test("accessibilité : questions + relecture, zéro violation (sans submit)", async ({
    browser,
  }) => {
    test.slow();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await startProfiling(page);
    await runToReview(page, email("a11y"));
    await page.waitForTimeout(800);
    const rev = await axeClean(page, "relecture");
    expect(rev.passes).toBeGreaterThan(0);
    await ctx.close();
  });

  test("email invalide → erreur bloquante, rien créé", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await startProfiling(page);
    await page.getByRole("textbox").first().fill("Sonde");
    await page.getByRole("button", { name: "Continuer" }).first().click();
    await page.waitForTimeout(800);
    for (const b of await page.getByRole("textbox").all()) {
      try {
        if (await b.isVisible() && (await b.inputValue()) === "")
          await b.fill("pas-un-email");
      } catch {}
    }
    await page.getByRole("button", { name: "Continuer" }).first().click();
    await page.waitForTimeout(800);
    // Toujours sur l'étape email : Continuer présent, pas d'avancement.
    await expect(page.getByRole("button", { name: "Continuer" }).first()).toBeVisible();
    const db = getDb();
    try {
      expect(await db.member.count({ where: { email: "pas-un-email" } })).toBe(0);
    } finally {
      await db.$disconnect();
    }
    await ctx.close();
  });

  test("double soumission même email → idempotent (1 seul membre)", async ({
    browser,
  }) => {
    test.slow();
    const mail = email("full"); // même email que le parcours complet
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await startProfiling(page);
    await runToReview(page, mail);
    // Fin de parcours : relecture → aperçu → questions (maybeFinish exige
    // TOUTES les requises : une question sautée renvoie en arrière au lieu
    // de soumettre). Boucle : finaliser si présent, sinon répondre, jusqu'au
    // POST ou 12 rondes.
    // Capture attachée AVANT d'agir (le POST peut partir pendant un clic).
    let posted = false;
    const postPromise = page
      .waitForResponse(isPost, { timeout: 150000 })
      .then((r) => {
        posted = true;
        return r;
      })
      .catch(() => null);
    for (let round = 0; round < 20 && !posted; round++) {
      const fin = page.getByRole("button", { name: "Finaliser mon profil" });
      if ((await fin.count()) > 0) {
        try {
          if (await fin.first().isVisible({ timeout: 2000 })) await fin.first().click();
        } catch {}
      } else {
        const st = await answerStep(page, mail);
        if (st === "review") continue;
        if (st === "stuck") break;
      }
      await page.waitForTimeout(1500);
    }
    const resp = await postPromise;
    if (!resp) throw new Error("POST /api/members jamais émis (requis manquants ?)");
    const data = (await resp.json()) as { ok: boolean; duplicate?: boolean };
    expect(data.ok).toBe(true);
    expect(data.duplicate).toBe(true);
    const db = getDb();
    try {
      expect(await db.member.count({ where: { email: mail } })).toBe(1);
    } finally {
      await db.$disconnect();
    }
    await ctx.close();
  });

  test("loading soumission + accessibilité résultat (email inédit)", async ({
    browser,
  }) => {
    test.slow();
    // Email INÉDIT : avec un email déjà converti, le flow affiche le prompt
    // « Tu as déjà un compte » et ne soumet jamais — aucun écran de
    // finalisation à observer. Le cas duplicate est couvert par le test
    // d'idempotence juste au-dessus.
    const mail = email("loading");
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await startProfiling(page);
    await runToReview(page, mail);
    // Ralentit le POST pour observer l'état de chargement (déterministe).
    await page.route("**/api/members", async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    // Relecture → aperçu → questions → soumission.
    // Parcours réel : l'aperçu est une CONFIRMATION (son « Finaliser » revient
    // aux questions), et maybeFinish() ne part que depuis la phase
    // « questions », une fois TOUTES les requises répondues.
    let posted = false;
    const postPromise = page
      .waitForResponse(isPost, { timeout: 150000 })
      .then((r) => {
        posted = true;
        return r;
      })
      .catch(() => null);
    for (let round = 0; round < 20 && !posted; round++) {
      const f = page.getByRole("button", { name: "Finaliser mon profil" });
      if ((await f.count()) > 0) {
        try {
          if (await f.first().isVisible({ timeout: 2000 })) await f.first().click();
        } catch {}
      } else {
        const st = await answerStep(page, mail);
        if (st === "review") continue;
        if (st === "stuck") break;
      }
      await page.waitForTimeout(900);
    }
    // POST retardé de 2,5 s par la route : l'écran de chargement est
    // observable. On attend les TEXTE RÉELS du parcours de soumission
    // (messages `profiling.submitting.*`) — pas ceux de FinalizingState
    // (« On finalise ton profil… »), qui est un autre écran : celui de
    // l'étape de relecture, pas celui qui suit le POST.
    await expect(
      page.locator("body"),
    ).toContainText(/enregistre ton profil|vérifications automatiques/i, {
      timeout: 20000,
    });
    const resp = await postPromise;
    expect(resp).toBeTruthy();
    await page.unroute("**/api/members");
    await page.waitForTimeout(500);
    const res = await axeClean(page, "resultat");
    expect(res.passes).toBeGreaterThan(0);
    await ctx.close();
  });

  test("reprise brouillon : reload → prompt → reprise", async ({ browser }) => {
    test.slow();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await startProfiling(page);
    // Répondre SANS email : avec email, le prompt bascule en variante
    // "compte existant" (comportement produit). Ici on veut le brouillon.
    await page.getByRole("textbox").first().fill("Sonde");
    await page.getByRole("button", { name: "Continuer" }).first().click();
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(1200);
    // La phase retourne à landing : relancer le profiling fait apparaître
    // le prompt (localStorage chiffré) au lieu des questions.
    await page.getByRole("button", { name: "Construire mon profil" }).first().click();
    await expect(
      page.getByText(/brouillon en cours/i).first(),
    ).toBeVisible({ timeout: 15000 });
    const resume = page.getByRole("button", { name: /reprendre/i });
    await expect(resume.first()).toBeVisible();
    await resume.first().click();
    await page.waitForTimeout(800);
    const txt = ((await page.locator("body").first().innerText()) || "").replace(/\s+/g, " ");
    expect(txt).toMatch(/Question [2-9]|1[0-1] sur \d+/);
    await ctx.close();
  });

  test("consentement : retrait traçé (contact/withdrawn)", async ({ browser }) => {
    const t0 = new Date();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/fr", { waitUntil: "load" });
    await dismissCookies(page);
    await page
      .getByRole("button", { name: /lire la politique complète/i })
      .first()
      .click();
    await page.waitForTimeout(800);
    const db = getDb();
    const before = await db.consent.count({
      where: { purpose: "contact", choice: "withdrawn" },
    });
    await page.getByRole("button", { name: /retirer ton consentement/i }).first().click();
    await expect(
      page.getByText(/retrait a été enregistré|consentement retiré/i).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500); // fire-and-forget keepalive
    const after = await db.consent.count({
      where: { purpose: "contact", choice: "withdrawn" },
    });
    expect(after).toBeGreaterThanOrEqual(before + 1);
    await db.consent.deleteMany({
      where: { purpose: "contact", choice: "withdrawn", createdAt: { gte: t0 } },
    });
    await db.$disconnect();
    await ctx.close();
  });

  test("gate handoff : sans consentement handoff = pas de transmission possible", async () => {
    const db = getDb();
    try {
      const rows = await db.consent.findMany({
        where: {
          email: email("full"),
          purpose: "handoff",
          choice: "granted",
        },
      });
      expect(rows.length).toBe(0);
    } finally {
      await db.$disconnect();
    }
  });

  test.afterAll("cleanup funnel (zéro résidu)", async () => {
    if (!ENABLED) return;
    const db = getDb();
    const mails = [email("full"), email("resume")];
    const members = await db.member.findMany({
      where: { email: { in: mails } },
      select: { id: true, email: true },
    });
    const ids = members.map((m) => m.id);
    if (ids.length > 0) {
      await db.qualification.deleteMany({ where: { memberId: { in: ids } } });
      await db.analyticsEvent.deleteMany({ where: { memberId: { in: ids } } });
      await db.member.deleteMany({ where: { id: { in: ids } } });
    }
    await db.consent.deleteMany({
      where: { email: { in: mails }, purpose: { not: "contact" } },
    });
    await db.$disconnect();
  });
});
