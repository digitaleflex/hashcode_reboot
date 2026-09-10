"use client";

import * as React from "react";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { Mail, Upload, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface DryRunResult {
  dryRun: true;
  totalRows: number;
  validRows: number;
  newMembers: number;
  alreadyExist: number;
  resendable?: number;
  sample: { email: string; firstName: string; phone: string | null; country: string; level: string }[];
}

interface SubmitResult {
  ok: true;
  totalRows: number;
  created: number;
  emailsSent: number;
  resent?: number;
  failed: string[];
  skippedAlreadyExist: number;
  skippedEmails: string[];
}

export function ImportInvitePanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { toast } = useToast();
  const [csvText, setCsvText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [dryRun, setDryRun] = React.useState<DryRunResult | null>(null);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  const handleDryRun = React.useCallback(async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setDryRun(null);
    try {
      const { res, data, error: err, code, retryAfterSec } = await fetchJson("/api/admin/import-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, confirm: false }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        const base = err ?? "Échec de l'analyse.";
        setError(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(base, retryAfterSec)
            : base,
        );
        return;
      }
      setDryRun(data as DryRunResult);
    } catch (e) {
      if (isAbortError(e)) return;
      setError("Erreur lors de l'analyse du CSV.");
    } finally {
      setLoading(false);
    }
  }, [csvText, onSessionExpired]);

  const handleSend = React.useCallback(async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setError(null);
    setDryRun(null);
    setResult(null);
    try {
      const { res, data, error: err, code, retryAfterSec } = await fetchJson("/api/admin/import-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, confirm: true }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        const base = err ?? "Échec de l'import.";
        setError(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(base, retryAfterSec)
            : base,
        );
        return;
      }
      setResult(data as SubmitResult);
      toast({
        title: `${(data as SubmitResult).created} membre(s) créé(s)`,
        description: `${(data as SubmitResult).emailsSent} email(s) envoyé(s).`,
      });
      setCsvText("");
    } catch (e) {
      if (isAbortError(e)) return;
      setError("Erreur lors de l'import.");
    } finally {
      setLoading(false);
    }
  }, [csvText, onSessionExpired, toast]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-lime" />
          <span className="text-sm font-semibold text-foreground">
            Inviter d&apos;anciens membres (CSV)
          </span>
          <span className="text-xs text-muted-foreground">
            — email, prénom, téléphone, pays, niveau
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Colle ton CSV ici (un membre par ligne). Le système détecte automatiquement les colonnes :
            <strong className="text-foreground"> email</strong>,
            <strong className="text-foreground"> nom</strong>,
            <strong className="text-foreground"> téléphone</strong>,
            <strong className="text-foreground"> pays</strong>,
            <strong className="text-foreground"> niveau</strong>.
            Chaque nouveau membre recevra un email avec un lien magique de connexion (valide 72h).
          </p>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`email,Prénom,Téléphone,Pays,Niveau\njean@example.com,Jean,+22505010203,Côte d'Ivoire,Intermédiaire\nfatou@example.com,Fatou,+22399887766,Mali,Débutant`}
            className="w-full h-40 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-lime resize-y"
          />

          <div className="flex gap-2">
            <button
              onClick={() => void handleDryRun()}
              disabled={loading || !csvText.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
              Analyser
            </button>
            <button
              onClick={() => void handleSend()}
              disabled={loading || !csvText.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-lime text-black hover:bg-lime/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : <Mail className="size-3" />}
              Importer + Envoyer
            </button>
          </div>

          {/* Dry-run result */}
          {dryRun && (
            <div className="rounded-md border border-lime/20 bg-lime/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-lime">
                <CheckCircle className="size-4" />
                Analyse terminée
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">Lignes CSV</div>
                  <div className="text-lg font-bold text-foreground">{dryRun.totalRows}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">Emails valides</div>
                  <div className="text-lg font-bold text-foreground">{dryRun.validRows}</div>
                </div>
                <div className="rounded bg-lime/10 p-2">
                  <div className="text-muted-foreground">Nouveaux membres</div>
                  <div className="text-lg font-bold text-lime">{dryRun.newMembers}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">Déjà existants</div>
                  <div className="text-lg font-bold text-muted-foreground">{dryRun.alreadyExist}</div>
                </div>
                {(dryRun.resendable ?? 0) > 0 && (
                  <div className="rounded bg-amber-500/10 p-2">
                    <div className="text-muted-foreground">À réinviter</div>
                    <div className="text-lg font-bold text-amber-300">{dryRun.resendable}</div>
                  </div>
                )}
              </div>
              {dryRun.sample.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Aperçu :</span>{" "}
                  {dryRun.sample.map((s) => s.email).join(", ")}
                  {dryRun.sample.length < dryRun.validRows && "…"}
                </div>
              )}
            </div>
          )}

          {/* Submit result */}
          {result && (
            <div className="rounded-md border border-lime/20 bg-lime/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-lime">
                <CheckCircle className="size-4" />
                Import terminé
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">Créés</div>
                  <div className="text-lg font-bold text-lime">{result.created}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">Emails envoyés</div>
                  <div className="text-lg font-bold text-foreground">{result.emailsSent}</div>
                </div>
                {(result.resent ?? 0) > 0 && (
                  <div className="rounded bg-amber-500/10 p-2">
                    <div className="text-muted-foreground">Réenvoyés</div>
                    <div className="text-lg font-bold text-amber-300">{result.resent}</div>
                  </div>
                )}
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">Échoués</div>
                  <div className="text-lg font-bold text-destructive">{result.failed.length}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">Ignorés (existants)</div>
                  <div className="text-lg font-bold text-muted-foreground">{result.skippedAlreadyExist}</div>
                </div>
              </div>
              {result.failed.length > 0 && (
                <div className="text-xs text-destructive">
                  Emails échoués : {result.failed.join(", ")}
                </div>
              )}
              {result.skippedEmails.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Déjà existants : {result.skippedEmails.join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
