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
  const { toast } = useToast();

  async function handleExport(kind: "csv" | "json", columns?: string[]) {
    if (exporting) return;
    setExporting(kind);
    try {
      const url = kind === "csv" ? "/api/export" : "/api/export/json";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        toast({ title: "Erreur", description: "Échec de l'export.", variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `hashcode-reboot-members-${Date.now()}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast({ title: `Export ${kind.toUpperCase()} terminé`, description: "Le fichier a été téléchargé." });
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
                Exporte la vue filtrée ou tous les membres. CSV et JSON. Importe un CSV pour ajouter des membres.
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
      />
    </div>
  );
}
