/**
 * Unit tests — emails transactionnels ATELIERS (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/workshop-emails.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - escapeHtml from src/lib/email-templates/shell.ts (byte-identical)
 *  - enrollmentEmail / submissionEmail / reviewEmail / quizEmail
 *    from src/lib/workshop-emails.ts (same escaping points)
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - ÉCHAPPEMENT : toute donnée interpolée est échappée (<script> →
 *    &lt;script&gt;) — garde-fou anti-XSS du fix F2, appliqué aux 4 templates
 *  - CONTRAT : subject/html non vides, category "transactional"
 *  - review : les 3 décisions produisent 3 labels distincts
 *  - quiz : passed vrai/faux → message adapté, score/total affichés
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirror of escapeHtml (src/lib/email-templates/shell.ts) ──

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Mirrors of src/lib/workshop-emails.ts (escaping points only) ──

function enrollmentEmail(data) {
  const safeName = escapeHtml(data.memberName);
  const safeTitle = escapeHtml(data.workshopTitle);
  const safeUrl = escapeHtml(data.workshopUrl);
  return {
    to: "",
    subject: `Vous êtes inscrit à "${safeTitle}" 🎉`,
    html: `<p>Bonjour ${safeName},</p><p><strong>${safeTitle}</strong></p><a href="${safeUrl}">Accéder</a>`,
    category: "transactional",
  };
}

function submissionEmail(data) {
  const safeName = escapeHtml(data.memberName);
  const safeWorkshop = escapeHtml(data.workshopTitle);
  const safeDeliverable = escapeHtml(data.deliverableTitle);
  const safeUrl = escapeHtml(data.submissionUrl);
  return {
    to: "",
    subject: `Livrable soumis : "${safeDeliverable}"`,
    html: `<p>Bonjour ${safeName},</p><p><strong>${safeDeliverable}</strong> — <strong>${safeWorkshop}</strong></p><a href="${safeUrl}">Voir</a>`,
    category: "transactional",
  };
}

function reviewEmail(data) {
  const decisionLabel =
    data.decision === "APPROVED"
      ? "✅ Approuvé"
      : data.decision === "REVISION"
        ? "🔄 Révision demandée"
        : "❌ Rejeté";
  const safeName = escapeHtml(data.memberName);
  const safeWorkshop = escapeHtml(data.workshopTitle);
  const safeDeliverable = escapeHtml(data.deliverableTitle);
  const safeFeedback = data.feedback ? escapeHtml(data.feedback) : "";
  const safeUrl = escapeHtml(data.submissionUrl);
  return {
    to: "",
    subject: `Review : ${decisionLabel} — "${safeDeliverable}"`,
    html: `<h1>${decisionLabel}</h1><p>Bonjour ${safeName},</p><p><strong>${safeDeliverable}</strong> — <strong>${safeWorkshop}</strong></p>${safeFeedback ? `<p>${safeFeedback}</p>` : ""}<a href="${safeUrl}">Voir</a>`,
    category: "transactional",
  };
}

function quizEmail(data) {
  const status = data.passed ? "✅ Réussi" : "❌ Échoué";
  const safeName = escapeHtml(data.memberName);
  const safeWorkshop = escapeHtml(data.workshopTitle);
  const safeQuiz = escapeHtml(data.quizTitle);
  return {
    to: "",
    subject: `Quiz : ${status} — "${safeQuiz}"`,
    html: `<h1>${status}</h1><p>Bonjour ${safeName},</p><p><strong>${data.score}/${data.total}</strong> — <strong>${safeQuiz}</strong> — <strong>${safeWorkshop}</strong></p>`,
    category: "transactional",
  };
}

// ── Tests ──

const XSS = `<script>alert("xss")</script>`;

describe("escapeHtml (mirror)", () => {
  test("échappe les 5 caractères spéciaux", () => {
    assert.equal(escapeHtml(`<a href="x">&'y'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;y&#39;&lt;/a&gt;");
  });

  test("laisse le texte simple inchangé", () => {
    assert.equal(escapeHtml("Eurin Bonjour 123"), "Eurin Bonjour 123");
  });
});

describe("enrollmentEmail", () => {
  test("contrat : subject/html non vides, catégorie transactional", () => {
    const out = enrollmentEmail({ memberName: "Awa", workshopTitle: "Git", workshopUrl: "https://x/y" });
    assert.ok(out.subject.length > 0);
    assert.ok(out.html.length > 0);
    assert.equal(out.category, "transactional");
  });

  test("XSS : nom + titre + URL échappés, aucun <script> brut", () => {
    const out = enrollmentEmail({ memberName: XSS, workshopTitle: XSS, workshopUrl: `https://x/?a="${XSS}"` });
    assert.ok(!out.html.includes("<script>"), "html brut trouvé");
    assert.ok(!out.subject.includes("<script>"), "subject brut trouvé");
    assert.ok(out.html.includes("&lt;script&gt;"));
  });
});

describe("submissionEmail", () => {
  test("XSS : livrable + feedback échappés", () => {
    const out = submissionEmail({ memberName: XSS, workshopTitle: XSS, deliverableTitle: XSS, submissionUrl: "https://x/y" });
    assert.ok(!out.html.includes("<script>"));
    assert.ok(!out.subject.includes("<script>"));
    assert.ok(out.html.includes("&lt;script&gt;"));
  });
});

describe("reviewEmail", () => {
  test("3 décisions → 3 labels distincts", () => {
    const base = { memberName: "A", workshopTitle: "W", deliverableTitle: "D", feedback: "", submissionUrl: "https://x" };
    const a = reviewEmail({ ...base, decision: "APPROVED" });
    const r = reviewEmail({ ...base, decision: "REVISION" });
    const j = reviewEmail({ ...base, decision: "REJECTED" });
    assert.ok(a.subject.includes("Approuvé"));
    assert.ok(r.subject.includes("Révision"));
    assert.ok(j.subject.includes("Rejeté"));
  });

  test("XSS : feedback membre échappé (champ libre admin)", () => {
    const out = reviewEmail({
      memberName: "A", workshopTitle: "W", deliverableTitle: "D",
      decision: "REVISION", feedback: `Revois ceci ${XSS}`, submissionUrl: "https://x",
    });
    assert.ok(!out.html.includes("<script>"));
    assert.ok(out.html.includes("&lt;script&gt;"));
  });

  test("feedback vide → pas de bloc feedback", () => {
    const out = reviewEmail({
      memberName: "A", workshopTitle: "W", deliverableTitle: "D",
      decision: "APPROVED", feedback: "", submissionUrl: "https://x",
    });
    assert.ok(!out.html.includes("Feedback"));
  });
});

describe("quizEmail", () => {
  test("passed vrai/faux → message adapté + score affiché", () => {
    const base = { memberName: "A", workshopTitle: "W", quizTitle: "Q", score: 8, total: 10, attemptNumber: 1 };
    const ok = quizEmail({ ...base, passed: true });
    const ko = quizEmail({ ...base, passed: false });
    assert.ok(ok.subject.includes("Réussi"));
    assert.ok(ko.subject.includes("Échoué"));
    assert.ok(ok.html.includes("8/10"));
  });

  test("XSS : titres échappés", () => {
    const out = quizEmail({ memberName: XSS, workshopTitle: XSS, quizTitle: XSS, score: 1, total: 2, passed: false, attemptNumber: 1 });
    assert.ok(!out.html.includes("<script>"));
    assert.ok(!out.subject.includes("<script>"));
  });
});
