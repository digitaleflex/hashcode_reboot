"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";

const PAGE_SIZE = 100;
const RELANCE_CHUNK = 50;

export function RelancePanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { toast } = useToast();
  const [relanceable, setRelanceable] = React.useState<string[] | null>(null);
  const [alreadyRelanced, setAlreadyRelanced] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    const ids: string[] = [];
    let already = 0;
    let page = 1;
    let totalPages = 1;
    try {
      do {
        const { res, data, code } = await fetchJson(
          `/api/admin/invitations?status=INVITED&page=${page}&pageSize=${PAGE_SIZE}`,
        );
        if (res.status === 401 || code === "UNAUTHORIZED") {
          onSessionExpired();
          return;
        }
        if (!res.ok || !data?.ok || !Array.isArray(data.members)) break;
        const pageIds = (data.members as { id: string; invitationClicks: number }[])
          .filter((m) => m.invitationClicks === 0)
          .map((m) => m.id);
        ids.push(...pageIds);
        totalPages = data.pagination?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);
      // Dry-run sur tous les lots pour un compteur exact (best-effort).
      if (ids.length > 0) {
        let totalAlready = 0;
        for (let i = 0; i < ids.length; i += RELANCE_CHUNK) {
          try {
            const dry = await fetchJson("/api/invite/relance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ memberIds: ids.slice(i, i + RELANCE_CHUNK) }),
            });
            if (dry.res.ok && typeof dry.data?.alreadyRelanced === "number") {
              totalAlready += dry.data.alreadyRelanced as number;
            }
          } catch {
            /* best-effort */
          }
        }
        already = totalAlready;
      }
      setRelanceable(ids);
      setAlreadyRelanced(already);
      if (ids.length === 0) setAlreadyRelanced(0);
    } catch {
      /* best-effort */
      setRelanceable((prev) => prev ?? []);
    }
  }, [onSessionExpired]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleRelance() {
    if (loading || !relanceable?.length) return;
    setLoading(true);
    try {
      let totalSent = 0;
      let totalSkipped = 0;
      let lastError: string | null = null;
      let retryAfterSec: number | undefined = undefined;
      // Envoi par chunks de 50 (limite API), séquentiel pour respecter le rate-limit.
      const chunks: string[][] = [];
      for (let i = 0; i < relanceable.length; i += RELANCE_CHUNK) {
        chunks.push(relanceable.slice(i, i + RELANCE_CHUNK));
      }
      for (const chunk of chunks) {
        const { res, data, error, code, retryAfterSec: ra } = await fetchJson("/api/invite/relance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: chunk, confirm: true }),
        });
        if (res.status === 401 || code === "UNAUTHORIZED") {
          onSessionExpired();
          return;
        }
        if (!res.ok || !data?.ok) {
          lastError = error ?? "Échec de la relance.";
          retryAfterSec = ra ?? undefined;
          break;
        }
        totalSent += (data.sent as number) ?? 0;
        totalSkipped += (data.skippedRelanced as number) ?? 0;
      }
      if (lastError) {
        toast({
          title: "Erreur relance",
          description:
            retryAfterSec !== undefined ? withRetryAfter(lastError, retryAfterSec) : lastError,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Relance envoyée",
        description:
          totalSkipped > 0
            ? `${totalSent} email(s) envoyé(s), ${totalSkipped} déjà relancé(s) ignoré(s).`
            : `${totalSent} email(s) envoyé(s).`,
      });
      setRelanceable(null);
      setAlreadyRelanced(0);
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <MonoLabel className="text-muted-foreground">Relance invitations</MonoLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            {relanceable === null
              ? "Chargement…"
              : relanceable.length === 0
                ? "Aucune invitation en attente de clic."
                : `${relanceable.length - alreadyRelanced} invitation(s) à relancer${alreadyRelanced > 0 ? ` (${alreadyRelanced} déjà relancée(s), ignorée(s)).` : "."}`}
          </p>
        </div>
        <RebootButton size="sm" onClick={() => void handleRelance()} disabled={loading || !relanceable?.length}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          <span>Relancer</span>
        </RebootButton>
      </div>
    </div>
  );
}