"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MonoLabel } from "../shared";
import { cn } from "@/lib/utils";

const EXPORT_COLUMNS = [
  { key: "firstName", label: "Prénom" },
  { key: "lastName", label: "Nom" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Téléphone" },
  { key: "country", label: "Pays" },
  { key: "city", label: "Ville" },
  { key: "primaryDomain", label: "Domaine" },
  { key: "level", label: "Niveau" },
  { key: "profileStatus", label: "Statut" },
  { key: "accessLane", label: "Voie" },
  { key: "goal", label: "Objectif" },
  { key: "mentoringInterest", label: "Mentorat" },
  { key: "budgetRange", label: "Budget" },
  { key: "createdAt", label: "Date d'inscription" },
  { key: "adminNote", label: "Note interne" },
] as const;

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (kind: "csv" | "json", columns: string[]) => void;
  exporting: "csv" | "json" | null;
}

export function ExportDialog({
  open,
  onOpenChange,
  onExport,
  exporting,
}: ExportDialogProps) {
  const [columns, setColumns] = React.useState<Set<string>>(
    new Set(EXPORT_COLUMNS.map((c) => c.key)),
  );
  const [format, setFormat] = React.useState<"csv" | "json">("csv");
  const [selectAll, setSelectAll] = React.useState(true);

  function toggleColumn(key: string) {
    setColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelectAll(next.size === EXPORT_COLUMNS.length);
      return next;
    });
  }

  function toggleAll() {
    if (selectAll) {
      setColumns(new Set());
      setSelectAll(false);
    } else {
      setColumns(new Set(EXPORT_COLUMNS.map((c) => c.key)));
      setSelectAll(true);
    }
  }

  function handleExport() {
    onExport(format, Array.from(columns));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/60 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Exporter les données</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choisis le format et les colonnes à inclure dans l'export.
          </DialogDescription>
        </DialogHeader>

        {/* Format selection */}
        <div className="space-y-2">
          <MonoLabel className="text-muted-foreground">Format</MonoLabel>
          <div className="flex gap-2">
            {(["csv", "json"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={cn(
                  "px-4 py-2 rounded-sm border text-sm font-mono transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
                  format === f
                    ? "border-lime/60 bg-lime/10 text-lime"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Column selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <MonoLabel className="text-muted-foreground">Colonnes</MonoLabel>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-muted-foreground hover:text-lime transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset rounded-sm px-1"
            >
              {selectAll ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          </div>
          <div className="max-h-[30vh] overflow-y-auto space-y-1 rounded-md border border-border/60 bg-card/40 p-2">
            {EXPORT_COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2.5 py-1 px-1 rounded-sm hover:bg-elevated/40 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={columns.has(col.key)}
                  onChange={() => toggleColumn(col.key)}
                  className="size-3.5 accent-lime"
                />
                <span className="text-sm text-foreground">{col.label}</span>
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  {col.key}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {columns.size} colonne{columns.size > 1 ? "s" : ""} sélectionnée{columns.size > 1 ? "s" : ""}
          </p>
        </div>

        {/* Export button */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-sm border border-border bg-card text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={columns.size === 0 || exporting !== null}
            className={cn(
              "px-4 py-2 rounded-sm border text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              columns.size > 0
                ? "border-lime bg-lime text-black hover:bg-lime/90"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {exporting ? "Export…" : `Exporter ${format.toUpperCase()}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
