"use client";

import * as React from "react";
import {
  Mail,
  Megaphone,
  Lock,
  Plus,
  RefreshCw,
  Search,
  X,
  Eye,
  Save,
  Copy,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Power,
  Code2,
  Smartphone,
  Monitor,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";

/* ── Types ─────────────────────────────────────────────────────────────── */

type Category = "marketing" | "notification" | "code";

interface Variable {
  key: string;
  label: string;
  kind: "text" | "url";
}

interface TemplateListItem {
  key: string;
  name: string;
  category: Category;
  description: string;
  source: string | null;
  variables: Variable[];
  editable: boolean;
  seeded: boolean;
  missing: boolean;
  subject: string | null;
  isActive: boolean;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  custom: boolean;
}

interface TemplateDetail {
  key: string;
  name: string;
  category: Category;
  description: string;
  source: string | null;
  editable: boolean;
  inRegistry: boolean;
  subject: string;
  preheader: string;
  bodyHtml: string;
  isActive: boolean;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
  variables: Variable[];
}

const CATEGORY_META: Record<Category, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  marketing: { label: "Marketing", icon: Megaphone, className: "text-lime" },
  notification: { label: "Notification", icon: Mail, className: "text-blue-400" },
  code: { label: "Code / auth", icon: Code2, className: "text-amber-300" },
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── Petits composants ─────────────────────────────────────────────────── */

function CategoryBadge({ category }: { category: Category }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.marketing;
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", meta.className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}

function ActiveBadge({ isActive, editable }: { isActive: boolean; editable: boolean }) {
  if (!editable) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Verrouillé
      </span>
    );
  }
  return isActive ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-lime">
      <Power className="size-3.5 shrink-0" aria-hidden />
      Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Power className="size-3.5 shrink-0" aria-hidden />
      Inactif
    </span>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-md border p-3 text-left transition-colors",
        active ? "border-lime/50 bg-lime/10" : "border-border bg-card hover:border-lime/30 hover:bg-lime/5",
        onClick && "cursor-pointer",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", active ? "text-lime" : "text-muted-foreground")} aria-hidden />
        <MonoLabel className={cn("min-w-0 truncate", active && "text-lime")}>{label}</MonoLabel>
      </span>
      <span className={cn("admin-num text-2xl font-semibold leading-none", active ? "text-lime" : "text-foreground")}>
        {value}
      </span>
    </Tag>
  );
}

/* ── Panneau principal ─────────────────────────────────────────────────── */

export default function EmailTemplatesPage() {
  const [list, setList] = React.useState<TemplateListItem[]>([]);
  const [counts, setCounts] = React.useState({ total: 0, marketing: 0, active: 0, missing: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = React.useState<"" | Category>("");
  const [search, setSearch] = React.useState("");
  const [onlyActive, setOnlyActive] = React.useState(false);

  const [selected, setSelected] = React.useState<TemplateDetail | null>(null);
  const [draft, setDraft] = React.useState({ subject: "", preheader: "", bodyHtml: "" });
  const [preview, setPreview] = React.useState<{ html: string; warnings: string[] } | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [viewport, setViewport] = React.useState<"desktop" | "mobile">("desktop");
  const [creating, setCreating] = React.useState(false);
  const [newTemplate, setNewTemplate] = React.useState({ key: "", name: "", subject: "" });

  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);

  const dirty =
    selected !== null &&
    (draft.subject !== selected.subject ||
      draft.preheader !== selected.preheader ||
      draft.bodyHtml !== selected.bodyHtml);

  /* ── Chargement ─────────────────────────────────────────────────────── */

  const loadList = React.useCallback(async () => {
    setLoading(true);
    try {
      const { res, data, code } = await fetchJson("/api/admin/email-templates", { cache: "no-store" });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        window.location.assign("/?admin=1");
        return;
      }
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Chargement impossible.");
      setList(data.templates ?? []);
      setCounts(data.counts ?? { total: 0, marketing: 0, active: 0, missing: 0 });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadList();
  }, [loadList]);

  const openTemplate = React.useCallback(async (key: string) => {
    setError(null);
    setNotice(null);
    setPreview(null);
    try {
      const { res, data } = await fetchJson(`/api/admin/email-templates/${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Template introuvable.");
      const t = data.template as TemplateDetail;
      setSelected(t);
      setDraft({ subject: t.subject, preheader: t.preheader, bodyHtml: t.bodyHtml });
      setPreview({ html: data.preview.html, warnings: data.preview.warnings ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Template introuvable.");
    }
  }, []);

  /* ── Aperçu live (débouncé) ─────────────────────────────────────────── */

  React.useEffect(() => {
    if (!selected || !selected.inRegistry && !selected.key) return;
    const t = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const { res, data } = await fetchJson("/api/admin/email-templates/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: selected.key, ...draft }),
        });
        if (res.ok && data?.ok) {
          setPreview({ html: data.html, warnings: data.warnings ?? [] });
        }
      } catch {
        /* l'aperçu est non bloquant */
      } finally {
        setPreviewLoading(false);
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [draft, selected]);

  /* ── Actions ────────────────────────────────────────────────────────── */

  const insertVariable = (varKey: string) => {
    const ta = bodyRef.current;
    const token = `{{${varKey}}}`;
    if (!ta) {
      setDraft((d) => ({ ...d, bodyHtml: d.bodyHtml + token }));
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    const next = ta.value.slice(0, start) + token + ta.value.slice(end);
    setDraft((d) => ({ ...d, bodyHtml: next }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (!selected || !dirty) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { res, data } = await fetchJson(
        `/api/admin/email-templates/${encodeURIComponent(selected.key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      if (!res.ok || !data?.ok) {
        const warnings: string[] = data?.warnings ?? [];
        throw new Error(
          warnings.length > 0 ? `${data?.error ?? "Contenu refusé."}\n• ${warnings.join("\n• ")}` : data?.error ?? "Enregistrement impossible.",
        );
      }
      setNotice(`Template « ${selected.name} » enregistré (v${data.template.version}).`);
      await openTemplate(selected.key);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { res, data } = await fetchJson(
        `/api/admin/email-templates/${encodeURIComponent(selected.key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !selected.isActive }),
        },
      );
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Action impossible.");
      setNotice(
        data.template.isActive
          ? `Template « ${selected.name} » ACTIVÉ : les prochains envois utiliseront ce contenu.`
          : `Template « ${selected.name} » désactivé : retour au contenu du code.`,
      );
      setSelected({ ...selected, isActive: data.template.isActive, version: data.template.version });
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { res, data } = await fetchJson("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate),
      });
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Création impossible.");
      setNotice(`Template « ${newTemplate.name} » créé.`);
      setCreating(false);
      setNewTemplate({ key: "", name: "", subject: "" });
      await loadList();
      await openTemplate(data.template.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  };

  const duplicateAsNew = () => {
    if (!selected) return;
    setCreating(true);
    setNewTemplate({
      key: `${selected.key}_copie`,
      name: `${selected.name} (copie)`,
      subject: draft.subject,
    });
  };

  /* ── Filtrage ───────────────────────────────────────────────────────── */

  const filtered = list.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (onlyActive && !t.isActive) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.key.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const segBtn = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active ? "bg-lime/15 text-lime" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  /* ── Rendu : éditeur ────────────────────────────────────────────────── */

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setNotice(null);
                setError(null);
              }}
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Retour à la liste
            </button>
            <h1 className="font-display text-xl font-semibold text-foreground">{selected.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <CategoryBadge category={selected.category} />
              <span className="font-mono text-xs text-muted-foreground">{selected.key}</span>
              <ActiveBadge isActive={selected.isActive} editable={selected.editable} />
              <span className="admin-num text-xs text-muted-foreground">v{selected.version}</span>
              {selected.updatedBy && (
                <span className="text-xs text-muted-foreground">modifié par {selected.updatedBy}</span>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{selected.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selected.editable && (
              <>
                <RebootButton
                  size="sm"
                  variant={selected.isActive ? "outline" : "primary"}
                  onClick={() => void toggleActive()}
                  disabled={saving}
                >
                  <Power className={cn("size-4", selected.isActive && "text-destructive")} aria-hidden />
                  {selected.isActive ? "Désactiver" : "Activer"}
                </RebootButton>
                <RebootButton size="sm" variant="outline" onClick={duplicateAsNew} disabled={saving}>
                  <Copy className="size-4" aria-hidden />
                  Dupliquer
                </RebootButton>
                <RebootButton size="sm" onClick={() => void save()} disabled={saving || !dirty}>
                  <Save className="size-4" aria-hidden />
                  {saving ? "Enregistrement…" : dirty ? "Enregistrer" : "Aucun changement"}
                </RebootButton>
              </>
            )}
          </div>
        </div>

        {!selected.editable && (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
            <p className="text-sm text-amber-200">
              Template <strong className="font-semibold">verrouillé</strong> : sa catégorie (
              {CATEGORY_META[selected.category]?.label ?? selected.category}) transporte des liens ou des
              secrets d&apos;authentification. Le contenu reste géré dans le code (
              <code className="font-mono text-xs">{selected.source ?? "src/lib/mail.ts"}</code>). L&apos;aperçu
              ci-dessous est en lecture seule.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <pre className="whitespace-pre-wrap text-sm text-destructive">{error}</pre>
          </div>
        )}
        {notice && (
          <div className="flex items-start gap-3 rounded-md border border-lime/40 bg-lime/5 p-4">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
            <p className="text-sm text-lime">{notice}</p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Éditeur */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="tpl-subject" className="block mono-label text-muted-foreground">
                Sujet
              </label>
              <input
                id="tpl-subject"
                type="text"
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                disabled={!selected.editable}
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40 disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tpl-preheader" className="block mono-label text-muted-foreground">
                Texte d&apos;aperçu (preheader)
              </label>
              <input
                id="tpl-preheader"
                type="text"
                value={draft.preheader}
                onChange={(e) => setDraft((d) => ({ ...d, preheader: e.target.value }))}
                disabled={!selected.editable}
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40 disabled:opacity-60"
              />
            </div>

            {selected.variables.length > 0 && (
              <div className="space-y-2">
                <MonoLabel className="text-muted-foreground">Variables — cliquer pour insérer</MonoLabel>
                <div className="flex flex-wrap gap-1.5">
                  {selected.variables.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      disabled={!selected.editable}
                      title={`Valeur d'exemple : ${v.key}`}
                      className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:border-lime/40 hover:text-lime disabled:opacity-50"
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="tpl-body" className="mono-label text-muted-foreground">
                  Corps HTML (fragment de table)
                </label>
                <span className="admin-num text-xs text-muted-foreground">{draft.bodyHtml.length} car.</span>
              </div>
              <textarea
                id="tpl-body"
                ref={bodyRef}
                value={draft.bodyHtml}
                onChange={(e) => setDraft((d) => ({ ...d, bodyHtml: e.target.value }))}
                disabled={!selected.editable}
                spellCheck={false}
                rows={18}
                className="w-full rounded-md border border-border bg-card p-3 font-mono text-xs leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40 disabled:opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                La coquille (fond, en-tête wordmark, liseré lime, pied de page) est appliquée
                automatiquement au rendu : n&apos;écris que les lignes <code className="font-mono">&lt;tr&gt;</code> du
                corps.
              </p>
            </div>
          </div>

          {/* Aperçu */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <MonoLabel className="text-muted-foreground">
                Aperçu {previewLoading && "· mise à jour…"}
              </MonoLabel>
              <div className="flex gap-1 rounded-md border border-border bg-card p-1" role="group" aria-label="Taille de l'aperçu">
                <button
                  type="button"
                  onClick={() => setViewport("desktop")}
                  aria-pressed={viewport === "desktop"}
                  className={segBtn(viewport === "desktop")}
                >
                  <Monitor className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setViewport("mobile")}
                  aria-pressed={viewport === "mobile"}
                  className={segBtn(viewport === "mobile")}
                >
                  <Smartphone className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="mb-2 truncate text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Sujet :</span> {draft.subject || "(vide)"}
              </p>
              <div className="flex justify-center">
                <iframe
                  title="Aperçu de l'email"
                  srcDoc={preview?.html ?? ""}
                  sandbox=""
                  className={cn(
                    "h-[560px] rounded border border-border bg-white transition-opacity",
                    viewport === "desktop" ? "w-full" : "w-full max-w-[380px]",
                  )}
                />
              </div>
            </div>

            {preview && preview.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-amber-200">
                  <AlertTriangle className="size-4" aria-hidden />
                  {preview.warnings.length} avertissement(s)
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-200/90">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Rendu : liste ──────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold text-foreground">Templates d&apos;email</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Voir, modifier, prévisualiser et créer les emails de HASHCODE REBOOT. Un template n&apos;est
            utilisé par l&apos;envoi que s&apos;il est <strong className="font-semibold text-foreground">activé</strong> ;
            sinon le contenu du code sert de repli.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RebootButton size="sm" variant="outline" onClick={() => void loadList()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
            Actualiser
          </RebootButton>
          <RebootButton size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus className="size-4" aria-hidden />
            Nouveau template
          </RebootButton>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-3 rounded-md border border-lime/40 bg-lime/5 p-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
          <p className="text-sm text-lime">{notice}</p>
        </div>
      )}

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createTemplate();
          }}
          className="space-y-3 rounded-md border border-border bg-card p-4"
        >
          <MonoLabel className="text-muted-foreground">Nouveau template (brouillon marketing)</MonoLabel>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-xs text-muted-foreground">Clé (minuscules, _, chiffres)</span>
              <input
                required
                value={newTemplate.key}
                onChange={(e) => setNewTemplate((v) => ({ ...v, key: e.target.value.toLowerCase() }))}
                placeholder="promo_rentree"
                pattern="[a-z0-9_]{3,40}"
                className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-muted-foreground">Nom affiché</span>
              <input
                required
                minLength={2}
                value={newTemplate.name}
                onChange={(e) => setNewTemplate((v) => ({ ...v, name: e.target.value }))}
                placeholder="Promo rentrée"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-muted-foreground">Sujet</span>
              <input
                required
                value={newTemplate.subject}
                onChange={(e) => setNewTemplate((v) => ({ ...v, subject: e.target.value }))}
                placeholder="Ça commence bientôt…"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40"
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Le corps démarre sur un gabarit conforme à la charte, avec la variable{" "}
            <code className="font-mono">{"{{firstName}}"}</code>. Un template créé ici n&apos;est relié à
            aucun envoi automatique tant qu&apos;il n&apos;a pas été branché côté code.
          </p>
          <div className="flex flex-wrap gap-2">
            <RebootButton size="sm" type="submit" disabled={saving}>
              <Plus className="size-4" aria-hidden />
              Créer
            </RebootButton>
            <RebootButton size="sm" variant="outline" type="button" onClick={() => setCreating(false)}>
              Annuler
            </RebootButton>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <StatTile label="Templates" value={counts.total} icon={Mail} active={categoryFilter === ""} onClick={() => setCategoryFilter("")} />
        <StatTile label="Marketing" value={counts.marketing} icon={Megaphone} active={categoryFilter === "marketing"} onClick={() => setCategoryFilter("marketing")} />
        <StatTile label="Actifs" value={counts.active} icon={Power} active={onlyActive} onClick={() => setOnlyActive((v) => !v)} />
        <StatTile label="Non initialisés" value={counts.missing} icon={AlertTriangle} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1" role="group" aria-label="Filtrer par catégorie">
            {([["", "Toutes"], ["marketing", "Marketing"], ["notification", "Notifications"], ["code", "Code / auth"]] as const).map(
              ([value, label]) => (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() => setCategoryFilter(value)}
                  aria-pressed={categoryFilter === value}
                  className={segBtn(categoryFilter === value)}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={() => setOnlyActive((v) => !v)}
            aria-pressed={onlyActive}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
              onlyActive ? "border-lime/50 bg-lime/10 text-lime" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <Power className="size-4" aria-hidden />
            Actifs uniquement
          </button>
        </div>

        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un nom ou une clé…"
            aria-label="Rechercher un template"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {loading && list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card py-16">
          <RefreshCw className="size-6 animate-spin text-lime" aria-hidden />
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-card py-16">
          <Mail className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Aucun template ne correspond à ces filtres.</p>
        </div>
      ) : (
        <>
          {/* Mobile : cartes */}
          <ul className="space-y-3 md:hidden">
            {filtered.map((t) => (
              <li key={t.key} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{t.key}</p>
                  </div>
                  <CategoryBadge category={t.category} />
                </div>
                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">État</dt>
                    <dd className="text-xs">
                      <ActiveBadge isActive={t.isActive} editable={t.editable} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Version</dt>
                    <dd className="admin-num text-xs text-foreground">v{t.version}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Dernière modification</dt>
                    <dd className="admin-num text-xs text-foreground">{formatDate(t.updatedAt)}</dd>
                  </div>
                </dl>
                {t.missing ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-300">
                    <Ban className="size-3.5" aria-hidden />
                    Absent en base — lance le seed.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void openTemplate(t.key)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-lime hover:text-lime/80"
                  >
                    <Eye className="size-4" aria-hidden />
                    Ouvrir
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop : tableau */}
          <div className="hidden overflow-hidden rounded-md border border-border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Template</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Catégorie</th>
                    <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground lg:table-cell">Sujet</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">État</th>
                    <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground xl:table-cell">Modifié</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.key} className="border-b border-border/60 transition-colors last:border-0 hover:bg-lime/5">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{t.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{t.key}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={t.category} />
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="line-clamp-1 max-w-[320px] text-xs text-muted-foreground">
                          {t.subject ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActiveBadge isActive={t.isActive} editable={t.editable} />
                      </td>
                      <td className="hidden px-4 py-3 xl:table-cell">
                        <span className="admin-num text-xs text-muted-foreground">{formatDate(t.updatedAt)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.missing ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                            <Ban className="size-3.5" aria-hidden />
                            seed requis
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void openTemplate(t.key)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-lime/40 hover:text-lime"
                          >
                            <Eye className="size-3.5" aria-hidden />
                            Ouvrir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Les catégories <strong className="font-semibold text-foreground">Notification</strong> et{" "}
        <strong className="font-semibold text-foreground">Code / auth</strong> sont verrouillées en édition :
        elles transportent des liens et des secrets d&apos;authentification (lien de connexion, code de
        vérification). Elles restent consultables en aperçu.
      </p>
    </div>
  );
}
