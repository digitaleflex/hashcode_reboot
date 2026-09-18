"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { RebootButton } from "@/components/reboot/shared";
import { DELETE_CONFIRM_WORD } from "@/lib/account-rgpd";

/**
 * /dashboard/settings — « Mes données » (RGPD #64).
 * - Export : télécharge l'intégralité des données (GET /api/account/export).
 * - Suppression : double confirmation (clic → saisie du mot exact →
 *   DELETE /api/account), puis retour à l'accueil (session révoquée).
 */
export function DataSection() {
  const router = useRouter();
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [confirmWord, setConfirmWord] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/account/export", { cache: "no-store" });
      if (!res.ok) {
        setExportError(
          res.status === 429
            ? "Trop d'exports. Réessaie dans quelques minutes."
            : "Impossible de générer l'export.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hashcode-mes-donnees.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Erreur réseau. Vérifie ta connexion.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (confirmWord !== DELETE_CONFIRM_WORD) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: DELETE_CONFIRM_WORD }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setDeleteError(data?.error ?? "Impossible de supprimer le compte.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setDeleteError("Erreur réseau. Vérifie ta connexion.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase">
          Mes données
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Exporte tout ce qu&apos;on sait de toi, ou supprime ton compte.
        </p>
      </div>

      {/* Export */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between rounded-md border border-border/60 bg-background/60 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Exporter mes données</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Profil, progression, RSVP et emails — fichier JSON.
          </p>
          {exportError && (
            <p className="text-xs text-destructive mt-1" role="alert">{exportError}</p>
          )}
        </div>
        <RebootButton
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          className="shrink-0"
        >
          {exporting ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Download className="size-4" />}
          {exporting ? "Génération…" : "Télécharger"}
        </RebootButton>
      </div>

      {/* Suppression — zone de danger */}
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        {!confirming ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Supprimer mon compte</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ton profil disparaît, tes sessions sont révoquées. Irréversible.
              </p>
            </div>
            <RebootButton
              type="button"
              variant="outline"
              onClick={() => { setConfirming(true); setDeleteError(null); }}
              className="shrink-0 hover:border-destructive/60 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Supprimer…
            </RebootButton>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-foreground">
              <TriangleAlert className="size-4 shrink-0 mt-0.5 text-destructive" />
              Pour confirmer, écris <code className="font-mono font-bold px-1 rounded-sm bg-background border border-border">{DELETE_CONFIRM_WORD}</code> ci-dessous.
            </p>
            <input
              type="text"
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder={DELETE_CONFIRM_WORD}
              autoComplete="off"
              className="w-full h-12 rounded-md border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-lime"
              aria-label={`Écris ${DELETE_CONFIRM_WORD} pour confirmer`}
            />
            {deleteError && (
              <p className="text-xs text-destructive" role="alert">{deleteError}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <RebootButton
                type="button"
                onClick={handleDelete}
                disabled={confirmWord !== DELETE_CONFIRM_WORD || deleting}
                className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-40"
              >
                {deleting ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Trash2 className="size-4" />}
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </RebootButton>
              <RebootButton
                type="button"
                variant="outline"
                onClick={() => { setConfirming(false); setConfirmWord(""); setDeleteError(null); }}
                disabled={deleting}
              >
                Annuler
              </RebootButton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
