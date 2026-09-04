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
  "profiling_back",
  "profiling_resumed",
  "profiling_completed",
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

/** Fire-and-forget client tracker. Never blocks the UI. */
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
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* analytics must never break UX */
  }
}
