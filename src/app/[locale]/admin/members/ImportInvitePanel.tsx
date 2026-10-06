"use client";

import * as React from "react";
import { adminErrorMessage, adminRequest } from "@/components/reboot/admin/lib/adminQuery";
import { isAbortError } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { Mail, Upload, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";

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

export function ImportInvitePanel() {
  const t = useTranslations("admin.members.importInvitePanel");
  const { toast } = useToast();
  const [csvText, setCsvText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [dryRun, setDryRun] = React.useState<DryRunResult | null>(null);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  /**
   * D25 : `adminRequest` porte désormais la décision. Le 401 redirige, le 403
   * remonte en `AdminRequestError` avec le message du serveur et s'affiche
   * dans la bannière — il ne déclenche plus de redirection.
   */
  const handleDryRun = React.useCallback(async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setDryRun(null);
    try {
      const data = await adminRequest<DryRunResult>(
        "/api/admin/import-invite",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvText, confirm: false }),
        },
        { fallbackMessage: t("analyzeFailed") },
      );
      setDryRun(data);
    } catch (e) {
      if (isAbortError(e)) return;
      setError(
        t("analyzeError", {
          detail: adminErrorMessage(e, "Erreur lors de l'analyse du CSV."),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [csvText, t]);

  const handleSend = React.useCallback(async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setError(null);
    setDryRun(null);
    setResult(null);
    try {
      const data = await adminRequest<SubmitResult>(
        "/api/admin/import-invite",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvText, confirm: true }),
        },
        { fallbackMessage: t("importFailed") },
      );
      setResult(data);
      toast({
        title: t("toastCreatedTitle", { created: data.created }),
        description: t("toastSentDescription", { emailsSent: data.emailsSent }),
      });
      setCsvText("");
    } catch (e) {
      if (isAbortError(e)) return;
      setError(
        t("importError", { detail: adminErrorMessage(e, "Erreur lors de l'import.") }),
      );
    } finally {
      setLoading(false);
    }
  }, [csvText, toast, t]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-lime" />
          <span className="text-sm font-semibold text-foreground">
            {t("title")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("subtitle")}
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
            {t("descriptionIntro")}
            <strong className="text-foreground"> {t("descriptionFields.email")}</strong>,
            <strong className="text-foreground"> {t("descriptionFields.name")}</strong>,
            <strong className="text-foreground"> {t("descriptionFields.phone")}</strong>,
            <strong className="text-foreground"> {t("descriptionFields.country")}</strong>,
            <strong className="text-foreground"> {t("descriptionFields.level")}</strong>.
            {t("descriptionSuffix")}
          </p>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={t("placeholder")}
            className="w-full h-40 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime resize-y"
          />

          <div className="flex gap-2">
            <button
              onClick={() => void handleDryRun()}
              disabled={loading || !csvText.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
              {t("analyze")}
            </button>
            <button
              onClick={() => void handleSend()}
              disabled={loading || !csvText.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-lime text-black hover:bg-lime/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : <Mail className="size-3" />}
              {t("importAndSend")}
            </button>
          </div>

          {/* Dry-run result */}
          {dryRun && (
            <div className="rounded-md border border-lime/20 bg-lime/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-lime">
                <CheckCircle className="size-4" />
                {t("dryRunTitle")}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">{t("dryRunStats.csvRows")}</div>
                  <div className="text-lg font-bold text-foreground">{dryRun.totalRows}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">{t("dryRunStats.validEmails")}</div>
                  <div className="text-lg font-bold text-foreground">{dryRun.validRows}</div>
                </div>
                <div className="rounded bg-lime/10 p-2">
                  <div className="text-muted-foreground">{t("dryRunStats.newMembers")}</div>
                  <div className="text-lg font-bold text-lime">{dryRun.newMembers}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">{t("dryRunStats.alreadyExist")}</div>
                  <div className="text-lg font-bold text-muted-foreground">{dryRun.alreadyExist}</div>
                </div>
                {(dryRun.resendable ?? 0) > 0 && (
                  <div className="rounded bg-amber-500/10 p-2">
                    <div className="text-muted-foreground">{t("dryRunStats.toReinvite")}</div>
                    <div className="text-lg font-bold text-amber-300">{dryRun.resendable}</div>
                  </div>
                )}
              </div>
              {dryRun.sample.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">{t("previewLabel")}</span>{" "}
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
                {t("resultTitle")}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">{t("resultStats.created")}</div>
                  <div className="text-lg font-bold text-lime">{result.created}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">{t("resultStats.emailsSent")}</div>
                  <div className="text-lg font-bold text-foreground">{result.emailsSent}</div>
                </div>
                {(result.resent ?? 0) > 0 && (
                  <div className="rounded bg-amber-500/10 p-2">
                    <div className="text-muted-foreground">{t("resultStats.resent")}</div>
                    <div className="text-lg font-bold text-amber-300">{result.resent}</div>
                  </div>
                )}
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">{t("resultStats.failed")}</div>
                  <div className="text-lg font-bold text-destructive">{result.failed.length}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-muted-foreground">{t("resultStats.skipped")}</div>
                  <div className="text-lg font-bold text-muted-foreground">{result.skippedAlreadyExist}</div>
                </div>
              </div>
              {result.failed.length > 0 && (
                <div className="text-xs text-destructive">
                  {t("failedEmails", { list: result.failed.join(", ") })}
                </div>
              )}
              {result.skippedEmails.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {t("alreadyExistEmails", { list: result.skippedEmails.join(", ") })}
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