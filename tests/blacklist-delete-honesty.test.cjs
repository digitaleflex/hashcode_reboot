/**
 * Tests de non-régression — la route DELETE de la blacklist ne doit pas
 * annoncer une suppression qui n'a pas eu lieu.
 *
 * Run:  node --import tsx --test tests/blacklist-delete-honesty.test.cjs
 *
 * BUG TROUVÉ PENDANT D26 (audit 2026-10-06)
 *
 * `src/lib/blacklist.ts:110` expose :
 *
 *     export async function removeFromBlacklist(email): Promise<{removed: boolean}>
 *
 * qui **avale l'erreur** : toute exception de suppression est transformée en
 * `{removed: false}`. C'est un choix délibéré et reasonable — la fonction
 * ne lève jamais.
 *
 * La route `DELETE /api/admin/blacklist/[id]` appelait cette fonction et
 * **ignorait son retour** :
 *
 *     await removeFromBlacklist(entry.email);
 *     return NextResponse.json({ ok: true, removed: entry.email });
 *
 * Conséquence : si la suppression échoue en base (coupure Postgres, violation
 * de contrainte), l'API répond `{ok:true, removed:"..."}`. L'admin voit
 * « supprimé », l'interface se met à jour, et **l'adresse reste blacklistée**.
 *
 * Pour une action de sécurité, un 200 qui ment est pire qu'une erreur : il
 * supprime l'information dont l'administrateur a besoin pour agir.
 *
 * Ces tests importent le VRAI module `blacklist.ts` et vérifient le contrat
 * `removed` — pas le code de la route, dont l'accès HTTP demanderait un serveur.
 * La régression testée ici est celle de `removeFromBlacklist` : c'est la source
 * de vérité que la route doit consommer au lieu de l'ignorer.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

describe("removeFromBlacklist — ne jamais mentir sur la suppression", () => {
  test("est une fonction pure d'interface qui ne lève jamais", async () => {
    const { removeFromBlacklist } = require("../src/lib/blacklist.ts");
    assert.equal(typeof removeFromBlacklist, "function");

    // Un email invalide ne doit pas lever : la fonction est « best-effort ».
    const r = await removeFromBlacklist("pas-un-email");
    assert.equal(r.removed, false, "un email normalisable en invalide doit removed:false");
  });

  test("renvoie TOUJOURS un objet avec un booléen `removed`", async () => {
    // Le contrat est ce qui permet à la route de détecter un échec. Si un jour
    // la fonction renvoie `undefined` ou lève, la route répondra de nouveau
    // « ok:true » sans s'en apercevoir. Ce test verrouille le contrat.
    const { removeFromBlacklist } = require("../src/lib/blacklist.ts");

    for (const email of ["test@example.test", "invalide", "", "  "]) {
      const r = await removeFromBlacklist(email);
      assert.equal(
        typeof r?.removed,
        "boolean",
        `removeFromBlacklist("${email}") doit renvoyer {removed: boolean}, ` +
          `reçu ${JSON.stringify(r)}`,
      );
    }
  });

  test("la source de la route consomme bien `removed` (anti-régression)", () => {
    // Vérification par lecture de la source : c'est la seule façon de
    // couvrir le bug réel, qui était un retour ignoré et non un comportement
    // de `removeFromBlacklist`.
    const fs = require("node:fs");
    const path = require("node:path");
    const file = path.join(
      __dirname,
      "..",
      "src/app/api/admin/blacklist/[id]/route.ts",
    );
    const src = fs.readFileSync(file, "utf8");

    // La forme BUGGY est un `await removeFromBlacklist(...)` qui constitue
    // une instruction complète — le retour est jeté. Il ne faut pas confondre
    // avec la forme correcte `const x = await removeFromBlacklist(...)` :
    // les deux contiennent `await removeFromBlacklist(`.
    const buggy = src
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^await\s+removeFromBlacklist\(/.test(l));

    assert.deepEqual(
      buggy,
      [],
      "la route appelle removeFromBlacklist comme instruction seule : le retour " +
        "est jeté, l'échec est invisible et l'API répond ok:true",
    );
    assert.match(
      src,
      /const\s+\w+\s*=\s*await\s+removeFromBlacklist\(/,
      "le retour de removeFromBlacklist doit être assigné",
    );
    assert.match(
      src,
      /if\s*\(\s*!\s*\w+\.removed\s*\)/,
      "un removed:false doit déclencher une réponse d'erreur, pas un 200",
    );
  });
});