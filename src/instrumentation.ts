export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const m = await import("./lib/health");
    void m.runStartupBanner();
  } catch {
    /* jamais bloquant */
  }
}
