import type { ProfileAnswers } from "@/lib/profiling/types";
import { getOrCreateSessionId, getOrCreateSource } from "@/lib/analytics";

/**
 * Sauvegarde partielle côté serveur en cas d'abandon (relances email).
 * Best-effort : ne doit jamais casser l'UX.
 */
export function saveDraftBeacon(answers: ProfileAnswers, lastQuestionId: string | null) {
  const email = answers.email;
  if (!email || !email.trim()) return; // email not captured yet
  try {
    const sessionId = getOrCreateSessionId().slice(0, 64);
    const sourceUTM = getOrCreateSource().slice(0, 120);
    const payload = {
      email,
      answers,
      lastQuestionId: lastQuestionId ?? undefined,
      sessionId: sessionId || undefined,
      sourceUTM: sourceUTM || undefined,
    };
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/profiling/draft", blob);
    } else {
      void fetch("/api/profiling/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  } catch {
    /* best-effort — draft saving must never break UX */
  }
}
