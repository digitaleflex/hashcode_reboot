import type { ProfileAnswers } from "@/lib/profiling/types";

/**
 * Sauvegarde partielle côté serveur en cas d'abandon (relances email).
 * Best-effort : ne doit jamais casser l'UX.
 */
export function saveDraftBeacon(answers: ProfileAnswers, lastQuestionId: string | null) {
  const email = answers.email;
  if (!email || !email.trim()) return; // email not captured yet
  const payload = {
    email,
    answers,
    lastQuestionId: lastQuestionId ?? undefined,
  };
  try {
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
