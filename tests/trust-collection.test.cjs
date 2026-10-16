/**
 * Confiance et finalité de collecte (#145) — assertions sur sources.
 * Pas de DOM (convention : tests sources comme acquisition-foundation).
 * Run: node --test tests/trust-collection.test.cjs
 */
"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("point de capture email : disclosure avant collecte", () => {
  test("question email : qui, pourquoi, non-revente, facultatifs", () => {
    const src = read("src/lib/profiling/questions.ts");
    const emailBlock = src.slice(src.indexOf('id: "email"'), src.indexOf('id: "country"'));
    assert.ok(emailBlock.includes("JoinHashCode"), "responsable nommé");
    assert.ok(/jamais revendue/i.test(emailBlock), "non-revente");
    assert.ok(/facultatif/i.test(emailBlock), "champs facultatifs signalés");
    assert.ok(emailBlock.includes("communauté"), "finalité (profil + communauté)");
  });
});

describe("modale confidentialité : responsable, transmission, ne-fait-pas", () => {
  test("sections exigées présentes", () => {
    const src = read("src/components/reboot/privacy-modal.tsx");
    for (const s of [
      "Qui est responsable",
      "JoinHashCode",
      "privacy@joinhashcode.com",
      "Ce qu'on ne fait pas",
      "pas de profil psychométrique",
      "Tes droits",
      "Combien de temps",
    ]) {
      assert.ok(
        src.toLowerCase().includes(s.toLowerCase()),
        `section manquante : ${s}`,
      );
    }
  });
});

describe("pas de dark patterns", () => {
  test("aucune case précochée dans l'app", () => {
    const { execSync } = require("node:child_process");
    const out = execSync(
      'grep -rn "defaultChecked" src --include="*.tsx" || true',
      { cwd: ROOT },
    ).toString();
    assert.equal(out.trim(), "", `cases précochées : ${out.slice(0, 200)}`);
  });

  test("aucune promesse psychométrique/définitive (landing + modale)", () => {
    const { execSync } = require("node:child_process");
    const out = execSync(
      'grep -rni "psychométrique\\|orientation définitive\\|profil définitif" src/components src/app messages/fr.json || true',
      { cwd: ROOT },
    ).toString();
    // Seule la négation explicite de la modale est tolérée.
    const lines = out.trim().split("\n").filter(Boolean);
    for (const l of lines) {
      assert.ok(
        /pas d(e|&#39;|&apos;|')/i.test(l),
        `promesse abusive : ${l.slice(0, 160)}`,
      );
    }
  });
});

describe("erreurs de consentement explicites (FR)", () => {
  test("enums consentement avec messages FR", () => {
    const src = read("src/lib/consents.ts");
    assert.ok(src.includes("Finalité inconnue"), "purpose explicite");
    assert.ok(src.includes("Choix inconnu"), "choice explicite");
  });
});
