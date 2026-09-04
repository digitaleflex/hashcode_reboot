// Post-build: copy static assets into the standalone output.
// Cross-platform replacement for:
//   cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
// Works on Linux, macOS and Windows (bun or node).
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const jobs = [
  [join(root, ".next", "static"), join(root, ".next", "standalone", ".next", "static")],
  [join(root, "public"), join(root, ".next", "standalone", "public")],
];

let failed = false;
for (const [src, dest] of jobs) {
  if (!existsSync(src)) {
    console.log(`[postbuild] skip (missing): ${src}`);
    continue;
  }
  try {
    cpSync(src, dest, { recursive: true });
    console.log(`[postbuild] copied: ${src} -> ${dest}`);
  } catch (err) {
    failed = true;
    console.error(`[postbuild] FAILED: ${src} -> ${dest}:`, err);
  }
}
if (failed) process.exit(1);
