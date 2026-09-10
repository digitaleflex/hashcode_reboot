"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";

export function RelancePanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { toast } = useToast();
  const [relanceable, setRelanceable] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    const { res, data, code } = await fetchJson("/api/admin/invitations?status=INVITED&page=1&pageSize=100");
    if (res.status === 401 || code === "UNAUTHORIZED") {
      onSessionExpired();
      return;
    }
    if (res.ok && data?.ok && Array.isArray(data.members)) {
      setRelanceable(
        (data.members as { id: string; invitationClicks: number }[])
          .filter((m) => m.invitationClicks === 0)
          .map((m) => m.id),
      );
    }
  }, [onSessionExpired]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleRelance() {
    if (loading || !relanceable?.length) return;
    setLoading(true);
    try {
      const { res, data, error, code, retryAfterSec } = await fetchJson("/api/invite/relance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: relanceable, confirm: true }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (!res.ok || !data?.ok) {
        const base = error ?? "Échec de la relance.";
        toast({
          title: "Erreur relance",
          description: res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(base, retryAfterSec) : base,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Relance envoyée", description: `${data.sent} email(s) envoyé(s).` });
      setRelanceable(null);
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
                : `${relanceable.length} invitation(s) sans clic à relancer.`}
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
