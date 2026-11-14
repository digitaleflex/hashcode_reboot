"use client";

import * as React from "react";
import { Copy, Users, Gift, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReferralData {
  ok: boolean;
  code: string;
  url: string;
  balance: number;
  totalReferrals: number;
  validatedReferrals: number;
  referrals: { name: string; status: string; createdAt: string }[];
  ledger: { delta: number; reason: string; createdAt: string }[];
}

export default function ReferralPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<ReferralData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/referral/balance", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copy = async () => {
    if (!data?.url) return;
    try {
      await navigator.clipboard.writeText(data.url);
      toast({ title: "Lien copié !", description: "Partage-le avec tes amis." });
    } catch {
      toast({ title: "Erreur", description: "Copie manuelle nécessaire.", variant: "destructive" });
    }
  };

  const shareWhatsApp = () => {
    if (!data?.url) return;
    const text = encodeURIComponent(`Rejoins HASHCODE REBOOT, la communauté tech ! ${data.url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Chargement…</div>;
  }
  if (!data?.ok) {
    return <div className="p-6 text-muted-foreground">Impossible de charger les données de parrainage.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Parrainage</h1>
      <p className="text-muted-foreground">
        Invite tes amis à rejoindre HASHCODE REBOOT et gagne des points échangeables contre des ressources, formations et séances de mentorat.
      </p>

      <div className="rounded-md border border-border/60 bg-card p-4 space-y-3">
        <div className="mono-label text-xs text-muted-foreground">TON LIEN DE PARRAINAGE</div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={data.url}
            className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
          <button onClick={copy} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-border bg-card text-foreground hover:border-lime/60 transition-colors">
            <Copy className="size-4" /> Copier
          </button>
        </div>
        <button onClick={shareWhatsApp} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-lime text-black hover:bg-lime/90 transition-colors">
          <Share2 className="size-4" /> Partager sur WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border/60 bg-card p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{data.totalReferrals}</div>
          <div className="mono-label text-xs text-muted-foreground">Invités</div>
        </div>
        <div className="rounded-md border border-border/60 bg-card p-3 text-center">
          <div className="text-2xl font-bold text-lime">{data.validatedReferrals}</div>
          <div className="mono-label text-xs text-muted-foreground">Validés</div>
        </div>
        <div className="rounded-md border border-border/60 bg-card p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{data.balance}</div>
          <div className="mono-label text-xs text-muted-foreground">Points</div>
        </div>
      </div>

      {data.referrals.length > 0 && (
        <div className="rounded-md border border-border/60 bg-card p-4">
          <div className="mono-label text-xs text-muted-foreground mb-3">TES PARRAINAGES</div>
          <ul className="space-y-2">
            {data.referrals.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{r.name}</span>
                <span className={r.status === "validated" ? "text-lime" : "text-muted-foreground"}>
                  {r.status === "validated" ? "Validé ✓" : "En attente"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.ledger.length > 0 && (
        <div className="rounded-md border border-border/60 bg-card p-4">
          <div className="mono-label text-xs text-muted-foreground mb-3">HISTORIQUE DES POINTS</div>
          <ul className="space-y-2">
            {data.ledger.map((l, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{l.reason}</span>
                <span className={l.delta > 0 ? "text-lime font-semibold" : "text-destructive font-semibold"}>
                  {l.delta > 0 ? "+" : ""}{l.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}