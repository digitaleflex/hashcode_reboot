"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FlaskConical } from "lucide-react";

type Kind = "welcome" | "invite" | "both";

export function TestEmailPanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [kind, setKind] = React.useState<Kind>("both");
  const [loading, setLoading] = React.useState(false);

  async function handleSend() {
    if (loading || !email.trim()) return;
    setLoading(true);
    try {
      const { res, data, error, code, retryAfterSec } = await fetchJson("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), kind }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED" || res.status === 403) {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        const base = error ?? "Échec de l'envoi de test.";
        toast({
          title: "Erreur",
          description: res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(base, retryAfterSec) : base,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Email de test envoyé", description: `Modèle(s) « ${kind} » envoyés à ${email.trim()}.` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
      <MonoLabel className="text-muted-foreground">Email de test</MonoLabel>
      <p className="mt-1 text-sm text-muted-foreground">Vérifie le rendu welcome / invitation sur ta boîte avant une campagne.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton@email.com"
          aria-label="Email de test"
          className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40"
        />
        <div className="flex rounded-md border border-border overflow-hidden" role="group" aria-label="Modèle à tester">
          {(["welcome", "invite", "both"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={kind === k ? "px-3 h-9 text-sm bg-lime/10 text-lime" : "px-3 h-9 text-sm text-muted-foreground hover:text-foreground"}
            >
              {k === "welcome" ? "Bienvenue" : k === "invite" ? "Invitation" : "Les deux"}
            </button>
          ))}
        </div>
        <RebootButton size="sm" onClick={() => void handleSend()} disabled={loading || !email.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FlaskConical className="size-4" aria-hidden />}
          <span>Envoyer</span>
        </RebootButton>
      </div>
    </div>
  );
}
