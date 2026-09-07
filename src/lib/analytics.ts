/**
 * HASHCODE REBOOT — Analytics event types.
 *
 * Funnel: VISITE → CTA → PROFILAGE → COMPLÉTION → PROFIL → WHATSAPP
 * Measurement: drop-off per question, mean time, completion rate, WhatsApp click rate.
 */

export const EVENT_TYPES = [
  "reboot_page_view",
  "reboot_cta_clicked",
  "profiling_started",
  "profiling_question_answered",
  "profiling_question_timed",
  "profiling_back",
  "profiling_resumed",
  "profiling_completed",
  "profiling_abandoned",
  "email_verified",
  "profil_generated",
  "community_cta_clicked",
  "whatsapp_join_clicked",
  "share_profile_clicked",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface TrackEvent {
  type: EventType;
  sessionId?: string;
  memberId?: string;
  ref?: string;
  value?: number;
}

const SESSION_KEY = "hashcode:reboot:session";
const SOURCE_KEY = "hashcode:reboot:source";

/** Get-or-create a stable client session id (per browser). */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return "anon";
  }
}

/**
 * Capture UTM/source params from the current URL (best-effort).
 * Persisted in localStorage so the acquisition source survives the funnel.
 * Priority: explicit utm_source > utm_medium > referrer hint.
 */
export function getOrCreateSource(): string {
  if (typeof window === "undefined") return "direct";
  try {
    const existing = localStorage.getItem(SOURCE_KEY);
    if (existing) return existing;

    const params = new URLSearchParams(window.location.search);
    const source = params.get("utm_source");
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    let value: string;
    if (source) {
      value = `${source}${medium ? `/${medium}` : ""}${campaign ? `?${campaign}` : ""}`;
    } else if (medium) {
      value = medium;
    } else {
      value = "direct";
    }
    localStorage.setItem(SOURCE_KEY, value);
    return value;
  } catch {
    return "direct";
  }
}

/** Read the persisted acquisition source (or "direct"). */
export function getSource(): string {
  if (typeof window === "undefined") return "direct";
  try {
    return localStorage.getItem(SOURCE_KEY) ?? "direct";
  } catch {
    return "direct";
  }
}

/** Reset the source (only used in dev/tests). */
export function clearSource(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SOURCE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Fire-and-forget client tracker. Never blocks the UI.
 * Retries up to 3 times with exponential backoff.
 * Analytics errors are logged but never break the user experience.
 */
export function track(event: TrackEvent): void {
  if (typeof window === "undefined") return;
  const payload = {
    type: event.type,
    sessionId: event.sessionId ?? getOrCreateSessionId(),
    memberId: event.memberId,
    ref: event.ref,
    value: event.value,
    path: window.location.pathname + window.location.search,
  };
  try {
    // Use sendBeacon for reliability on navigation/unload; fall back to fetch.
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/analytics", blob);
    } else {
      // Retry fetch up to 3 times with progressive delays
      const maxRetries = 3;
      const delayMs = [0, 100, 300];

      async function attemptFetch(tryNum: number): Promise<void> {
        try {
          await fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          });
        } catch (error) {
          if (tryNum < maxRetries - 1) {
            const delay = delayMs[tryNum + 1] || 500;
            setTimeout(() => attemptFetch(tryNum + 1), delay);
          } else {
            // Log after all retries exhausted — must not break UX
            console.warn(
              `Analytics event "${event.type}" failed after ${maxRetries} retries`,
              error
            );
          }
        }
      }

      attemptFetch(0);
    }
  } catch {
    /* analytics must never break UX */
  }
}
