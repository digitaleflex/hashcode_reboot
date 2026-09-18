"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";
import { cn } from "@/lib/utils";
import {
  Send,
  Mail,
  Megaphone,
  RefreshCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  MailOpen,
  MailCheck,
  CheckCircle,
  AlertTriangle,
  Ban,
  Users,
  Info,
  MousePointerClick,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────── */

type Kind = "invite" | "relance" | "annonce" | "rejoin" | "engagement";

interface LogRow {
  id: string;
  at: string;
  email: string;
  firstName: string | null;
  memberId: string | null;
  memberStatus: string | null;
  bounced: boolean;
  kind: string;
  provider: string | null;
  providerId: string | null;
  engagement: {
    opened: number;
    clicked: number;
    delivered: number;
    lastAt: string | null;
  };
}

interface LogStats {
  total: number;
  byKind: Record<string, number>;
  byProvider: Record<string, number>;
}

interface Audience {
  total: number;
  blacklisted: number;
  bounced: number;
  annonceSent: number;
  annonceRemaining: number;
}

interface LogResponse {
  ok: boolean;
  stats: LogStats;
  audience: Audience;
  rows: LogRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

/* ── Config ────────────────────────────────────────────────────────────── */

const KIND_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  invite: { label: "Invitation", color: "text-blue-400", bg: "bg-blue-500/10", icon: Mail },
  relance: { label: "Relance", color: "text-amber-300", bg: "bg-amber-500/10", icon: RefreshCw },
  annonce: { label: "Annonce", color: "text-lime", bg: "bg-lime/10", icon: Megaphone },
  rejoin: { label: "Retour", color: "text-purple-400", bg: "bg-purple-500/10", icon: Send },
  engagement: { label: "Engagement", color: "text-cyan-400", bg: "bg-cyan-500/10", icon: Send },
};

const KIND_FILTERS: Array<{ value: "" | Kind; label: string }> = [
  { value: "", label: "Toutes" },
  { value: "invite", label: "Invitations" },
  { value: "relance", label: "Relances" },
  { value: "annonce", label: "Annonces" },
  { value: "rejoin", label: "Retours" },
  { value: "engagement", label: "Engagements" },
];

const MEMBER_STATUS_LABEL: Record<string, string> = {
  NOT_INVITED: "Non invité",
  INVITED: "Invité",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  BOUNCED: "Bounce",
  EXPIRED: "Expiré",
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

function initials(row: LogRow): string {
  const source = row.firstName?.trim() || row.email;
  return source.charAt(0).toUpperCase() || "?";
}

/* ── Sous-composants ───────────────────────────────────────────────────── */

function KindBadge({ kind }: { kind: string }) {
  const cfg = KIND_CONFIG[kind] ?? {
    label: kind,
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    icon: Mail,
  };
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        cfg.bg,
        cfg.color,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {cfg.label}
    </span>
  );
}

function ProviderTag({ provider }: { provider: string | null }) {
  if (!provider) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium uppercase",
        provider === "brevo"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-sky-500/30 bg-sky-500/10 text-sky-400",
      )}
    >
      {provider}
    </span>
  );
}

function MemberStatus({ row }: { row: LogRow }) {
  if (row.bounced) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-orange-400">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
        Bounce
      </span>
    );
  }
  if (row.memberStatus === "ACCEPTED") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-lime">
        <CheckCircle className="size-3.5 shrink-0" aria-hidden />
        Accepté
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      {MEMBER_STATUS_LABEL[row.memberStatus ?? ""] ?? "—"}
    </span>
  );
}

function EngagementCell({ row }: { row: LogRow }) {
  const { delivered, opened, clicked } = row.engagement;
  const nothing = delivered === 0 && opened === 0 && clicked === 0;

  if (nothing) {
    return (
      <span className="text-xs text-muted-foreground" title="Aucun événement de suivi reçu (webhook provider non configuré ?)">
        — pas de suivi
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn("inline-flex items-center gap-1 text-xs admin-num", delivered > 0 ? "text-foreground" : "text-muted-foreground/60")}
        title={`${delivered} délivré(s)`}
      >
        <MailCheck className="size-3.5 shrink-0" aria-hidden />
        {delivered}
      </span>
      <span
        className={cn("inline-flex items-center gap-1 text-xs admin-num", opened > 0 ? "text-blue-400" : "text-muted-foreground/60")}
        title={`${opened} ouverture(s)`}
      >
        <MailOpen className="size-3.5 shrink-0" aria-hidden />
        {opened}
      </span>
      <span
        className={cn("inline-flex items-center gap-1 text-xs admin-num", clicked > 0 ? "text-lime" : "text-muted-foreground/60")}
        title={`${clicked} clic(s)`}
      >
        <MousePointerClick className="size-3.5 shrink-0" aria-hidden />
        {clicked}
      </span>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  active,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  hint?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={hint}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-md border p-3 text-left transition-colors",
        active
          ? "border-lime/50 bg-lime/10"
          : "border-border bg-card hover:border-lime/30 hover:bg-lime/5",
        onClick && "cursor-pointer",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", active ? "text-lime" : "text-muted-foreground")} aria-hidden />
        <MonoLabel className={cn("min-w-0 truncate", active && "text-lime")}>{label}</MonoLabel>
      </span>
      <span
        className={cn(
          "admin-num text-2xl font-semibold leading-none",
          active ? "text-lime" : "text-foreground",
        )}
      >
        {value}
      </span>
    </Tag>
  );
}

function AudienceBanner({ audience }: { audience: Audience }) {
  const informed = audience.annonceSent + audience.annonceRemaining;
  const pct = informed > 0 ? Math.round((audience.annonceSent / informed) * 100) : 0;

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
        <div className="min-w-0">
          <MonoLabel>Annonce espace membre</MonoLabel>
          <p className="mt-1 text-sm text-foreground">
            <span className="admin-num font-semibold text-lime">{audience.annonceSent}</span> informés ·{" "}
            <span className="admin-num font-semibold">{audience.annonceRemaining}</span> restants
          </p>
        </div>

        <div className="min-w-[160px] flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="admin-num">{pct}</span>% de l&apos;audience informée
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-2 text-sm" title="Adresses exclues des campagnes (bounce, plainte, désinscription)">
            <Ban className="size-4 shrink-0 text-destructive" aria-hidden />
            <span className="admin-num font-semibold text-destructive">{audience.blacklisted}</span>
            <span className="text-muted-foreground">en liste noire</span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-orange-400" aria-hidden />
            <span className="admin-num font-semibold text-orange-400">{audience.bounced}</span>
            <span className="text-muted-foreground">en bounce</span>
          </span>
        </div>
      </div>
    </section>
  );
}

/** Carte mobile (1 envoi par carte) — le tableau est réservé à md+. */
function LogRowCard({ row }: { row: LogRow }) {
  return (
    <li className="rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lime/10 text-sm font-semibold text-lime">
            {initials(row)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {row.firstName || "—"}
            </span>
            <span className="truncate text-xs text-muted-foreground">{row.email}</span>
          </span>
        </div>
        <KindBadge kind={row.kind} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
        <div>
          <dt className="text-xs text-muted-foreground">Date</dt>
          <dd className="admin-num text-xs text-foreground">{formatDate(row.at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Provider</dt>
          <dd className="text-xs">
            <ProviderTag provider={row.provider} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Statut membre</dt>
          <dd className="text-xs">
            <MemberStatus row={row} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Suivi</dt>
          <dd className="text-xs">
            <EngagementCell row={row} />
          </dd>
        </div>
      </dl>
    </li>
  );
}

/** Pagination numérotée (spec admin : page active = fond lime, texte noir). */
function Pagination({
  page,
  totalPages,
  total,
  disabled,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  disabled: boolean;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        <span className="admin-num">{total}</span> envoi(s)
      </p>
    );
  }

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  const btn =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <nav
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination du journal des envois"
    >
      <p className="text-xs text-muted-foreground">
        <span className="admin-num">{total}</span> envoi(s) · page{" "}
        <span className="admin-num">{page}</span>/<span className="admin-num">{totalPages}</span>
      </p>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={disabled || page <= 1}
          className={cn(btn, "text-muted-foreground hover:text-foreground hover:bg-muted")}
          aria-label="Page précédente"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            disabled={disabled}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
            className={cn(
              btn,
              "admin-num",
              p === page
                ? "border-lime bg-lime font-semibold text-black"
                : "text-foreground hover:border-lime/40 hover:bg-lime/10",
            )}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={disabled || page >= totalPages}
          className={cn(btn, "text-muted-foreground hover:text-foreground hover:bg-muted")}
          aria-label="Page suivante"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/* ── Panneau ───────────────────────────────────────────────────────────── */

export function CampaignLogPanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [data, setData] = React.useState<LogResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [kind, setKind] = React.useState<"" | Kind>("");
  const [provider, setProvider] = React.useState<"" | "resend" | "brevo">("");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  // Recherche débouncée : évite une requête par frappe.
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (kind) params.set("kind", kind);
        if (provider) params.set("provider", provider);
        if (search) params.set("search", search);
        params.set("page", String(page));
        params.set("pageSize", "25");

        const { res, data: payload, code } = await fetchJson(
          `/api/admin/email-log?${params.toString()}`,
          { cache: "no-store", signal },
        );

        if (res.status === 401 || code === "UNAUTHORIZED") {
          onSessionExpired();
          return;
        }
        if (res.ok && payload?.ok) setData(payload as LogResponse);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    },
    [kind, provider, search, page, onSessionExpired],
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const changeKind = (value: "" | Kind) => {
    setKind(value);
    setPage(1);
  };
  const changeProvider = (value: "" | "resend" | "brevo") => {
    setProvider(value);
    setPage(1);
  };

  const stats = data?.stats;
  const rows = data?.rows ?? [];
  const pagination = data?.pagination;
  const hasFilters = Boolean(kind || provider || search);
  const showInitialLoader = loading && rows.length === 0;

  const segBtn = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-lime/15 text-lime"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <MonoLabel>Journal des envois</MonoLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            Qui a reçu quoi, quand, via quel provider — et si le message a été ouvert ou cliqué.
          </p>
        </div>
        <RebootButton size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
          <span>Actualiser</span>
        </RebootButton>
      </div>

      {data?.audience && <AudienceBanner audience={data.audience} />}

      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="Total"
            value={stats.total}
            icon={Send}
            active={kind === ""}
            onClick={() => changeKind("")}
            hint="Tous les envois par lot tracés"
          />
          {(Object.keys(KIND_CONFIG) as Array<keyof typeof KIND_CONFIG>).map((k) => (
            <StatTile
              key={k}
              label={KIND_CONFIG[k].label}
              value={stats.byKind[k] ?? 0}
              icon={KIND_CONFIG[k].icon}
              active={kind === k}
              onClick={() => changeKind(k as Kind)}
              hint={`Filtrer sur : ${KIND_CONFIG[k].label}`}
            />
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1" role="group" aria-label="Filtrer par campagne">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.value || "all"}
                type="button"
                onClick={() => changeKind(f.value)}
                aria-pressed={kind === f.value}
                className={segBtn(kind === f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1 rounded-md border border-border bg-card p-1" role="group" aria-label="Filtrer par provider">
            {[
              { value: "" as const, label: "Tous" },
              { value: "brevo" as const, label: "Brevo" },
              { value: "resend" as const, label: "Resend" },
            ].map((p) => (
              <button
                key={p.value || "all"}
                type="button"
                onClick={() => changeProvider(p.value)}
                aria-pressed={provider === p.value}
                className={segBtn(provider === p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher un email ou un prénom…"
            aria-label="Rechercher dans le journal des envois"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Contenu : carte mobile / tableau desktop */}
      {showInitialLoader ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card py-16">
          <RefreshCw className="size-6 animate-spin text-lime" aria-hidden />
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-card py-16">
          <Send className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "Aucun envoi ne correspond à ces filtres." : "Aucun envoi enregistré."}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                changeKind("");
                changeProvider("");
                setSearchInput("");
              }}
              className="text-sm font-medium text-lime hover:text-lime/80"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile : cartes */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => (
              <LogRowCard key={row.id} row={row} />
            ))}
          </ul>

          {/* Desktop : tableau */}
          <div className="hidden overflow-hidden rounded-md border border-border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                      Destinataire
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                      Campagne
                    </th>
                    <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground lg:table-cell">
                      Provider
                    </th>
                    <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground lg:table-cell">
                      Statut membre
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                      Suivi
                    </th>
                    <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground xl:table-cell">
                      ID provider
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-lime/5"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground admin-num">
                        {formatDate(row.at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime/10 text-sm font-semibold text-lime">
                            {initials(row)}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="max-w-[200px] truncate text-sm font-medium text-foreground">
                              {row.firstName || "—"}
                            </span>
                            <span className="max-w-[240px] truncate text-xs text-muted-foreground">
                              {row.email}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <KindBadge kind={row.kind} />
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <ProviderTag provider={row.provider} />
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <MemberStatus row={row} />
                      </td>
                      <td className="px-4 py-3">
                        <EngagementCell row={row} />
                      </td>
                      <td className="hidden px-4 py-3 xl:table-cell">
                        {row.providerId ? (
                          <span className="font-mono text-xs text-muted-foreground" title={row.providerId}>
                            {row.providerId.slice(0, 12)}…
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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

      {pagination && rows.length > 0 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          disabled={loading}
          onChange={setPage}
        />
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Le journal ne référence que les envois{" "}
          <strong className="font-semibold text-foreground">acceptés par le provider</strong>. Les
          échecs d&apos;envoi ne sont pas encore persistés : ils n&apos;apparaissent que dans le
          rapport de la campagne qui les a produits.
        </span>
      </p>
    </div>
  );
}
