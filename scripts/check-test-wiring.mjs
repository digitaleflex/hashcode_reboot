/**
 * Vérifie que tout fichier tests/*.test.cjs est branché dans un script npm.
 *
 * Pourquoi : `test:unit` énumère ses fichiers explicitement. Un test ajouté
 * puis oublié n'échoue PAS — il ne s'exécute ni en local ni en CI, et le
 * pipeline reste vert. C'est exactement ce qui est arrivé à
 * auth-otp-ttl.test.cjs et profiling-messages.test.cjs : écrits, verts quand on
 * les lance à la main, absents du pipeline.
 *
 * On convertit cet oubli en échec explicite.
 *
 * Sortie 1 : un fichier de test n'est référencé par aucun script npm.
 * Sortie 0 : tout est branché.
 */
const fs = await import("node:fs");
const path = await import("node:path");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const scripts = JSON.stringify(pkg.scripts);

const dir = path.join(import.meta.dirname, "..", "tests");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".test.cjs") || f.endsWith(".test.ts"))
  .sort();

const orphans = files.filter((f) => !scripts.includes(f));

if (orphans.length) {
  console.error("✖ Fichiers de test présents sur disque mais absents de package.json :");
  for (const f of orphans) console.error(`   - tests/${f}`);
  console.error(
    "\n  Ajoutez-le au script test:unit (ou au script approprié) dans package.json.",
  );
  process.exit(1);
}

console.log(`✓ ${files.length} fichiers de test, tous branchés dans package.json`);
