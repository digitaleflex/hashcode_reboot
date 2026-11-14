"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";
import { Clock, Users, Send } from "lucide-react";
import { useRouter } from "next/navigation";

/** Prochain 08:00 Africa/Porto-Novo (UTC+1) à partir de maintenant. */
function nextRunUTC(): Date {
  const now = new Date();
  // 08:00 Porto-Novo = 07:00 UTC
  const target = new Date(now);
  target.setUTCHours(7, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "imminent";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export function WaitlistQueue({ onSessionExpired }: { onSessionExpired: () => void }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchJson("/api/admin/invitations?page=1&pageSize=1", { cache: "no-store", signal: ctrl.signal })
      .then(({ res, data, code }) => {
        if (res.status === 401 || code === "UNAUTHORIZED") {
          onSessionExpired();
          return;
        }
        if (res.ok && data?.ok && data?.stats) {
          setPending(Number(data.stats.NOT_INVITED ?? 0));
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [onSessionExpired]);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const next = nextRunUTC();
  const remaining = next.getTime() - now;

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <MonoLabel className="text-muted-foreground">File d'attente d'invitation</MonoLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            {pending === null
              ? "Chargement…"
              : pending === 0
                ? "Aucun membre en attente."
                : `${pending} membre(s) en attente d'invitation.`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              Prochain envoi automatique
            </div>
            <div className="admin-num text-sm font-semibold text-foreground">
              {formatCountdown(remaining)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              à {next.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" })} (Porto-Novo)
            </div>
          </div>
          <RebootButton size="sm" onClick={() => router.push("/admin/members")} disabled={pending === null}>
            <Users className="size-4" aria-hidden />
            <span>Voir la file</span>
          </RebootButton>
        </div>
      </div>
    </div>
  );
}