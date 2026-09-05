"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileText, X, Download } from "lucide-react";

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; field?: string; message: string }>;
}

const MAX_ROWS = 500;

function stripQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/""/g, '"').trim();
  }
  return t;
}

export function ImportCsvDialog() {
  const [open, setOpen] = React.useState(false);
  const [csvText, setCsvText] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const lines = React.useMemo(() => {
    const all = csvText.trim().split("\n").filter((l) => l.trim());
    // Première ligne = en-tête si elle contient email.
    const hasHeader = all.length > 0 && /email/i.test(all[0] ?? "");
    return { all, dataRows: hasHeader ? all.slice(1) : all, hasHeader };
  }, [csvText]);

  const rowCount = lines.dataRows.length;
  const overLimit = rowCount > MAX_ROWS;

  function loadTemplate() {
    const template = `email,name,level,country,domain
jean.dupont@example.com,Jean Dupont,beginner,FR,web
marie.martin@example.com,Marie Martin,advanced,FR,ai
pierre.dupont@example.com,Pierre Dupont,practicing,FR,cybersecurity`;
    setCsvText(template);
    setFileName(null);
    setResult(null);
    setError(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setResult(null);
    try {
      const text = await f.text();
      // Garde-fou taille : ~2 Mo max pour rester fluide.
      if (text.length > 2_000_000) {
        setError("Fichier trop volumineux (2 Mo max). Découpe-le en plusieurs imports.");
        return;
      }
      setCsvText(text);
      setFileName(f.name);
    } catch {
      setError("Lecture du fichier impossible.");
    } finally {
      // Permet de re-sélectionner le même fichier.
      e.target.value = "";
    }
  }

  function clearInput() {
    setCsvText("");
    setFileName(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overLimit) {
      setError(`Trop de lignes (${rowCount} / ${MAX_ROWS} max). Découpe le fichier.`);
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const dataLines = lines.dataRows;
      if (dataLines.length === 0) {
        setError("Aucune ligne à importer. Ajoute des lignes sous l’en-tête.");
        setLoading(false);
        return;
      }

      // Détecte le séparateur depuis l’en-tête (virgule ou point-virgule).
      const header = lines.hasHeader ? lines.all[0] : "email,name,level,country,domain";
      const sep = header.includes(";") && !header.includes(",") ? ";" : ",";

      const rows = dataLines.map((line) => {
        const cols = line.split(sep).map(stripQuotes);
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
          setError("Certaines lignes sont invalides — corrige et réimporte. Le contenu est conservé.");
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

      const res = data as ImportResult;
      setResult(res);
      // Conserve le contenu en cas d’erreurs pour correction, vide sinon.
      if (!res.errors || res.errors.length === 0) {
        setCsvText("");
        setFileName(null);
      }
    } catch {
      setError("Échec de la connexion. Vérifie ton réseau.");
    } finally {
      setLoading(false);
    }
  }

  const hasErrors = result && result.errors.length > 0;

  function downloadErrorReport() {
    if (!result || result.errors.length === 0) return;
    const escape = (v: string | number | undefined) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linesCsv = result.errors.map(
      (e) => `${e.row};${escape(e.field)};${escape(e.message)}`,
    );
    const csv = ["ligne;champ;message", ...linesCsv].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-erreurs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

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

      <Dialog open={open} onOpenChange={(o) => {
        // Ne pas perdre le brouillon sur clic overlay pendant la saisie.
        if (!o && loading) return;
        setOpen(o);
      }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto scroll-slim">
          <DialogHeader>
            <DialogTitle>Importer des membres</DialogTitle>
            <DialogDescription>
              Fichier CSV ou collage. En-tête : email,name,level,country,domain. {MAX_ROWS} lignes max.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Fichier CSV</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFile}
                  disabled={loading}
                  className="sr-only"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => fileRef.current?.click()}
                >
                  <FileText className="size-4 mr-1" aria-hidden />
                  Choisir un fichier
                </Button>
                {fileName && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-foreground bg-secondary rounded-sm px-2 py-1 max-w-full">
                    <span className="truncate max-w-[220px]">{fileName}</span>
                    <button
                      type="button"
                      onClick={clearInput}
                      aria-label="Retirer le fichier"
                      className="size-5 inline-flex items-center justify-center rounded-sm hover:text-destructive focus-lime"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={loadTemplate}
                  disabled={loading}
                >
                  Charger un exemple
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="csv-data">Données CSV</Label>
                <span
                  className={`text-xs tabular-nums ${overLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  role="status"
                >
                  {rowCount} ligne{rowCount > 1 ? "s" : ""} / {MAX_ROWS}
                </span>
              </div>
              <Textarea
                id="csv-data"
                className="font-mono text-sm h-48 resize-y"
                placeholder="email,name,level,country,domain&#10;jean.dupont@example.com,Jean Dupont,beginner,FR,web"
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setFileName(null);
                }}
                required
              />
              {overLimit && (
                <p className="text-xs text-destructive" role="alert">
                  Découpe en plusieurs fichiers de {MAX_ROWS} lignes max.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={loading || !csvText.trim() || overLimit}>
                {loading && <Loader2 className="size-4 mr-1 animate-spin" aria-hidden="true" />}
                {loading ? "Import…" : `Importer${rowCount > 0 ? ` (${rowCount})` : ""}`}
              </Button>
              {csvText && (
                <Button type="button" size="sm" variant="ghost" onClick={clearInput} disabled={loading}>
                  Tout effacer
                </Button>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3" role="alert">
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <div
                  className={`rounded-md border p-4 ${hasErrors ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-lime/40 bg-lime/5"}`}
                  role="status"
                >
                  <p className={`text-sm font-medium ${hasErrors ? "text-amber-200" : "text-lime"}`}>
                    {hasErrors
                      ? `Import partiel : ${result.created} créé(s), ${result.updated} mis à jour, ${result.skipped} ignoré(s).`
                      : `Import terminé : ${result.created} créé(s), ${result.updated} mis à jour, ${result.skipped} ignoré(s).`}
                  </p>
                  {hasErrors && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Le contenu est conservé ci-dessus — corrige et réimporte.
                    </p>
                  )}
                </div>

                {hasErrors && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-destructive">
                        {result.errors.length} erreur{result.errors.length > 1 ? "s" : ""}
                        {result.errors.length > 20 ? " — 20 premières" : ""} :
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={downloadErrorReport}
                        className="h-9"
                      >
                        <Download className="size-4 mr-1" aria-hidden="true" />
                        Télécharger le rapport ({result.errors.length})
                      </Button>
                    </div>
                    <ul className="space-y-1 max-h-48 overflow-y-auto scroll-slim">
                      {result.errors.slice(0, 20).map((err, i) => (
                        <li key={i} className="text-xs text-destructive">
                          Ligne {err.row}: {err.message}
                          {err.field ? ` (champ: ${err.field})` : ""}
                        </li>
                      ))}
                    </ul>
                    {result.errors.length > 20 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        + {result.errors.length - 20} autre(s). Corrige par lots.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      // Garde le résultat si erreurs pour reprise, sinon nettoie.
                      if (!hasErrors) {
                        setResult(null);
                        setError(null);
                      }
                    }}
                  >
                    {hasErrors ? "Reprendre plus tard" : "Fermer"}
                  </Button>
                  {hasErrors && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setResult(null);
                        setError(null);
                      }}
                    >
                      Corriger maintenant
                    </Button>
                  )}
                </div>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
