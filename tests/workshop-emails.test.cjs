/**
 * Unit tests — emails transactionnels ATELIERS (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --import tsx --test tests/workshop-emails.test.cjs
 *
 * Ce fichier IMPORTE la vraie source :
 *  - escapeHtml depuis src/lib/email-templates/shell.ts (source UNIQUE,
 *    partagée par mail.ts, render.ts et workshop-emails.ts)
 *  - enrollmentEmail / submissionEmail / reviewEmail / quizEmail depuis
 *    src/lib/workshop-emails.ts
 * Aucun miroir réimplémenté : les assertions portent sur le HTML réellement
 * produit par les templates, donc un bug d'échappement dans workshop-emails.ts
 * fait échouer ce test au lieu de passer au vert.
 *
 * Coverage:
 *  - ÉCHAPPEMENT : toute donnée interpolée est échappée (<script> →
 *    &lt;script&gt;) — garde-fou anti-XSS du fix F2, appliqué aux 4 templates
 *    dans le corps ET dans le sujet
 *  - CONTRAT : to vide (renseigné par sendEmail), subject/html non vides,
 *    category "transactional", bouton de lien présent
 *  - review : les 3 décisions produisent 3 labels distincts, feedback vide →
 *    pas de bloc feedback
 *  - quiz : passed vrai/faux → message adapté, score/total affichés
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Vraie source (require TypeScript via tsx) ───────────────────────────────

const { escapeHtml } = require("../src/lib/email-templates/shell.ts");
const {
  enrollmentEmail,
  quizEmail,
  reviewEmail,
  submissionEmail,
} = require("../src/lib/workshop-emails.ts");

// ── Tests ──

const XSS = `<script>alert("xss")</script>`;

/** Contrat commun aux 4 templates (vérifié sur la sortie RÉELLE). */
function assertPayloadContract(out) {
  assert.equal(out.to, "", "to doit rester vide : renseigné par sendEmail");
  assert.ok(out.subject.length > 0, "subject vide");
  assert.ok(out.html.length > 0, "html vide");
  assert.equal(out.category, "transactional");
}

describe("escapeHtml (src/lib/email-templates/shell.ts)", () => {
  test("échappe les 5 caractères spéciaux", () => {
    assert.equal(escapeHtml(`<a href="x">&'y'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;y&#39;&lt;/a&gt;");
  });

  test("laisse le texte simple inchangé", () => {
    assert.equal(escapeHtml("Eurin Bonjour 123"), "Eurin Bonjour 123");
  });

  test("les accents et emojis survivent à l'échappement", () => {
    assert.equal(escapeHtml("Réussite ✅ — à toi !"), "Réussite ✅ — à toi !");
  });

  test("& est échappé EN PREMIER (pas de double-échappement de &lt;)", () => {
    // Si & était échappé en dernier, "<" deviendrait "&amp;lt;" : l'ordre
    // des replace est donc significatif — voir shell.ts.
    assert.equal(escapeHtml("<"), "&lt;");
    assert.equal(escapeHtml("&"), "&amp;");
    assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  });
});

describe("enrollmentEmail", () => {
  test("contrat : to vide, subject/html non vides, catégorie transactional", () => {
    const out = enrollmentEmail({ memberName: "Awa", workshopTitle: "Git", workshopUrl: "https://x/y" });
    assertPayloadContract(out);
    assert.ok(out.subject.includes("Git"));
    assert.ok(out.html.includes("Awa"));
    assert.ok(out.html.includes(`href="https://x/y"`), "lien d'accès absent");
  });

  test("XSS : nom + titre + URL échappés, aucun <script> brut", () => {
    const out = enrollmentEmail({ memberName: XSS, workshopTitle: XSS, workshopUrl: `https://x/?a="${XSS}"` });
    assert.equal(out.html.includes("<script>"), false, "html brut trouvé");
    assert.equal(out.subject.includes("<script>"), false, "subject brut trouvé");
    assert.ok(out.html.includes("&lt;script&gt;"));
    assert.ok(out.subject.includes("&lt;script&gt;"));
  });

  test("XSS : l'URL échappée reste une URL (guillemets neutres, pas de casser l'attribut)", () => {
    // Le `"` devient &quot; : l'attribut href ne peut plus être refermé
    // prématurément par une donnée injectée.
    const out = enrollmentEmail({
      memberName: "A",
      workshopTitle: "W",
      workshopUrl: `https://x/?a=" onmouseover="alert(1)`,
    });
    assert.equal(out.html.includes(`onmouseover="alert(1)`), false);
    assert.ok(out.html.includes("&quot;"));
  });
});

describe("submissionEmail", () => {
  test("contrat : to vide, catégorie transactional, sujet = livrable", () => {
    const out = submissionEmail({ memberName: "Awa", workshopTitle: "Git", deliverableTitle: "README", submissionUrl: "https://x/y" });
    assertPayloadContract(out);
    assert.ok(out.subject.includes("README"));
    assert.ok(out.html.includes("Awa"));
    assert.ok(out.html.includes(`href="https://x/y"`));
  });

  test("XSS : livrable + membre + atelier échappés", () => {
    const out = submissionEmail({ memberName: XSS, workshopTitle: XSS, deliverableTitle: XSS, submissionUrl: "https://x/y" });
    assert.equal(out.html.includes("<script>"), false);
    assert.equal(out.subject.includes("<script>"), false);
    assert.ok(out.html.includes("&lt;script&gt;"));
    assert.ok(out.subject.includes("&lt;script&gt;"));
  });
});

describe("reviewEmail", () => {
  const base = { memberName: "A", workshopTitle: "W", deliverableTitle: "D", feedback: "", submissionUrl: "https://x" };

  test("contrat : to vide, catégorie transactional, feedback affiché quand présent", () => {
    const out = reviewEmail({ ...base, decision: "APPROVED", feedback: "Bon travail" });
    assertPayloadContract(out);
    assert.ok(out.html.includes("Bon travail"));
    assert.ok(out.html.includes("Feedback"));
    assert.ok(out.html.includes(`href="https://x"`));
  });

  test("3 décisions → 3 labels distincts", () => {
    const a = reviewEmail({ ...base, decision: "APPROVED" });
    const r = reviewEmail({ ...base, decision: "REVISION" });
    const j = reviewEmail({ ...base, decision: "REJECTED" });
    assert.ok(a.subject.includes("Approuvé"));
    assert.ok(r.subject.includes("Révision"));
    assert.ok(j.subject.includes("Rejeté"));
    const labels = new Set([a.subject, r.subject, j.subject]);
    assert.equal(labels.size, 3, "les 3 sujets doivent différer");
  });

  test("le label de décision apparaît aussi dans le corps du mail", () => {
    const a = reviewEmail({ ...base, decision: "APPROVED" });
    const r = reviewEmail({ ...base, decision: "REVISION" });
    const j = reviewEmail({ ...base, decision: "REJECTED" });
    assert.ok(a.html.includes("✅ Approuvé"));
    assert.ok(r.html.includes("🔄 Révision demandée"));
    assert.ok(j.html.includes("❌ Rejeté"));
  });

  test("XSS : feedback membre échappé (champ libre admin)", () => {
    const out = reviewEmail({
      memberName: XSS, workshopTitle: XSS, deliverableTitle: XSS,
      decision: "REVISION", feedback: `Revois ceci ${XSS}`, submissionUrl: "https://x",
    });
    assert.equal(out.html.includes("<script>"), false);
    assert.equal(out.subject.includes("<script>"), false);
    assert.ok(out.html.includes("&lt;script&gt;"));
  });

  test("feedback vide → pas de bloc feedback", () => {
    const out = reviewEmail({ ...base, decision: "APPROVED", feedback: "" });
    assert.equal(out.html.includes("Feedback"), false, "bloc feedback présent alors que feedback est vide");
  });
});

describe("quizEmail", () => {
  const base = { memberName: "A", workshopTitle: "W", quizTitle: "Q", score: 8, total: 10, attemptNumber: 1 };

  test("contrat : to vide, catégorie transactional, score affiché", () => {
    const out = quizEmail({ ...base, passed: true });
    assertPayloadContract(out);
    assert.ok(out.html.includes("8/10"));
  });

  test("passed vrai/faux → message adapté", () => {
    const ok = quizEmail({ ...base, passed: true });
    const ko = quizEmail({ ...base, passed: false });
    assert.ok(ok.subject.includes("Réussi"));
    assert.ok(ko.subject.includes("Échoué"));
    assert.ok(ok.html.includes("✅ Réussi"));
    assert.ok(ko.html.includes("❌ Échoué"));
  });

  test("passed → félicitations ; échoué → invitation à retenter", () => {
    assert.ok(quizEmail({ ...base, passed: true }).html.includes("Félicitations"));
    assert.ok(quizEmail({ ...base, passed: false }).html.includes("retenter"));
  });

  test("XSS : titres échappés", () => {
    const out = quizEmail({ memberName: XSS, workshopTitle: XSS, quizTitle: XSS, score: 1, total: 2, passed: false, attemptNumber: 1 });
    assert.equal(out.html.includes("<script>"), false);
    assert.equal(out.subject.includes("<script>"), false);
    assert.ok(out.html.includes("&lt;script&gt;"));
  });
});
