"use client";

import * as React from "react";
import { MonoLabel } from "@/components/reboot/shared";
import { RebootButton } from "@/components/reboot/shared";
import { ImportCsvDialog } from "@/components/reboot/admin/ImportCsvDialog";
import { ExportDialog } from "@/components/reboot/admin/ExportDialog";
import { Download, FileJson } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminExportsPage() {
  const [exporting, setExporting] = React.useState<"csv" | "json" | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [totalMembers, setTotalMembers] = React.useState<number | null>(null);
  const { toast } = useToast();

  // Total connu pour prévenir la troncature à 2000 lignes avant export.
  React.useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/members?pageSize=1&page=1", { cache: "no-store", signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.total === "number") setTotalMembers(data.total);
      })
      .catch(() => {
        /* silencieux — le warning est un bonus, pas un blocage */
      });
    return () => ctrl.abort();
  }, []);

  async function handleExport(kind: "csv" | "json", columns?: string[]) {
    if (exporting) return;
    setExporting(kind);
    try {
      const params = new URLSearchParams();
      if (columns && columns.length > 0) params.set("fields", columns.join(","));
      const query = params.toString();
      const url = (kind === "csv" ? "/api/export" : "/api/export/json") + (query ? `?${query}` : "");
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { code?: string } | null;
        const code = data?.code;
        toast({
          title: "Erreur",
          description:
            res.status === 429
              ? "Trop d'exports. Attends quelques minutes puis réessaie."
              : res.status === 401
                ? "Session expirée. Reconnecte-toi puis réessaie."
                : code === "FORBIDDEN_FIELDS"
                  ? "Colonnes internes réservées aux operators."
                  : "Échec de l'export.",
          variant: "destructive",
        });
        return;
      }
      const truncated = res.headers.get("X-Export-Truncated") === "1";
      const total = res.headers.get("X-Export-Total");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `hashcode-reboot-members-${Date.now()}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast({
        title: `Export ${kind.toUpperCase()} terminé`,
        description: truncated
          ? `Fichier tronqué à 2000 lignes${total ? ` sur ${Number(total).toLocaleString("fr-FR")}` : ""}. Affine via la liste Membres.`
          : "Le fichier a été téléchargé.",
      });
    } catch {
      toast({ title: "Erreur", description: "Échec de l'export.", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-label="Exports & Import">
        <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <MonoLabel className="text-muted-foreground">Exports & Import</MonoLabel>
              <p className="mt-1 text-sm text-muted-foreground">
                Exporte tous les membres (max 2000 lignes, colonnes choisies dans le dialogue CSV).
                Le bouton JSON exporte les colonnes par défaut.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ImportCsvDialog />
              <RebootButton
                size="sm"
                variant="outline"
                onClick={() => setExportDialogOpen(true)}
                disabled={exporting !== null}
              >
                <Download className="size-4" aria-hidden="true" />
                <span>{exporting === "csv" ? "Export…" : "CSV"}</span>
              </RebootButton>
              <span className="hidden md:inline-block" title="Exporter en JSON">
                <RebootButton
                  size="sm"
                  variant="outline"
                  onClick={() => void handleExport("json")}
                  disabled={exporting !== null}
                >
                  <FileJson className="size-4" />
                  <span className="hidden lg:inline">
                    {exporting === "json" ? "Export…" : "JSON"}
                  </span>
                </RebootButton>
              </span>
            </div>
          </div>
        </div>
      </section>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={(kind, columns) => void handleExport(kind, columns)}
        exporting={exporting}
        totalMembers={totalMembers ?? undefined}
      />
    </div>
  );
}
