"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Upload, Loader2 } from "lucide-react";

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; field?: string; message: string }>;
}

export function ImportCsvDialog() {
  const [open, setOpen] = React.useState(false);
  const [csvText, setCsvText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function loadTemplate() {
    const template = `email,name,level,country,domain
jean.dupont@example.com,Jean Dupont,beginner,FR,web
marie.martin@example.com,Marie Martin,advanced,FR,ai
pierre.dupont@example.com,Pierre Dupont,practicing,FR,cybersecurity`;
    setCsvText(template);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const lines = csvText
        .trim()
        .split("\n")
        .filter((l) => l.trim());

      // Parse CSV rows (simple split by comma)
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(",");
        return {
          email: cols[0]?.trim() ?? "",
          name: cols[1]?.trim() ?? "",
          level: cols[2]?.trim() || undefined,
          country: cols[3]?.trim() || undefined,
          domain: cols[4]?.trim() || undefined,
        };
      });

      const response = await fetch("/api/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "RATE_LIMITED") {
          setError(`Trop d'imports. Réessaie dans ${data.retryAfterSec ?? 10}s.`);
        } else if (data.code === "VALIDATION_ERROR") {
          setError("Erreurs de validation détectées.");
          setResult({
            created: 0,
            updated: 0,
            skipped: 0,
            errors: data.errors ?? [],
          });
        } else {
          setError(data.error ?? "Erreur lors de l'import.");
        }
        return;
      }

      setResult(data as ImportResult);
      setCsvText("");
    } catch (err) {
      setError("Échec de la connexion. Vérifie ton réseau.");
    } finally {
      setLoading(false);
    }
  }

  const hasErrors = result && result.errors.length > 0;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        <Upload className="size-4 mr-1" aria-hidden="true" />
        Importer CSV
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Importer CSV</DialogTitle>
            <DialogDescription>
              Importe des membres depuis un fichier CSV. Maximum 500 lignes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-data">Données CSV</Label>
              <Textarea
                id="csv-data"
                className="font-mono text-sm h-48 resize-none"
                placeholder="email,name,level,country,domain&#10;jean.dupont@example.com,Jean Dupont,beginner,FR,web"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={loadTemplate}
                disabled={loading}
              >
                Charger modèle
              </Button>
              <Button type="submit" size="sm" disabled={loading || !csvText.trim()}>
                {loading && <Loader2 className="size-4 mr-1 animate-spin" aria-hidden="true" />}
                {loading ? "Import…" : "Importer"}
              </Button>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-center gap-2" role="alert">
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <div
                  className="rounded-md border border-lime/40 bg-lime/5 p-4"
                  role="status"
                >
                  <p className="text-sm font-medium text-lime">
                    Import terminé : {result.created} créé(s), {result.updated} mis(s) à jour, {result.skipped} ignoré(s).
                  </p>
                </div>

                {hasErrors && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
                    <p className="text-sm font-medium text-destructive mb-2">
                      {result.errors.length} erreur(s) :
                    </p>
                    <ul className="space-y-1 max-h-48 overflow-y-auto">
                      {result.errors.slice(0, 20).map((err, i) => (
                        <li key={i} className="text-xs text-destructive">
                          Ligne {err.row}: {err.message}
                          {err.field ? ` (champ: ${err.field})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setResult(null);
                    setError(null);
                  }}
                >
                  Fermer
                </Button>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}