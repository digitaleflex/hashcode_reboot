"use client";

import * as React from "react";
import { MonoLabel, Tag } from "../shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { countryFlag, countryName } from "@/lib/profiling/countries";
import { StickyNote } from "lucide-react";
import type {
  MemberRow,
  SortDir,
  SortKey,
} from "./hooks/useMembers";

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

export function MemberTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      aria-hidden
      className="rounded-md border border-border/60 overflow-hidden bg-card/30 p-3 space-y-2.5"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="admin-skeleton admin-skeleton-avatar" />
          <div className="flex-1 space-y-2">
            <div className="admin-skeleton admin-skeleton-line w-2/5" />
            <div className="admin-skeleton admin-skeleton-line w-3/5" />
          </div>
          <div className="admin-skeleton admin-skeleton-pill hidden sm:block" />
        </div>
      ))}
      <span className="sr-only">Chargement des membres…</span>
    </div>
  );
}

export function MemberTable({
  members,
  total,
  page,
  pageSize,
  sortKey,
  sortDir,
  filters,
  searchQuery,
  recentMembers,
  selectedIds,
  bulkAction,
  bulkResult,
  confirmBulkDelete,
  loading,
  serverSorted,
  onToggleSort,
  onToggleSelect,
  onToggleSelectAll,
  onFilter,
  onClearFilters,
  onSearchChange,
  onSelectMember,
  onBulk,
  onCancelSelection,
  onDismissBulkResult,
  onConfirmBulkDeleteChange,
  onPageChange,
}: {
  members: MemberRow[];
  total: number;
  page: number;
  pageSize: number;
  sortKey: SortKey;
  sortDir: SortDir;
  filters: Record<string, string>;
  searchQuery: string;
  recentMembers: MemberRow[];
  selectedIds: Set<string>;
  bulkAction: string | null;
  bulkResult: string | null;
  confirmBulkDelete: boolean;
  loading: boolean;
  serverSorted: boolean;
  onToggleSort: (key: SortKey) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onFilter: (key: string, value: string) => void;
  onClearFilters: () => void;
  onSearchChange: (v: string) => void;
  onSelectMember: (id: string) => void;
  onBulk: (action: "approve" | "invite" | "waitlist" | "reject" | "delete") => void;
  onCancelSelection: () => void;
  onDismissBulkResult: () => void;
  onConfirmBulkDeleteChange: (v: boolean) => void;
  onPageChange: (p: number) => void;
}) {
  // Fallback tri client si backend absent (legacy sans total/tri serveur).
  const displayed = React.useMemo(() => {
    if (serverSorted) return members;
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
  }, [members, serverSorted, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Progressive disclosure : filtres avancés repliés par défaut (L1 = domaine/niveau/statut + recherche).
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const ADVANCED_KEYS = ["lane", "mentoring", "budget"] as const;
  const activeAdvancedCount = ADVANCED_KEYS.filter((k) => filters[k]).length;

  return (
    <>
      {/* Filter bar */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <MonoLabel className="text-muted-foreground">Filtres</MonoLabel>
          {Object.keys(filters).length > 0 && (
            <button
              onClick={onClearFilters}
              className="text-xs text-muted-foreground hover:text-lime transition-colors focus-lime mono-label"
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 p-3 rounded-md border border-border/60 bg-card/40">
          <FilterSelect
            placeholder="Domaine"
            value={filters.domain ?? "all"}
            onChange={(v) => onFilter("domain", v)}
            options={[
              ["web", "Web"],
              ["cybersecurity", "Cyber"],
              ["ai", "AI"],
            ]}
          />
          <FilterSelect
            placeholder="Niveau"
            value={filters.level ?? "all"}
            onChange={(v) => onFilter("level", v)}
            options={[
              ["beginner", "Débutant"],
              ["practicing", "Pratique"],
              ["autonomous", "Autonome"],
              ["advanced", "Avancé"],
            ]}
          />
          <FilterSelect
            placeholder="Statut"
            value={filters.status ?? "all"}
            onChange={(v) => onFilter("status", v)}
            options={[
              ["APPROVED", "Validé"],
              ["PENDING", "En attente"],
              ["WAITLIST", "Waitlist"],
              ["REJECTED", "Rejeté"],
            ]}
          />
          {/* Advanced filters — collapsed by default (progressive disclosure L2) */}
          {advancedOpen && (
            <>
              <FilterSelect
                placeholder="Voie"
                value={filters.lane ?? "all"}
                onChange={(v) => onFilter("lane", v)}
                options={[
                  ["immediate", "Accès immédiat"],
                  ["pending", "En traitement"],
                ]}
              />
              <FilterSelect
                placeholder="Mentorat"
                value={filters.mentoring ?? "all"}
                onChange={(v) => onFilter("mentoring", v)}
                options={[
                  ["yes", "Oui"],
                  ["maybe", "Peut-être"],
                  ["no", "Non"],
                ]}
              />
              <FilterSelect
                placeholder="Budget"
                value={filters.budget ?? "all"}
                onChange={(v) => onFilter("budget", v)}
                options={[
                  ["<2500", "< 2.5k"],
                  ["2500-5000", "2.5–5k"],
                  ["5000-10000", "5–10k"],
                  ["10000-20000", "10–20k"],
                  ["20000-30000", "20–30k"],
                  [">30000", "> 30k"],
                  ["unknown", "NSP"],
                ]}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            aria-expanded={advancedOpen}
            className={cn(
              "h-9 px-3 rounded-full border text-sm transition-colors min-w-32 inline-flex items-center justify-center gap-1.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
              activeAdvancedCount > 0
                ? "border-lime/60 bg-lime/10 text-lime"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {advancedOpen ? "− Moins de filtres" : "+ Filtres avancés"}
            {activeAdvancedCount > 0 && (
              <span className="mono-label text-[10px] border border-lime/50 rounded-sm px-1">
                {activeAdvancedCount}
              </span>
            )}
          </button>
          {/* Search box — searches first name + email */}
          <div className="relative flex-1 min-w-[180px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Recherche (prénom, email, ou email:nom@domain.com)"
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
                onClick={() => onSelectMember(m.id)}
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
                      {DOMAIN_LABEL[m.primaryDomain] ?? m.primaryDomain} ·{" "}
                      {LEVEL_LABEL[m.level] ?? m.level}
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
                    {new Date(m.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
              onClick={() => onBulk("approve")}
              disabled={!!bulkAction}
              className="text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
            >
              {bulkAction === "approve" ? "En cours…" : "Valider"}
            </button>
            <button
              onClick={() => onBulk("invite")}
              disabled={!!bulkAction}
              className="text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
            >
              {bulkAction === "invite" ? "En cours…" : "Inviter"}
            </button>
            <button
              onClick={() => onBulk("waitlist")}
              disabled={!!bulkAction}
              className="text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-amber-500/60 hover:text-amber-300 transition-colors focus-lime disabled:opacity-50"
            >
              {bulkAction === "waitlist" ? "En cours…" : "Waitlist"}
            </button>
            <button
              onClick={() => onBulk("reject")}
              disabled={!!bulkAction}
              className="text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-destructive/60 hover:text-destructive transition-colors focus-lime disabled:opacity-50"
            >
              {bulkAction === "reject" ? "En cours…" : "Rejeter"}
            </button>
            {!confirmBulkDelete ? (
              <button
                onClick={() => onConfirmBulkDeleteChange(true)}
                disabled={!!bulkAction}
                className="text-xs px-2.5 py-1 rounded-sm border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/15 transition-colors focus-lime disabled:opacity-50"
              >
                Supprimer
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/5 px-2 py-1">
                <span className="text-xs text-foreground">
                  Supprimer {selectedIds.size} membre(s) ?
                </span>
                <button
                  onClick={() => onBulk("delete")}
                  disabled={!!bulkAction}
                  className="text-xs px-2 py-0.5 rounded-sm bg-destructive text-white hover:bg-destructive/90 transition-colors focus-lime disabled:opacity-50"
                >
                  {bulkAction === "delete" ? "Suppression…" : "Confirmer"}
                </button>
                <button
                  onClick={() => onConfirmBulkDeleteChange(false)}
                  disabled={!!bulkAction}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-lime"
                >
                  Annuler
                </button>
              </span>
            )}
            <button
              onClick={onCancelSelection}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-lime mono-label ml-auto"
            >
              ✕ Annuler
            </button>
            {bulkResult && (
              <span
                className="w-full flex items-center justify-between gap-2 text-xs text-muted-foreground"
                role="status"
              >
                <span>{bulkResult}</span>
                <button
                  onClick={onDismissBulkResult}
                  className="text-muted-foreground hover:text-foreground transition-colors focus-lime shrink-0"
                  aria-label="Fermer le message"
                >
                  ✕
                </button>
              </span>
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
                    onChange={onToggleSelectAll}
                    className="size-3.5 accent-lime cursor-pointer"
                    aria-label="Sélectionner tout"
                  />
                </TableHead>
                <TableHead className="mono-label">
                  <SortHeader
                    label="Nom"
                    active={sortKey === "firstName"}
                    dir={sortDir}
                    onClick={() => onToggleSort("firstName")}
                  />
                </TableHead>
                <TableHead className="mono-label">Pays</TableHead>
                <TableHead className="mono-label">
                  <SortHeader
                    label="Domaine"
                    active={sortKey === "primaryDomain"}
                    dir={sortDir}
                    onClick={() => onToggleSort("primaryDomain")}
                  />
                </TableHead>
                <TableHead className="mono-label">
                  <SortHeader
                    label="Niveau"
                    active={sortKey === "level"}
                    dir={sortDir}
                    onClick={() => onToggleSort("level")}
                  />
                </TableHead>
                <TableHead className="mono-label hidden md:table-cell">Objectif</TableHead>
                <TableHead className="mono-label hidden md:table-cell">Mentorat</TableHead>
                <TableHead className="mono-label hidden lg:table-cell">Budget</TableHead>
                <TableHead className="mono-label">
                  <SortHeader
                    label="Statut"
                    active={sortKey === "profileStatus"}
                    dir={sortDir}
                    onClick={() => onToggleSort("profileStatus")}
                  />
                </TableHead>
                <TableHead className="mono-label hidden sm:table-cell">Voie</TableHead>
                <TableHead className="mono-label text-right">
                  <SortHeader
                    label="Date"
                    active={sortKey === "createdAt"}
                    dir={sortDir}
                    onClick={() => onToggleSort("createdAt")}
                    align="right"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && displayed.length === 0 && (
                <TableRow className="hover:bg-transparent border-0">
                  <TableCell colSpan={11} className="p-3">
                    <div aria-hidden className="space-y-2.5">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="admin-skeleton admin-skeleton-row"
                        />
                      ))}
                      <span className="sr-only">
                        Chargement des membres…
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {displayed.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                    Aucun membre pour ces filtres.
                  </TableCell>
                </TableRow>
              )}
              {displayed.map((m) => (
                <TableRow
                  key={m.id}
                  onClick={() => onSelectMember(m.id)}
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
                        onToggleSelect(m.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="size-3.5 accent-lime cursor-pointer"
                      aria-label={`Sélectionner ${m.firstName}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium py-3">
                    <div className="relative group/name">
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
                      <div className="absolute z-50 hidden group-hover/name:block top-full left-0 mt-1 w-56 rounded-md border border-border bg-card p-3 shadow-lg text-left pointer-events-none">
                        <p className="text-sm font-semibold text-foreground">{m.firstName} {m.lastName ?? ""}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{m.email}</p>
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{DOMAIN_LABEL[m.primaryDomain] ?? m.primaryDomain}</span>
                          <span className="text-border">·</span>
                          <span>{LEVEL_LABEL[m.level] ?? m.level}</span>
                          <span className="text-border">·</span>
                          <span>{m.profileStatus}</span>
                        </div>
                        {m.budgetRange && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Budget : {BUDGET_LABEL[m.budgetRange] ?? m.budgetRange}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-[13px] leading-5 text-muted-foreground truncate max-w-[180px] font-mono admin-num">
                      {m.email}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {countryFlag(m.country)} {countryName(m.country)}
                  </TableCell>
                  <TableCell>{DOMAIN_LABEL[m.primaryDomain] ?? m.primaryDomain}</TableCell>
                  <TableCell>{LEVEL_LABEL[m.level] ?? m.level}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {GOAL_LABEL[m.goal] ?? m.goal}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {m.mentoringInterest === "yes"
                      ? "Oui"
                      : m.mentoringInterest === "maybe"
                        ? "Peut-être"
                        : m.mentoringInterest === "no"
                          ? "Non"
                          : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {m.budgetRange ? BUDGET_LABEL[m.budgetRange] ?? m.budgetRange : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.profileStatus} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Tag active={m.accessLane === "immediate"}>
                      {m.accessLane === "immediate" ? "Immédiat" : "En traitement"}
                    </Tag>
                  </TableCell>
                  <TableCell className="text-right mono-label text-muted-foreground tabular-nums admin-num">
                    {new Date(m.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {total} membre{total > 1 ? "s" : ""} · Page {page}/{totalPages} · Clique sur
            une ligne pour voir le détail et changer le statut.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
            >
              ← Précédent
            </button>
            <span className="mono-label text-muted-foreground tabular-nums">
              {page}/{totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
            >
              Suivant →
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; tone: "lime" | "muted" | "warn" | "destructive" }
  > = {
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
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs mono-label",
        tones[s.tone],
      )}
    >
      {s.label}
    </span>
  );
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
  loading,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  loading?: boolean;
}) {
  const active = value && value !== "all";
  return (
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger
        className={cn(
          "h-9 w-auto gap-2 rounded-full px-4 text-sm min-w-32 transition-colors",
          active
            ? "border-lime/60 bg-lime/10 text-lime"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
          loading && "opacity-60",
        )}
      >
        <SelectValue placeholder={loading ? "Chargement…" : placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        <SelectItem value="all">{placeholder} · Tous</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
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
        <span className="text-[11px]" aria-hidden>
          {dir === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );
}
