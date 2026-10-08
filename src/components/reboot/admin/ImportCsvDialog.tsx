"use client";

import * as React from "react";
import Papa from "papaparse";
import { useTranslations } from "next-intl";
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

interface ClientRow {
  email: string;
  name: string;
  level?: string;
  country?: string;
  domain?: string;
  accessLane?: string;
}

const MAX_ROWS = 500;
/** Lots de traitement côté client (100-200 lignes) : évite le gel UI. */
const CLIENT_CHUNK_SIZE = 150;

function findColIndex(headers: string[], aliases: string[], fallback: number): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const hit = lower.findIndex((h) => h.includes(alias));
    if (hit >= 0) return hit;
  }
  return fallback;
}

/**
 * Parse le CSV côté client via PapaParse en worker (RFC 4180 : guillemets,
 * multilignes, séparateurs ,/;/tab auto-détectés), traité par lots de
 * CLIENT_CHUNK_SIZE lignes pour rester fluide.
 */
function parseClientCsv(csvText: string): Promise<ClientRow[]> {
  const firstLine =
    csvText.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const hasHeader = /email/i.test(firstLine);
  return new Promise((resolve, reject) => {
    const out: ClientRow[] = [];
    let batch: ClientRow[] = [];
    let indices: {
      email: number;
      name: number;
      level: number;
      country: number;
      domain: number;
      accessLane: number;
    } | null = hasHeader ? null : { email: 0, name: 1, level: 2, country: 3, domain: 4, accessLane: 5 };
    let isFirst = true;
    const flush = () => {
      if (batch.length > 0) {
        out.push(...batch);
        batch = [];
      }
    };
    Papa.parse<string[]>(csvText, {
      header: false,
      skipEmptyLines: "greedy",
      worker: true,
      step: (res) => {
        const cols = (res.data as string[]).map((c) => String(c ?? "").trim());
        if (cols.every((c) => c === "")) return;
        if (isFirst && hasHeader) {
          isFirst = false;
          indices = {
            email: findColIndex(cols, ["email", "e-mail", "adresse"], 0),
            name: findColIndex(cols, ["name", "nom", "pseudo"], 1),
            level: findColIndex(cols, ["level", "niveau"], 2),
            country: findColIndex(cols, ["country", "pays"], 3),
            domain: findColIndex(cols, ["domain", "domaine"], 4),
            accessLane: findColIndex(cols, ["accesslane", "access_lane", "lane", "voie", "acces"], 5),
          };
          return;
        }
        isFirst = false;
        const idx = indices ?? { email: 0, name: 1, level: 2, country: 3, domain: 4, accessLane: 5 };
        batch.push({
          email: cols[idx.email] ?? "",
          name: cols[idx.name] ?? "",
          level: cols[idx.level] || undefined,
          country: cols[idx.country] || undefined,
          domain: cols[idx.domain] || undefined,
          accessLane: cols[idx.accessLane] || undefined,
        });
        // Traitement par lots de 100-200 lignes.
        if (batch.length >= CLIENT_CHUNK_SIZE) flush();
      },
      complete: () => {
        flush();
        resolve(out);
      },
      error: (err) => reject(err),
    });
  });
}

export function ImportCsvDialog() {
  // Clés i18n admin.import.* — NON créées ici (hors périmètre de ce lane,
  // cf. messages/fr.json) : liste exhaustive dans le rapport d'implémentation.
  const t = useTranslations("admin.import");
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
        setError(t("fileTooLarge"));
        return;
      }
      setCsvText(text);
      setFileName(f.name);
    } catch {
      setError(t("readError"));
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
      setError(t("tooManyRows", { count: rowCount, max: MAX_ROWS }));
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Parse PapaParse (worker, par lots) plutôt que split/stripQuotes.
      const rows = await parseClientCsv(csvText);
      if (rows.length === 0) {
        setError(t("noRows"));
        setLoading(false);
        return;
      }
      if (rows.length > MAX_ROWS) {
        setError(t("tooManyRows", { count: rows.length, max: MAX_ROWS }));
        setLoading(false);
        return;
      }

      const response = await fetch("/api/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "RATE_LIMITED") {
          setError(t("rateLimited", { retry: data.retryAfterSec ?? 10 }));
        } else if (data.code === "VALIDATION_ERROR") {
          setError(t("validationErrorsTitle"));
          setResult({
            created: 0,
            updated: 0,
            skipped: 0,
            errors: data.details?.errors ?? data.errors ?? [],
          });
        } else {
          setError(data.error ?? t("genericError"));
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
      setError(t("networkError"));
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
        {t("openButton")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => {
        // Ne pas perdre le brouillon sur clic overlay pendant la saisie.
        if (!o && loading) return;
        setOpen(o);
      }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto scroll-slim">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogDescription", { max: MAX_ROWS })}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">{t("fileLabel")}</Label>
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
                  {t("chooseFile")}
                </Button>
                {fileName && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-foreground bg-secondary rounded-sm px-2 py-1 max-w-full">
                    <span className="truncate max-w-[220px]">{fileName}</span>
                    <button
                      type="button"
                      onClick={clearInput}
                      aria-label={t("removeFile")}
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
                  {t("loadExample")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="csv-data">{t("csvDataLabel")}</Label>
                <span
                  className={`text-xs tabular-nums ${overLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  role="status"
                >
                  {t("rowsCount", { count: rowCount, max: MAX_ROWS })}
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
                  {t("overLimit", { max: MAX_ROWS })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={loading || !csvText.trim() || overLimit}>
                {loading && <Loader2 className="size-4 mr-1 animate-spin" aria-hidden="true" />}
                {loading ? t("importing") : t("importButton", { count: rowCount })}
              </Button>
              {csvText && (
                <Button type="button" size="sm" variant="ghost" onClick={clearInput} disabled={loading}>
                  {t("clearAll")}
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
                      ? t("partialSummary", { created: result.created, updated: result.updated, skipped: result.skipped })
                      : t("successSummary", { created: result.created, updated: result.updated, skipped: result.skipped })}
                  </p>
                  {hasErrors && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("keepDraftHint")}
                    </p>
                  )}
                </div>

                {hasErrors && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-destructive">
                        {t("errorsTitle", { count: result.errors.length })}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={downloadErrorReport}
                        className="h-9"
                      >
                        <Download className="size-4 mr-1" aria-hidden="true" />
                        {t("downloadReport", { count: result.errors.length })}
                      </Button>
                    </div>
                    <ul className="space-y-1 max-h-48 overflow-y-auto scroll-slim">
                      {result.errors.slice(0, 20).map((err, i) => (
                        <li key={i} className="text-xs text-destructive">
                          {t("errorLine", { row: err.row, message: err.message })}
                          {err.field ? ` (${t("errorField", { field: err.field })})` : ""}
                        </li>
                      ))}
                    </ul>
                    {result.errors.length > 20 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("moreErrors", { count: result.errors.length - 20 })}
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
                    {hasErrors ? t("resumeLater") : t("close")}
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
                      {t("fixNow")}
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
