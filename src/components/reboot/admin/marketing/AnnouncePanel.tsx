"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { adminErrorMessage, adminRequest } from "@/components/reboot/admin/lib/adminQuery";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";

const LOT = 15;

export function AnnouncePanel() {
  const { toast } = useToast();
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [sentTotal, setSentTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const loadTotal = React.useCallback(async () => {
    // D25 : lecture silencieuse. Le 401 a déjà redirigé ; un 403/500 est
    // ignoré comme avant (`res.ok` restant faux), sans casser le rendu.
    try {
      const data = await adminRequest<{ total?: number }>(
        "/api/admin/announce-dashboard",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: false }),
        },
      );
      if (typeof data?.total === "number") {
        setRemaining(data.total);
        if (data.total === 0) setDone(true);
      }
    } catch {
      /* silencieux : le panneau reste sur « Chargement... » */
    }
  }, []);

  React.useEffect(() => {
    void loadTotal();
  }, [loadTotal]);

  async function handleSendLot() {
    if (loading || done) return;
    setLoading(true);
    try {
      const data = await adminRequest<{
        ok?: boolean;
        sent?: number;
        remaining?: number;
        done?: boolean;
      }>(
        "/api/admin/announce-dashboard",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true, limit: LOT }),
        },
        { fallbackMessage: "Échec de l'envoi du lot." },
      );
      if (!data?.ok) {
        toast({
          title: "Erreur",
          description: "Échec de l'envoi du lot.",
          variant: "destructive",
        });
        return;
      }
      setSentTotal((s) => s + (data.sent as number));
      if (typeof data?.remaining === "number") setRemaining(data.remaining as number);
      if (data.done) setDone(true);
      toast({ title: "Lot envoyé", description: `${data.sent} email(s) envoyé(s).` });
    } catch (e) {
      toast({
        title: "Erreur",
        description: adminErrorMessage(e, "Échec de l'envoi du lot."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <MonoLabel className="text-muted-foreground">Annonce espace membre</MonoLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            {remaining === null
              ? "Chargement…"
              : done
                ? `Terminé — ${sentTotal} email(s) envoyé(s) au total. Chaque membre ne reçoit l'annonce qu'une fois.`
                : `${sentTotal} envoyé(s), ${remaining} restant(s). Envois par lots de ${LOT}, sans doublon.`}
          </p>
        </div>
        <RebootButton size="sm" onClick={() => void handleSendLot()} disabled={loading || done || remaining === null}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          <span>{done ? "Terminé" : "Envoyer le lot suivant"}</span>
        </RebootButton>
      </div>
    </div>
  );
}