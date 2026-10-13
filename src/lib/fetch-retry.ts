/**
 * `fetch` JSON avec repli : quelques tentatives, backoff court.
 *
 * Utilisé pour les flux « nice-to-have » de la landing (compteurs, événements
 * publics) qui ne doivent jamais casser la page : on tente une fois, puis 2
 * reprises espacées avant de remonter l'erreur au composant (qui affiche un
 * état d'erreur avec action de réessai).
 *
 * Un `AbortError` (démontage du composant) est re-levé tel quel : ce n'est pas
 * un échec réseau et il ne doit pas déclencher de retry.
 */
const RETRY_DELAYS_MS = [400, 1200];

export async function fetchJsonWithRetry<T>(
  url: string,
  { retries = RETRY_DELAYS_MS.length, signal }: { retries?: number; signal?: AbortSignal } = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1] ?? 1200),
      );
    }
    try {
      const res = await fetch(url, { cache: "no-store", signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastError = error;
    }
  }

  throw lastError;
}
