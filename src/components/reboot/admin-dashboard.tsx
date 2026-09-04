"use client";

import * as React from "react";
import { Logo, HashSymbol } from "@/components/brand/logo";
import {
  RebootButton,
  MonoLabel,
  Tag,
} from "./shared";
import { DonutChart } from "./donut-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { countryFlag, countryName } from "@/lib/profiling/countries";
import {
  Download,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  LogOut,
  ChevronRight,
  StickyNote,
  Trash2,
  Copy,
  Check,
  FileJson,
  AlertCircle,
} from "lucide-react";

interface MemberRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  country: string;
  primaryDomain: string;
  level: string;
  goal: string;
  mentoringInterest: string | null;
  budgetRange: string | null;
  profileStatus: string;
  communityStatus: string;
  accessLane: string;
  createdAt: string;
  adminNote?: string | null;
}

interface Stats {
  totals: { total: number; approved: number; pending: number; waitlist: number; rejected: number };
  domains: { web: number; cyber: number; ai: number };
  mentoring: number;
  byCountry: { country: string; count: number }[];
  byLevel: { level: string; count: number }[];
  byAvailability: { availability: string; count: number }[];
  byBudget: { budget: string; count: number }[];
  byArchetype: { archetype: string; count: number }[];
}

const DOMAIN_LABEL: Record<string, string> = {
  web: "Web",
  cybersecurity: "Cyber",
  ai: "AI",
};
const LEVEL_LABEL: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratique",
  autonomous: "Autonome",
  advanced: "Avancé",
};
const GOAL_LABEL: Record<string, string> = {
  project: "Projet",
  employment: "Emploi",
  freelance: "Freelance",
  upskill: "Compétences",
  business: "Activité",
  career: "Carrière",
  other: "Autre",
};
const BUDGET_LABEL: Record<string, string> = {
  "<2500": "< 2.5k",
  "2500-5000": "2.5–5k",
  "5000-10000": "5–10k",
  "10000-20000": "10–20k",
  "20000-30000": "20–30k",
  ">30000": "> 30k",
  unknown: "NSP",
};

export function AdminDashboard({ onExit }: { onExit: () => void }) {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [recentMembers, setRecentMembers] = React.useState<MemberRow[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = React.useState<string | null>(null);
  const [bulkResult, setBulkResult] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<"createdAt" | "firstName" | "primaryDomain" | "level" | "profileStatus">("createdAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [funnel, setFunnel] = React.useState<{
    events: { type: string; count: number }[];
    funnel: {
      sessionsStarted: number;
      sessionsCompleted: number;
      whatsappClicks: number;
      completionRate: number;
    };
  } | null>(null);

  const [loadError, setLoadError] = React.useState<string | null>(null);

  const loadMembers = React.useCallback(async () => {
    const params = new URLSearchParams(filters);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    params.set("limit", "200");
    const res = await fetch(`/api/members?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("members");
    const data = await res.json();
    const list = data.members ?? [];
    setMembers(list);
    setRecentMembers(list.slice(0, 5));
  }, [filters, searchQuery]);

  const loadStats = React.useCallback(async () => {
    const res = await fetch("/api/stats", { cache: "no-store" });
    if (!res.ok) throw new Error("stats");
    const data = await res.json();
    setStats(data);
  }, []);

  const loadFunnel = React.useCallback(async () => {
    try {
      const res = await fetch("/api/analytics", { cache: "no-store" });
      if (!res.ok) throw new Error("funnel");
      const data = await res.json();
      setFunnel(data);
    } catch {
      /* analytics optional — don't surface as hard error */
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        await Promise.all([loadStats(), loadMembers(), loadFunnel()]);
      } catch {
        if (mounted) setLoadError("Erreur de chargement des données. Vérifie ta connexion puis rafraîchis.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  function setFilter(key: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev };
      if (!value || value === "all") delete next[key];
      else next[key] = value;
      return next;
    });
  }

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      await Promise.all([loadStats(), loadMembers(), loadFunnel()]);
    } catch {
      setLoadError("Erreur de chargement des données. Vérifie ta connexion puis rafraîchis.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedMembers = React.useMemo(() => {
    const sorted = [...members];
    sorted.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "createdAt") {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        av = (a[sortKey] ?? "").toString().toLowerCase();
        bv = (b[sortKey] ?? "").toString().toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [members, sortKey, sortDir]);

  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    onExit();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (prev.size === members.length) return new Set();
      return new Set(members.map((m) => m.id));
    });
  }

  async function runBulk(action: "approve" | "invite" | "waitlist" | "reject" | "delete") {
    if (selectedIds.size === 0) return;
    setBulkAction(action);
    setBulkResult(null);
    try {
      const res = await fetch("/api/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBulkResult(`Erreur: ${data.error ?? "inconnue"}`);
      } else {
        setBulkResult(`${data.affected} membre(s) — action "${action}" appliquée`);
        setSelectedIds(new Set());
        await refresh();
      }
    } catch {
      setBulkResult("Échec de l'action bulk.");
    } finally {
      setBulkAction(null);
      setTimeout(() => setBulkResult(null), 4000);
    }
  }

  async function deleteMember(id: string) {
    try {
      const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedId(null);
        await refresh();
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="compact" size="sm" />
            <span className="hidden sm:inline text-border">/</span>
            <MonoLabel className="text-lime hidden sm:inline">Admin</MonoLabel>
            <span className="hidden md:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-sm border border-lime/40 bg-lime/5">
              <span className="size-1.5 rounded-full bg-lime animate-hash-pulse" />
              <span className="mono-label text-lime">Session active</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RebootButton size="sm" variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Rafraîchir</span>
            </RebootButton>
            <a
              href={`/api/export?${new URLSearchParams({ ...filters, ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}) }).toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              title={Object.keys(filters).length || searchQuery ? "Exporter la vue filtrée" : "Exporter tous les membres"}
            >
              <RebootButton size="sm" variant="outline">
                <Download className="size-4" />
                <span className="hidden sm:inline">
                  CSV{Object.keys(filters).length || searchQuery ? " (filtré)" : ""}
                </span>
              </RebootButton>
            </a>
            <a
              href={`/api/export/json?${new URLSearchParams({ ...filters, ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}) }).toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Exporter en JSON"
              className="hidden md:inline-block"
            >
              <RebootButton size="sm" variant="outline">
                <FileJson className="size-4" />
                <span className="hidden lg:inline">JSON</span>
              </RebootButton>
            </a>
            <RebootButton size="sm" variant="ghost" onClick={logout} title="Se déconnecter">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </RebootButton>
            <RebootButton size="sm" variant="ghost" onClick={onExit}>
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Site</span>
            </RebootButton>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-7xl w-full px-5 sm:px-8 py-8">
        {/* Error banner */}
        {loadError && (
          <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4 animate-hash-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 text-destructive shrink-0" />
              <p className="text-sm text-foreground">{loadError}</p>
            </div>
            <button
              onClick={refresh}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
            >
              Réessayer
            </button>
          </div>
        )}
        {/* Stat overview */}
        <section>
          <MonoLabel className="text-muted-foreground">Vue d&apos;ensemble</MonoLabel>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
            <StatCard icon={<Users className="size-4" />} label="Inscrits" value={stats?.totals.total ?? "—"} onClick={() => setFilters({})} />
            <StatCard icon={<CheckCircle2 className="size-4 text-lime" />} label="Validés" value={stats?.totals.approved ?? "—"} tone="lime" onClick={() => setFilter("status", "APPROVED")} />
            <StatCard icon={<Clock className="size-4" />} label="En attente" value={stats?.totals.pending ?? "—"} onClick={() => setFilter("status", "PENDING")} />
            <StatCard icon={<XCircle className="size-4" />} label="Waitlist" value={stats?.totals.waitlist ?? "—"} onClick={() => setFilter("status", "WAITLIST")} />
            <StatCard label="Web" value={stats?.domains.web ?? "—"} onClick={() => setFilter("domain", "web")} />
            <StatCard label="Cyber" value={stats?.domains.cyber ?? "—"} onClick={() => setFilter("domain", "cybersecurity")} />
            <StatCard label="AI" value={stats?.domains.ai ?? "—"} onClick={() => setFilter("domain", "ai")} />
          </div>
        </section>

        {/* Domain distribution donut + breakdowns */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-md border border-border/60 bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <MonoLabel className="text-muted-foreground">Par domaine</MonoLabel>
              <span className="mono-label text-muted-foreground">
                {stats ? stats.domains.web + stats.domains.cyber + stats.domains.ai : 0}
              </span>
            </div>
            <div className="mt-4">
              {stats ? (
                <DonutChart
                  segments={[
                    { label: "Web Development", value: stats.domains.web },
                    { label: "Cybersecurity", value: stats.domains.cyber },
                    { label: "Applied AI", value: stats.domains.ai },
                  ]}
                  centerValue={stats.domains.web + stats.domains.cyber + stats.domains.ai}
                  centerLabel="membres"
                />
              ) : (
                <p className="text-xs text-muted-foreground">Aucune donnée.</p>
              )}
            </div>
          </div>
          <Breakdown title="Par pays" rows={(stats?.byCountry ?? []).map((c) => [`${countryFlag(c.country)} ${countryName(c.country)}`, c.count])} />
          <Breakdown title="Par niveau" rows={(stats?.byLevel ?? []).map((l) => [LEVEL_LABEL[l.level] ?? l.level, l.count])} />
        </section>

        {/* Breakdowns (budget) — full width */}
        <section className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Breakdown title="Par budget" rows={(stats?.byBudget ?? []).map((b) => [BUDGET_LABEL[b.budget] ?? b.budget ?? "—", b.count])} />
          <div className="rounded-md border border-border/60 bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <MonoLabel className="text-muted-foreground">Par archétype</MonoLabel>
              <span className="mono-label text-muted-foreground">
                {stats?.byArchetype.length ?? 0}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {(stats?.byArchetype ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Aucune donnée.</p>
              )}
              {(stats?.byArchetype ?? []).map((a) => {
                const total = (stats?.byArchetype ?? []).reduce((s, x) => s + x.count, 0) || 1;
                const pct = Math.round((a.count / total) * 100);
                return (
                  <div key={a.archetype} className="group flex items-center gap-3">
                    <span className="text-xs text-foreground truncate w-32 font-mono">
                      {a.archetype}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-lime/70 transition-all duration-300 group-hover:bg-lime"
                        style={{ width: `${(a.count / Math.max(1, Math.max(...(stats?.byArchetype ?? []).map((x) => x.count)))) * 100}%` }}
                      />
                    </div>
                    <span className="mono-label text-muted-foreground w-12 text-right tabular-nums">
                      {a.count} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Funnel analytics — connected steps with arrows */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <MonoLabel className="text-muted-foreground">Funnel</MonoLabel>
            <span className="mono-label text-muted-foreground">
              {funnel?.funnel.completionRate ?? 0}% complétion
            </span>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
            {funnel ? (
              <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                <FunnelStep
                  label="Sessions démarrées"
                  value={funnel.funnel.sessionsStarted}
                  className="flex-1"
                />
                <FunnelConnector />
                <FunnelStep
                  label="Profils complétés"
                  value={funnel.funnel.sessionsCompleted}
                  className="flex-1"
                />
                <FunnelConnector />
                <FunnelStep
                  label="Clics WhatsApp"
                  value={funnel.funnel.whatsappClicks}
                  className="flex-1"
                />
                <FunnelConnector />
                <FunnelStep
                  label="Taux de complétion"
                  value={`${funnel.funnel.completionRate}%`}
                  tone="lime"
                  className="flex-1"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Aucune donnée analytics pour l&apos;instant.
              </p>
            )}
          </div>
        </section>

        {/* Admin activity log — chronological feed of system/admin events */}
        <ActivityLog />

        {/* Filter bar */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <MonoLabel className="text-muted-foreground">Filtres</MonoLabel>
            {Object.keys(filters).length > 0 && (
              <button
                onClick={() => setFilters({})}
                className="text-xs text-muted-foreground hover:text-lime transition-colors focus-lime mono-label"
              >
                ✕ Réinitialiser
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 p-3 rounded-md border border-border/60 bg-card/40">
            <FilterSelect placeholder="Domaine" value={filters.domain ?? "all"} onChange={(v) => setFilter("domain", v)}
              options={[["web", "Web"], ["cybersecurity", "Cyber"], ["ai", "AI"]]} />
            <FilterSelect placeholder="Niveau" value={filters.level ?? "all"} onChange={(v) => setFilter("level", v)}
              options={[["beginner", "Débutant"], ["practicing", "Pratique"], ["autonomous", "Autonome"], ["advanced", "Avancé"]]} />
            <FilterSelect placeholder="Statut" value={filters.status ?? "all"} onChange={(v) => setFilter("status", v)}
              options={[["APPROVED", "Validé"], ["PENDING", "En attente"], ["WAITLIST", "Waitlist"], ["REJECTED", "Rejeté"]]} />
            <FilterSelect placeholder="Voie" value={filters.lane ?? "all"} onChange={(v) => setFilter("lane", v)}
              options={[["immediate", "Accès immédiat"], ["pending", "En traitement"]]} />
            <FilterSelect placeholder="Mentorat" value={filters.mentoring ?? "all"} onChange={(v) => setFilter("mentoring", v)}
              options={[["yes", "Oui"], ["maybe", "Peut-être"], ["no", "Non"]]} />
            <FilterSelect placeholder="Budget" value={filters.budget ?? "all"} onChange={(v) => setFilter("budget", v)}
              options={[
                ["<2500", "< 2.5k"], ["2500-5000", "2.5–5k"], ["5000-10000", "5–10k"],
                ["10000-20000", "10–20k"], ["20000-30000", "20–30k"], [">30000", "> 30k"], ["unknown", "NSP"],
              ]} />
            {/* Search box — searches first name + email */}
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher (nom, email)…"
                className="w-full h-9 rounded-md border border-border bg-card pl-3 pr-8 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-lime focus:border-lime/60"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                ⌕
              </span>
            </div>
          </div>
        </section>

        {/* Recent activity feed */}
        {recentMembers.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <MonoLabel className="text-muted-foreground">Activité récente</MonoLabel>
              <span className="mono-label text-muted-foreground">
                {recentMembers.length} derniers
              </span>
            </div>
            <div className="rounded-md border border-border/60 bg-card/40 divide-y divide-border/40">
              {recentMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className="row-sweep w-full flex items-center gap-3 p-3.5 hover:bg-elevated/40 transition-colors text-left group"
                >
                  <span
                    className={cn(
                      "shrink-0 size-2 rounded-full",
                      m.profileStatus === "APPROVED"
                        ? "bg-lime"
                        : m.profileStatus === "PENDING"
                          ? "bg-amber-500"
                          : "bg-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-foreground group-hover:text-lime transition-colors truncate">
                        {m.firstName} {m.lastName ?? ""}
                      </span>
                      <span className="mono-label text-muted-foreground shrink-0">
                        {DOMAIN_LABEL[m.primaryDomain] ?? m.primaryDomain} · {LEVEL_LABEL[m.level] ?? m.level}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {m.email}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Tag active={m.accessLane === "immediate"}>
                      {m.accessLane === "immediate" ? "Immédiat" : "En traitement"}
                    </Tag>
                    <span className="mono-label text-muted-foreground tabular-nums">
                      {new Date(m.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Member table */}
        <section className="mt-6">
          {/* Bulk action bar — appears when rows are selected */}
          {selectedIds.size > 0 && (
            <div className="mb-3 rounded-md border border-lime/40 bg-lime/[0.06] p-3 flex flex-wrap items-center gap-2 animate-hash-in">
              <span className="mono-label text-lime">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
              </span>
              <span className="text-border">·</span>
              <button
                onClick={() => runBulk("approve")}
                disabled={!!bulkAction}
                className="text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
              >
                Valider
              </button>
              <button
                onClick={() => runBulk("invite")}
                disabled={!!bulkAction}
                className="text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
              >
                Inviter
              </button>
              <button
                onClick={() => runBulk("waitlist")}
                disabled={!!bulkAction}
                className="text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-amber-500/60 hover:text-amber-300 transition-colors focus-lime disabled:opacity-50"
              >
                Waitlist
              </button>
              <button
                onClick={() => runBulk("reject")}
                disabled={!!bulkAction}
                className="text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-destructive/60 hover:text-destructive transition-colors focus-lime disabled:opacity-50"
              >
                Rejeter
              </button>
              <button
                onClick={() => runBulk("delete")}
                disabled={!!bulkAction}
                className="text-xs px-2.5 py-1 rounded-sm border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/15 transition-colors focus-lime disabled:opacity-50"
              >
                Supprimer
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-lime mono-label ml-auto"
              >
                ✕ Annuler
              </button>
              {bulkResult && (
                <span className="w-full text-xs text-muted-foreground">{bulkResult}</span>
              )}
            </div>
          )}
          <div className="rounded-md border border-border/60 overflow-hidden bg-card/30">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/60 bg-secondary/30">
                  <TableHead className="w-8">
                    <input
                      type="checkbox"
                      checked={members.length > 0 && selectedIds.size === members.length}
                      onChange={toggleSelectAll}
                      className="size-3.5 accent-lime cursor-pointer"
                      aria-label="Sélectionner tout"
                    />
                  </TableHead>
                  <TableHead className="mono-label">
                    <SortHeader label="Nom" active={sortKey === "firstName"} dir={sortDir} onClick={() => toggleSort("firstName")} />
                  </TableHead>
                  <TableHead className="mono-label">Pays</TableHead>
                  <TableHead className="mono-label">
                    <SortHeader label="Domaine" active={sortKey === "primaryDomain"} dir={sortDir} onClick={() => toggleSort("primaryDomain")} />
                  </TableHead>
                  <TableHead className="mono-label">
                    <SortHeader label="Niveau" active={sortKey === "level"} dir={sortDir} onClick={() => toggleSort("level")} />
                  </TableHead>
                  <TableHead className="mono-label hidden md:table-cell">Objectif</TableHead>
                  <TableHead className="mono-label hidden md:table-cell">Mentorat</TableHead>
                  <TableHead className="mono-label hidden lg:table-cell">Budget</TableHead>
                  <TableHead className="mono-label">
                    <SortHeader label="Statut" active={sortKey === "profileStatus"} dir={sortDir} onClick={() => toggleSort("profileStatus")} />
                  </TableHead>
                  <TableHead className="mono-label hidden sm:table-cell">Voie</TableHead>
                  <TableHead className="mono-label text-right">
                    <SortHeader label="Date" active={sortKey === "createdAt"} dir={sortDir} onClick={() => toggleSort("createdAt")} align="right" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                      Aucun membre pour ces filtres.
                    </TableCell>
                  </TableRow>
                )}
                {sortedMembers.map((m) => (
                  <TableRow
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "row-sweep cursor-pointer border-border/40 hover:bg-elevated/50 transition-colors group",
                      selectedIds.has(m.id) && "bg-lime/[0.04]",
                    )}
                  >
                    <TableCell className="w-8 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(m.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="size-3.5 accent-lime cursor-pointer"
                        aria-label={`Sélectionner ${m.firstName}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground group-hover:text-lime transition-colors">
                          {m.firstName} {m.lastName ?? ""}
                        </span>
                        {m.adminNote && (
                          <span
                            className="shrink-0 inline-flex items-center justify-center size-4 rounded-sm border border-amber-500/50 bg-amber-500/10 text-amber-300"
                            title="Note interne"
                            aria-label="Note interne présente"
                          >
                            <StickyNote className="size-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px] font-mono">{m.email}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{countryFlag(m.country)} {countryName(m.country)}</TableCell>
                    <TableCell>{DOMAIN_LABEL[m.primaryDomain] ?? m.primaryDomain}</TableCell>
                    <TableCell>{LEVEL_LABEL[m.level] ?? m.level}</TableCell>
                    <TableCell className="hidden md:table-cell">{GOAL_LABEL[m.goal] ?? m.goal}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {m.mentoringInterest === "yes" ? "Oui" : m.mentoringInterest === "maybe" ? "Peut-être" : m.mentoringInterest === "no" ? "Non" : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{m.budgetRange ? BUDGET_LABEL[m.budgetRange] ?? m.budgetRange : "—"}</TableCell>
                    <TableCell><StatusBadge status={m.profileStatus} /></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Tag active={m.accessLane === "immediate"}>
                        {m.accessLane === "immediate" ? "Immédiat" : "En traitement"}
                      </Tag>
                    </TableCell>
                    <TableCell className="text-right mono-label text-muted-foreground tabular-nums">
                      {new Date(m.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {members.length} membre{members.length > 1 ? "s" : ""} · Clique sur une ligne pour voir le détail et changer le statut.
          </p>
        </section>
      </main>

      <footer className="mt-auto border-t border-border/60">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-4">
          <p className="text-center text-xs text-muted-foreground">
            HASHCODE REBOOT · Admin — accès réservé. Les exports contiennent des données membres.
          </p>
        </div>
      </footer>

      <MemberDetailDialog
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={refresh}
        onDelete={deleteMember}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: "lime";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "bg-card p-4 sm:p-5 relative overflow-hidden text-left",
        "transition-colors duration-180",
        onClick && "cursor-pointer hover:bg-elevated/60",
        tone === "lime" && "bg-lime/[0.04]",
        !onClick && "cursor-default",
      )}
    >
      {tone === "lime" && (
        <div
          className="absolute top-0 left-0 right-0 h-px bg-lime/60"
          aria-hidden
        />
      )}
      <div className="flex items-center gap-1.5">
        {icon}
        <MonoLabel className="text-muted-foreground">{label}</MonoLabel>
      </div>
      <div className="mt-2 font-display font-bold text-2xl sm:text-3xl text-foreground animate-hash-roll tabular-nums">
        {value}
      </div>
    </button>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const total = rows.reduce((s, r) => s + r[1], 0);
  return (
    <div className="rounded-md border border-border/60 bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <MonoLabel className="text-muted-foreground">{title}</MonoLabel>
        <span className="mono-label text-muted-foreground">{total}</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucune donnée.</p>
        )}
        {rows.slice(0, 8).map(([label, count]) => {
          const pct = Math.round((count / total) * 100) || 0;
          return (
            <div key={label} className="group flex items-center gap-3">
              <span className="text-xs text-foreground truncate w-24 sm:w-32">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-lime/70 transition-all duration-300 group-hover:bg-lime"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="mono-label text-muted-foreground w-12 text-right tabular-nums">
                {count}
                <span className="opacity-50 ml-1">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: number | string;
  tone?: "lime";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3.5 flex flex-col gap-1.5",
        tone === "lime" ? "border-lime/40 bg-lime/[0.04]" : "border-border/60 bg-card",
        className,
      )}
    >
      <MonoLabel className="text-muted-foreground">{label}</MonoLabel>
      <div
        className={cn(
          "font-display font-bold text-2xl sm:text-3xl tabular-nums animate-hash-roll",
          tone === "lime" ? "text-lime" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Visual connector between funnel steps — animated chevron, hidden on narrow. */
function FunnelConnector() {
  return (
    <div className="hidden sm:flex items-center justify-center text-muted-foreground/50 self-stretch px-1">
      <ChevronRight className="size-4" />
    </div>
  );
}

const EVENT_LABELS: Record<string, { label: string; tone: "lime" | "sky" | "amber" | "muted" | "destructive" }> = {
  reboot_page_view: { label: "Page vue", tone: "muted" },
  reboot_cta_clicked: { label: "CTA cliqué", tone: "sky" },
  profiling_started: { label: "Profilage démarré", tone: "sky" },
  profiling_question_answered: { label: "Question répondue", tone: "muted" },
  profiling_back: { label: "Retour arrière", tone: "muted" },
  profiling_resumed: { label: "Reprise", tone: "muted" },
  profiling_completed: { label: "Profil complété", tone: "lime" },
  profil_generated: { label: "Profil généré", tone: "lime" },
  community_cta_clicked: { label: "Action communauté", tone: "amber" },
  whatsapp_join_clicked: { label: "Clic WhatsApp", tone: "lime" },
  share_profile_clicked: { label: "Partage profil", tone: "sky" },
};

const EVENT_TONES: Record<string, string> = {
  lime: "text-lime",
  sky: "text-sky-400",
  amber: "text-amber-300",
  muted: "text-muted-foreground",
  destructive: "text-destructive",
};

function ActivityLog() {
  const [events, setEvents] = React.useState<
    { id: string; type: string; ref: string | null; createdAt: string }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/admin/activity?limit=${expanded ? 50 : 12}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .finally(() => setLoading(false));
  }, [expanded]);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <MonoLabel className="text-muted-foreground">Journal d&apos;activité</MonoLabel>
        <span className="mono-label text-muted-foreground">
          {events.length} événement{events.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="rounded-md border border-border/60 bg-card/40 divide-y divide-border/40 max-h-96 overflow-y-auto scroll-slim">
        {loading && (
          <p className="p-4 text-xs text-muted-foreground">Chargement…</p>
        )}
        {!loading && events.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">Aucun événement.</p>
        )}
        {events.map((ev) => {
          const meta = EVENT_LABELS[ev.type] ?? { label: ev.type, tone: "muted" as const };
          const isAdminAction = ev.ref?.startsWith("admin-");
          return (
            <div key={ev.id} className="flex items-center gap-3 p-3 hover:bg-elevated/30 transition-colors">
              <span
                className={cn(
                  "shrink-0 size-1.5 rounded-full",
                  meta.tone === "lime" && "bg-lime",
                  meta.tone === "sky" && "bg-sky-400",
                  meta.tone === "amber" && "bg-amber-400",
                  meta.tone === "destructive" && "bg-destructive",
                  meta.tone === "muted" && "bg-muted-foreground/50",
                )}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-sm font-medium", EVENT_TONES[meta.tone])}>
                    {meta.label}
                  </span>
                  {isAdminAction && (
                    <span className="mono-label text-amber-300 text-[9px]">ADMIN</span>
                  )}
                </div>
                {ev.ref && (
                  <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                    {ev.ref}
                  </div>
                )}
              </div>
              <span className="shrink-0 mono-label text-muted-foreground tabular-nums text-[10px]">
                {new Date(ev.createdAt).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 text-xs text-muted-foreground hover:text-lime transition-colors focus-lime mono-label"
      >
        {expanded ? "↑ Voir moins" : "↓ Voir plus (50)"}
      </button>
    </section>
  );
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const active = value && value !== "all";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "h-9 w-auto gap-2 rounded-full px-4 text-sm min-w-32 transition-colors",
          active
            ? "border-lime/60 bg-lime/10 text-lime"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        <SelectItem value="all">{placeholder} · Tous</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>{l}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Sortable table header button with direction indicator. */
function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 hover:text-lime transition-colors focus-lime",
        active && "text-lime",
        align === "right" && "flex-row-reverse",
      )}
    >
      {label}
      {active && (
        <span className="text-[10px]" aria-hidden>
          {dir === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );
}

/** Timeline step — vertical journey node with connecting line. */
function TimelineStep({
  done,
  label,
  detail,
  tone = "muted",
  last,
}: {
  done: boolean;
  label: string;
  detail: string;
  tone?: "lime" | "sky" | "muted";
  last?: boolean;
}) {
  const dotColor =
    tone === "lime"
      ? "bg-lime"
      : tone === "sky"
        ? "bg-sky-400"
        : "bg-muted-foreground/40";
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "size-2.5 rounded-full shrink-0 mt-1 transition-colors",
            dotColor,
            done && tone === "lime" && "shadow-[0_0_8px_rgba(197,244,65,0.5)]",
          )}
          aria-hidden
        />
        {!last && <span className="w-px flex-1 bg-border/60 min-h-[20px] mt-1" aria-hidden />}
      </div>
      <div className="flex-1 pb-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: "lime" | "muted" | "warn" | "destructive" }> = {
    APPROVED: { label: "Validé", tone: "lime" },
    PENDING: { label: "En attente", tone: "warn" },
    WAITLIST: { label: "Waitlist", tone: "muted" },
    REJECTED: { label: "Rejeté", tone: "destructive" },
  };
  const s = map[status] ?? { label: status, tone: "muted" as const };
  const tones: Record<string, string> = {
    lime: "border-lime/50 text-lime bg-lime/5",
    muted: "border-border text-muted-foreground",
    warn: "border-amber-500/50 text-amber-300 bg-amber-500/5",
    destructive: "border-destructive/50 text-destructive bg-destructive/5",
  };
  return (
    <span className={cn("inline-flex items-center rounded-sm border px-2 py-0.5 text-xs mono-label", tones[s.tone])}>
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Detail dialog with status controls                                  */
/* ------------------------------------------------------------------ */

function MemberDetailDialog({
  id,
  onClose,
  onChanged,
  onDelete,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [member, setMember] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!id) {
      setMember(null);
      return;
    }
    setLoading(true);
    fetch(`/api/members/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMember(d.member ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    if (!id) return;
    await fetch(`/api/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Refresh detail + table.
    const d = await fetch(`/api/members/${id}`, { cache: "no-store" }).then((r) => r.json());
    setMember(d.member ?? null);
    onChanged();
  }

  async function invite(): Promise<{ inviteMessage: string; whatsappUrl: string } | null> {
    if (!id) return null;
    try {
      const res = await fetch(`/api/members/${id}/invite`, { method: "POST" });
      const data = await res.json();
      // Refresh detail + table after status change.
      const d = await fetch(`/api/members/${id}`, { cache: "no-store" }).then((r) => r.json());
      setMember(d.member ?? null);
      onChanged();
      return { inviteMessage: data.inviteMessage, whatsappUrl: data.whatsappUrl };
    } catch {
      return null;
    }
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">Détail du membre</DialogTitle>
        </DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!loading && member && (
          <MemberDetail
            member={member}
            onPatch={patch}
            onInvite={invite}
            onDelete={() => id && onDelete(id)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberDetail({
  member,
  onPatch,
  onInvite,
  onDelete,
}: {
  member: Record<string, unknown>;
  onPatch: (b: Record<string, unknown>) => void;
  onInvite: () => Promise<{ inviteMessage: string; whatsappUrl: string } | null>;
  onDelete: () => Promise<void>;
}) {
  const m = member as {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    country: string;
    city: string | null;
    gender: string | null;
    primaryDomain: string;
    domainSpecialty: string[];
    level: string;
    goal: string;
    goalProjectStage: string | null;
    goalSituation: string | null;
    availability: string;
    learningStyle: string;
    mentoringInterest: string | null;
    mentoringMaybeReason: string | null;
    mentoringTypes: string[];
    mentoringFrequency: string | null;
    budgetWillingness: string | null;
    budgetRange: string | null;
    threeMonthGoal: string | null;
    profileArchetype: string | null;
    tags: string[];
    profileStatus: string;
    communityStatus: string;
    accessLane: string;
    createdAt: string;
    adminNote: string | null;
  };

  const [inviteState, setInviteState] = React.useState<"idle" | "sending" | "sent">("idle");
  const [noteDraft, setNoteDraft] = React.useState(m.adminNote ?? "");
  const [noteSaved, setNoteSaved] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // Sync note draft when member changes (e.g. after patch refresh).
  React.useEffect(() => {
    setNoteDraft(m.adminNote ?? "");
    setNoteSaved(false);
    setConfirmDelete(false);
  }, [m.id, m.adminNote]);

  async function copyField(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function handleInviteClick() {
    setInviteState("sending");
    const res = await onInvite();
    if (res) {
      const text = `${res.inviteMessage} ${res.whatsappUrl}`;
      try {
        await navigator.clipboard.writeText(text);
        setInviteState("sent");
        setTimeout(() => setInviteState("idle"), 2500);
      } catch {
        setInviteState("idle");
      }
    } else {
      setInviteState("idle");
    }
  }

  function saveNote() {
    onPatch({ adminNote: noteDraft.trim() || null });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const rows: [string, React.ReactNode][] = [
    ["Identité", `${m.firstName} ${m.lastName ?? ""}`.trim()],
    ["Email", (
      // eslint-disable-next-line react/jsx-key
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono text-xs">{m.email}</span>
        <button
          onClick={() => copyField("email", m.email)}
          className="text-muted-foreground hover:text-lime transition-colors focus-lime"
          title="Copier l'email"
          aria-label="Copier l'email"
        >
          {copiedField === "email" ? <Check className="size-3 text-lime" /> : <Copy className="size-3" />}
        </button>
      </span>
    )],
    ["Téléphone", m.phone ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono text-xs">{m.phone}</span>
        <button
          onClick={() => copyField("phone", m.phone!)}
          className="text-muted-foreground hover:text-lime transition-colors focus-lime"
          title="Copier le téléphone"
          aria-label="Copier le téléphone"
        >
          {copiedField === "phone" ? <Check className="size-3 text-lime" /> : <Copy className="size-3" />}
        </button>
      </span>
    ) : "—"],
    ["Pays / Ville", `${countryFlag(m.country)} ${countryName(m.country)}${m.city ? " · " + m.city : ""}`],
    ["Domaine", DOMAIN_LABEL[m.primaryDomain] ?? m.primaryDomain],
    ["Spécialité", Array.isArray(m.domainSpecialty) && m.domainSpecialty.length ? m.domainSpecialty.join(", ") : "—"],
    ["Niveau", LEVEL_LABEL[m.level] ?? m.level],
    ["Objectif", GOAL_LABEL[m.goal] ?? m.goal],
    ["Disponibilité", m.availability],
    ["Style", m.learningStyle],
    ["Mentorat", m.mentoringInterest ?? "—"],
    ["Budget", m.budgetRange ? BUDGET_LABEL[m.budgetRange] ?? m.budgetRange : "—"],
    ["Objectif 3 mois", m.threeMonthGoal ? `« ${m.threeMonthGoal} »` : "—"],
    ["Archétype", m.profileArchetype ?? "—"],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([label, val]) => (
          <div key={label}>
            <MonoLabel className="text-muted-foreground">{label}</MonoLabel>
            <div className="mt-0.5 text-sm text-foreground">{val}</div>
          </div>
        ))}
      </div>

      {m.tags.length > 0 && (
        <div>
          <MonoLabel className="text-muted-foreground">Tags</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>
      )}

      {/* Member journey timeline — visual recap of the member's path */}
      <div className="pt-4 border-t border-border/60">
        <MonoLabel className="text-muted-foreground">Parcours</MonoLabel>
        <div className="mt-4 space-y-3">
          <TimelineStep
            done
            label="Inscription"
            detail={new Date(m.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          />
          <TimelineStep
            done={m.profileStatus === "APPROVED"}
            label="Profil validé"
            detail={m.profileStatus === "APPROVED" ? "Accès immédiat accordé" : "En attente de validation"}
            tone={m.profileStatus === "APPROVED" ? "lime" : "muted"}
          />
          <TimelineStep
            done={m.communityStatus === "INVITED" || m.communityStatus === "JOINED"}
            label="Invitation communauté"
            detail={
              m.communityStatus === "JOINED"
                ? "A rejoint la communauté"
                : m.communityStatus === "INVITED"
                  ? "Invitation envoyée"
                  : "Pas encore invité"
            }
            tone={m.communityStatus === "JOINED" ? "lime" : m.communityStatus === "INVITED" ? "sky" : "muted"}
          />
          <TimelineStep
            done={m.accessLane === "immediate"}
            label="WhatsApp"
            detail={m.accessLane === "immediate" ? "Lien accessible" : "Verrouillé (PENDING)"}
            tone={m.accessLane === "immediate" ? "lime" : "muted"}
            last
          />
        </div>
      </div>

      {/* Status controls */}
      <div className="pt-4 border-t border-border/60 space-y-4">
        <div>
          <MonoLabel className="text-muted-foreground">Statut profil</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {["PENDING", "APPROVED", "WAITLIST", "REJECTED"].map((s) => (
              <RebootButton
                key={s}
                size="sm"
                variant={m.profileStatus === s ? "primary" : "outline"}
                onClick={() => onPatch({ profileStatus: s })}
              >
                {s === "PENDING" ? "En attente" : s === "APPROVED" ? "Valider" : s === "WAITLIST" ? "Waitlist" : "Rejeter"}
              </RebootButton>
            ))}
          </div>
        </div>
        <div>
          <MonoLabel className="text-muted-foreground">Statut communauté</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {["NOT_INVITED", "INVITED", "JOINED"].map((s) => (
              <RebootButton
                key={s}
                size="sm"
                variant={m.communityStatus === s ? "primary" : "outline"}
                onClick={() => onPatch({ communityStatus: s })}
              >
                {s === "NOT_INVITED" ? "Pas invité" : s === "INVITED" ? "Invité" : "Rejoint"}
              </RebootButton>
            ))}
          </div>
        </div>

        {/* Send-invitation action — copies WhatsApp URL + personal message to clipboard */}
        <div className="pt-2">
          <MonoLabel className="text-muted-foreground">Invitation</MonoLabel>
          <div className="mt-2">
            <RebootButton
              size="sm"
              variant="outline"
              onClick={handleInviteClick}
              disabled={inviteState === "sending"}
              className={cn(inviteState === "sent" && "border-lime/60 text-lime")}
            >
              {inviteState === "sending"
                ? "Préparation…"
                : inviteState === "sent"
                  ? "Message copié ✓"
                  : "Préparer l'invitation (copier le message)"}
            </RebootButton>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Marque le profil comme validé + invité, et copie un message
              personnel prêt à coller dans WhatsApp.
            </p>
          </div>
        </div>

        {/* Admin notes — internal, not shown to member */}
        <div className="pt-2">
          <div className="flex items-center justify-between">
            <MonoLabel className="text-muted-foreground">Note interne</MonoLabel>
            {noteSaved && (
              <span className="mono-label text-lime">Enregistré ✓</span>
            )}
          </div>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Contexte, priorité, prochain suivi… (visible admin uniquement)"
            rows={3}
            className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-lime focus:border-lime/60 resize-none scroll-slim"
          />
          <div className="mt-2 flex items-center gap-2">
            <RebootButton
              size="sm"
              variant="outline"
              onClick={saveNote}
              disabled={noteDraft.trim() === (m.adminNote ?? "")}
            >
              Enregistrer la note
            </RebootButton>
            {m.adminNote && (
              <button
                onClick={() => setNoteDraft("")}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors focus-lime mono-label"
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Valider un profil invite automatiquement à la communauté.
        </p>
      </div>

      {/* Danger zone — delete member */}
      <div className="mt-5 pt-4 border-t border-destructive/30">
        <MonoLabel className="text-destructive/80">Zone de danger</MonoLabel>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors focus-lime inline-flex items-center gap-1.5"
          >
            <Trash2 className="size-3.5" />
            Supprimer ce membre
          </button>
        ) : (
          <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 animate-hash-in">
            <p className="text-sm text-foreground">
              Supprimer définitivement{" "}
              <span className="font-medium">{m.firstName}</span> ? Cette action
              efface aussi ses événements analytics. Irréversible.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs px-3 py-1.5 rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors focus-lime disabled:opacity-50"
              >
                {deleting ? "Suppression…" : "Confirmer la suppression"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors focus-lime"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
