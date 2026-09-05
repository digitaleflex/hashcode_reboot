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
import { StickyNote, Loader2, X, Search } from "lucide-react";
import { MemberTableSkeleton } from "./skeletons/MemberTableSkeleton";
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

const FILTER_LABELS: Record<string, Record<string, string>> = {
  domain: { web: "Web", cybersecurity: "Cyber", ai: "IA" },
  level: { beginner: "Débutant", practicing: "Pratique", autonomous: "Autonome", advanced: "Avancé" },
  status: { APPROVED: "Validé", PENDING: "En attente", WAITLIST: "Waitlist", REJECTED: "Rejeté", INVITED: "Invité" },
  lane: { immediate: "Accès immédiat", pending: "En traitement" },
  mentoring: { yes: "Mentorat oui", maybe: "Mentorat peut-être", no: "Mentorat non" },
  budget: {
    "<2500": "< 2.5k",
    "2500-5000": "2.5–5k",
    "5000-10000": "5–10k",
    "10000-20000": "10–20k",
    "20000-30000": "20–30k",
    ">30000": "> 30k",
    unknown: "NSP",
  },
};

const FILTER_KEY_LABEL: Record<string, string> = {
  domain: "Domaine",
  level: "Niveau",
  status: "Statut",
  lane: "Voie",
  mentoring: "Mentorat",
  budget: "Budget",
  country: "Pays",
};

const BULK_LIMIT = 10;

export function MemberTable({
  members,
  total,
  page,
  pageSize,
  sortKey,
  sortDir,
  filters,
  searchQuery,
  isSearching,
  recentMembers,
  selectedIds,
  bulkAction,
  bulkResult,
  bulkProgress,
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
  onPageSizeChange,
}: {
  members: MemberRow[];
  total: number;
  page: number;
  pageSize: number;
  sortKey: SortKey;
  sortDir: SortDir;
  filters: Record<string, string>;
  searchQuery: string;
  isSearching?: boolean;
  recentMembers: MemberRow[];
  selectedIds: Set<string>;
  bulkAction: string | null;
  bulkResult: string | null;
  bulkProgress?: { done: number; total: number } | null;
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
  onPageSizeChange?: (s: number) => void;
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
  const [jumpValue, setJumpValue] = React.useState("");
  const activeFilterEntries = Object.entries(filters);
  const selectedCount = selectedIds.size;
  const needsChunking = selectedCount > BULK_LIMIT;
  const isBulkError = bulkResult
    ? /^(Erreur|Échec|Trop)/i.test(bulkResult.trim())
    : false;

  // Recherche : loupe cliquable (focus du champ).
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Confirm suppression : désarme dès que la sélection change ou se vide
  // (wording unique conservé ci-dessous, pas de surprise au clic réflexe).
  const confirmRef = React.useRef(confirmBulkDelete);
  confirmRef.current = confirmBulkDelete;
  const onConfirmRef = React.useRef(onConfirmBulkDeleteChange);
  onConfirmRef.current = onConfirmBulkDeleteChange;
  const selectedSig = React.useMemo(
    () => [...selectedIds].sort().join(","),
    [selectedIds],
  );
  const prevSigRef = React.useRef(selectedSig);
  React.useEffect(() => {
    if (prevSigRef.current !== selectedSig) {
      prevSigRef.current = selectedSig;
      if (confirmRef.current) onConfirmRef.current(false);
    }
  }, [selectedSig]);

  // Initial loading — skeleton unifié, même gabarit que la table réelle.
  if (loading && displayed.length === 0 && page === 1 && !searchQuery && activeFilterEntries.length === 0) {
    return (
      <>
        <section aria-label="Filtres des membres" className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <MonoLabel className="text-muted-foreground">Filtres</MonoLabel>
          </div>
          <MemberTableSkeleton />
        </section>
      </>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <section aria-label="Filtres des membres" className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <MonoLabel className="text-muted-foreground">Filtres</MonoLabel>
          {activeFilterEntries.length > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs text-muted-foreground hover:text-lime transition-colors focus-lime mono-label min-h-[32px] px-2"
            >
              Réinitialiser ({activeFilterEntries.length})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 p-3 rounded-md border border-border/60 bg-card/40">
          <FilterSelect
            label="Domaine"
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
            label="Niveau"
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
            label="Statut"
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
          <FilterSelect
            label="Voie"
            placeholder="Voie"
            value={filters.lane ?? "all"}
            onChange={(v) => onFilter("lane", v)}
            options={[
              ["immediate", "Accès immédiat"],
              ["pending", "En traitement"],
            ]}
          />
          <FilterSelect
            label="Mentorat"
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
            label="Budget"
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
          {/* Search box — searches first name + email */}
          <div className="relative flex-1 min-w-[180px]">
            <label htmlFor="member-search" className="sr-only">
              Rechercher un membre par nom ou email
            </label>
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              aria-label="Rechercher"
              tabIndex={-1}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors focus-lime"
            >
              <Search className="size-4" aria-hidden />
            </button>
            <input
              id="member-search"
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher (nom, email)…"
              autoComplete="off"
              className="w-full h-9 rounded-md border border-border bg-card pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-lime focus:border-lime/60 [&::-webkit-search-cancel-button]:hidden"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isSearching ? (
                <Loader2 className="size-4 text-lime animate-spin" aria-hidden />
              ) : null}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  aria-label="Effacer la recherche"
                  className="size-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-lime"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </span>
            <span className="sr-only" role="status">
              {isSearching ? "Recherche en cours…" : ""}
            </span>
          </div>
        </div>

        {/* Pastilles filtres actifs */}
        {activeFilterEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Filtres actifs">
            {activeFilterEntries.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 rounded-full border border-lime/40 bg-lime/[0.06] pl-3 pr-1.5 py-1 text-xs text-foreground"
              >
                <span className="text-muted-foreground">{FILTER_KEY_LABEL[k] ?? k} :</span>
                <span className="font-medium">{FILTER_LABELS[k]?.[v] ?? v}</span>
                <button
                  type="button"
                  onClick={() => onFilter(k, "all")}
                  aria-label={`Retirer le filtre ${FILTER_KEY_LABEL[k] ?? k}`}
                  className="size-6 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-lime/10 transition-colors focus-lime"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Recent activity feed */}
      {recentMembers.length > 0 && (
        <section aria-label="Activité récente" className="mt-6">
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
                type="button"
                onClick={() => onSelectMember(m.id)}
                aria-label={`Voir ${m.firstName} ${m.lastName ?? ""}`}
                className="row-sweep w-full flex items-center gap-3 p-3.5 hover:bg-elevated/40 transition-colors text-left group min-h-[64px]"
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
                    <span className="mono-label text-muted-foreground shrink-0 hidden sm:inline">
                      {DOMAIN_LABEL[m.primaryDomain] ?? m.primaryDomain} ·{" "}
                      {LEVEL_LABEL[m.level] ?? m.level}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {m.email}
                  </div>
                </div>
                <div className="shrink-0 hidden sm:flex items-center gap-2">
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
      <section aria-label="Liste des membres" className="mt-6">
        {/* Bulk action bar — appears when rows are selected */}
        {selectedIds.size > 0 && (
          <div
            className="mb-3 rounded-md border border-lime/40 bg-lime/[0.06] p-3 flex flex-wrap items-center gap-2 animate-hash-in"
            role="region"
            aria-label="Actions groupées"
          >
            <span className="mono-label text-lime tabular-nums">
              {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""} / {BULK_LIMIT} par lot
            </span>
            {needsChunking && (
              <span className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-sm px-2 py-1">
                Traitement par lots de {BULK_LIMIT} — {Math.ceil(selectedCount / BULK_LIMIT)} lots.
              </span>
            )}
            <span className="text-border" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={() => onBulk("approve")}
              disabled={!!bulkAction}
              className="min-h-[36px] text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
            >
              {bulkAction === "approve" ? "En cours…" : "Valider"}
            </button>
            <button
              type="button"
              onClick={() => onBulk("invite")}
              disabled={!!bulkAction}
              className="min-h-[36px] text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
            >
              {bulkAction === "invite" ? "En cours…" : "Inviter"}
            </button>
            <button
              type="button"
              onClick={() => onBulk("waitlist")}
              disabled={!!bulkAction}
              className="min-h-[36px] text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-amber-500/60 hover:text-amber-300 transition-colors focus-lime disabled:opacity-50"
            >
              {bulkAction === "waitlist" ? "En cours…" : "Waitlist"}
            </button>
            <button
              type="button"
              onClick={() => onBulk("reject")}
              disabled={!!bulkAction}
              className="min-h-[36px] text-xs px-2.5 py-1 rounded-sm border border-border bg-card text-foreground hover:border-destructive/60 hover:text-destructive transition-colors focus-lime disabled:opacity-50"
            >
              {bulkAction === "reject" ? "En cours…" : "Rejeter"}
            </button>
            {!confirmBulkDelete ? (
              <button
                type="button"
                onClick={() => onConfirmBulkDeleteChange(true)}
                disabled={!!bulkAction}
                className="min-h-[36px] text-xs px-2.5 py-1 rounded-sm border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/15 transition-colors focus-lime disabled:opacity-50"
              >
                Supprimer
              </button>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/5 px-2 py-1">
                <span className="text-xs text-foreground">
                  Supprimer définitivement {selectedCount} membre{selectedCount > 1 ? "s" : ""} ?
                </span>
                <button
                  type="button"
                  onClick={() => onBulk("delete")}
                  disabled={!!bulkAction}
                  className="min-h-[32px] text-xs px-2 py-0.5 rounded-sm bg-destructive text-white hover:bg-destructive/90 transition-colors focus-lime disabled:opacity-50"
                >
                  {bulkAction === "delete" ? "Suppression…" : "Oui, supprimer"}
                </button>
                <button
                  type="button"
                  onClick={() => onConfirmBulkDeleteChange(false)}
                  disabled={!!bulkAction}
                  className="min-h-[32px] text-xs text-muted-foreground hover:text-foreground transition-colors focus-lime px-1"
                >
                  Annuler
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={onCancelSelection}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-lime mono-label ml-auto min-h-[32px] px-2"
            >
              Annuler la sélection
            </button>
            {bulkProgress && (
              <span className="w-full" role="status" aria-label={`Progression ${bulkProgress.done} sur ${bulkProgress.total}`}>
                <span className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    Lot {bulkProgress.done}/{bulkProgress.total}…
                  </span>
                  <span className="tabular-nums">
                    {Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}%
                  </span>
                </span>
                <span className="block h-1.5 rounded-full bg-secondary overflow-hidden">
                  <span
                    className="block h-full bg-lime transition-all duration-300"
                    style={{
                      width: `${(bulkProgress.done / Math.max(1, bulkProgress.total)) * 100}%`,
                    }}
                  />
                </span>
              </span>
            )}
            {bulkResult && !bulkProgress && (
              <span
                className={cn(
                  "w-full flex items-center justify-between gap-2 text-xs rounded-sm px-2.5 py-2 border",
                  isBulkError
                    ? "text-destructive border-destructive/40 bg-destructive/5"
                    : "text-lime border-lime/40 bg-lime/5",
                )}
                role="status"
              >
                <span>{bulkResult}</span>
                <button
                  type="button"
                  onClick={onDismissBulkResult}
                  className="text-muted-foreground hover:text-foreground transition-colors focus-lime shrink-0 min-h-[28px] min-w-[28px] inline-flex items-center justify-center"
                  aria-label="Fermer le message"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            )}
          </div>
        )}
        {/* Hors sélection : résultat persistant */}
        {selectedIds.size === 0 && bulkResult && !bulkProgress && (
          <div
            className={cn(
              "mb-3 flex items-center justify-between gap-2 text-xs rounded-md px-3 py-2.5 border animate-hash-in",
              isBulkError
                ? "text-destructive border-destructive/40 bg-destructive/5"
                : "text-lime border-lime/40 bg-lime/5",
            )}
            role="status"
          >
            <span>{bulkResult}</span>
            <button
              type="button"
              onClick={onDismissBulkResult}
              className="shrink-0 min-h-[28px] min-w-[28px] inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors focus-lime"
              aria-label="Fermer le message"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        )}
        <div className="rounded-md border border-border/60 bg-card/30 overflow-x-auto scroll-slim max-w-full">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/60 bg-secondary/30">
                <TableHead className="w-12 sticky left-0 z-10 bg-secondary">
                  <input
                    type="checkbox"
                    checked={members.length > 0 && selectedIds.size === members.length}
                    onChange={onToggleSelectAll}
                    className="size-5 min-h-[20px] min-w-[20px] accent-lime cursor-pointer focus-lime"
                    aria-label={
                      selectedIds.size === members.length
                        ? "Tout désélectionner"
                        : `Tout sélectionner (${members.length})`
                    }
                  />
                </TableHead>
                <TableHead className="mono-label" aria-sort={sortKey === "firstName" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <SortHeader
                    label="Nom"
                    active={sortKey === "firstName"}
                    dir={sortDir}
                    onClick={() => onToggleSort("firstName")}
                  />
                </TableHead>
                <TableHead className="mono-label">Pays</TableHead>
                <TableHead className="mono-label" aria-sort={sortKey === "primaryDomain" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <SortHeader
                    label="Domaine"
                    active={sortKey === "primaryDomain"}
                    dir={sortDir}
                    onClick={() => onToggleSort("primaryDomain")}
                  />
                </TableHead>
                <TableHead className="mono-label" aria-sort={sortKey === "level" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <SortHeader
                    label="Niveau"
                    active={sortKey === "level"}
                    dir={sortDir}
                    onClick={() => onToggleSort("level")}
                  />
                </TableHead>
                <TableHead className="mono-label">Objectif</TableHead>
                <TableHead className="mono-label">Mentorat</TableHead>
                <TableHead className="mono-label">Budget</TableHead>
                <TableHead className="mono-label" aria-sort={sortKey === "profileStatus" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <SortHeader
                    label="Statut"
                    active={sortKey === "profileStatus"}
                    dir={sortDir}
                    onClick={() => onToggleSort("profileStatus")}
                  />
                </TableHead>
                <TableHead className="mono-label">Voie</TableHead>
                <TableHead className="mono-label text-right" aria-sort={sortKey === "createdAt" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
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
              {loading && displayed.length > 0 && (
                <TableRow className="hover:bg-transparent border-0">
                  <TableCell colSpan={11} className="p-2">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                      <Loader2 className="size-3.5 animate-spin text-lime" aria-hidden />
                      Actualisation…
                    </p>
                  </TableCell>
                </TableRow>
              )}
              {displayed.length === 0 && !loading && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={11} className="text-center py-10">
                    <p className="text-sm text-foreground font-medium">Aucun membre pour ces filtres.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Essaie d’élargir la recherche ou de réinitialiser.
                    </p>
                    {(activeFilterEntries.length > 0 || searchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          onClearFilters();
                          onSearchChange("");
                        }}
                        className="mt-3 inline-flex items-center min-h-[44px] px-4 rounded-md border border-border bg-card text-sm text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime"
                      >
                        Réinitialiser filtres et recherche
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {displayed.map((m) => (
                <TableRow
                  key={m.id}
                  onClick={() => onSelectMember(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectMember(m.id);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Voir ${m.firstName} ${m.lastName ?? ""} — ${m.profileStatus}`}
                  className={cn(
                    "row-sweep cursor-pointer border-border/40 hover:bg-elevated/50 transition-colors group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime/60",
                    selectedIds.has(m.id) && "bg-lime/[0.04]",
                  )}
                >
                  <TableCell className="w-12 py-3 sticky left-0 z-10 bg-card">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleSelect(m.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="size-5 min-h-[20px] min-w-[20px] accent-lime cursor-pointer focus-lime"
                      aria-label={`Sélectionner ${m.firstName} ${m.lastName ?? ""}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground group-hover:text-lime transition-colors">
                        {m.firstName} {m.lastName ?? ""}
                      </span>
                      {m.adminNote && (
                        <span
                          className="shrink-0 inline-flex items-center justify-center size-5 rounded-sm border border-amber-500/50 bg-amber-500/10 text-amber-300"
                          title="Note interne présente"
                          aria-label="Note interne présente"
                        >
                          <StickyNote className="size-3" aria-hidden />
                        </span>
                      )}
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
                  <TableCell>
                    {GOAL_LABEL[m.goal] ?? m.goal}
                  </TableCell>
                  <TableCell>
                    {m.mentoringInterest === "yes"
                      ? "Oui"
                      : m.mentoringInterest === "maybe"
                        ? "Peut-être"
                        : m.mentoringInterest === "no"
                          ? "Non"
                          : "—"}
                  </TableCell>
                  <TableCell>
                    {m.budgetRange ? BUDGET_LABEL[m.budgetRange] ?? m.budgetRange : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.profileStatus} />
                  </TableCell>
                  <TableCell>
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {total} membre{total > 1 ? "s" : ""} · Page {page}/{totalPages} · {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""} · Clique sur
            une ligne pour voir le détail et changer le statut.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="min-h-[44px] text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
            >
              ← Précédent
            </button>
            <span className="mono-label text-muted-foreground tabular-nums">
              {page}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="min-h-[44px] text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime disabled:opacity-50"
            >
              Suivant →
            </button>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(jumpValue);
                if (Number.isFinite(n)) onPageChange(Math.floor(n));
                setJumpValue("");
              }}
            >
              <label htmlFor="page-jump" className="sr-only">
                Aller à la page
              </label>
              <input
                id="page-jump"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={`1–${totalPages}`}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                className="h-9 w-20 rounded-md border border-border bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground focus-lime text-center tabular-nums"
              />
              <button
                type="submit"
                className="min-h-[36px] text-xs px-2.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime"
              >
                Aller
              </button>
            </form>
            {onPageSizeChange && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="sr-only">Lignes par page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => onPageSizeChange(Number(v))}
                >
                  <SelectTrigger
                    aria-label="Lignes par page"
                    className="h-9 w-[96px] rounded-md text-xs"
                  >
                    <SelectValue placeholder="50 / page" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
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
    warn: "border-amber-500/50 text-amber-200 bg-amber-500/5",
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
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const active = value && value !== "all";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-9 w-auto gap-2 rounded-full px-4 text-sm min-w-32 transition-colors min-h-[36px]",
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
      type="button"
      onClick={onClick}
      aria-label={
        active
          ? `${label}, tri ${dir === "asc" ? "croissant" : "décroissant"} — inverser`
          : `${label}, trier`
      }
      className={cn(
        "inline-flex items-center gap-1 min-h-[32px] hover:text-lime transition-colors focus-lime rounded-sm px-1 -ml-1",
        active && "text-lime",
        align === "right" && "flex-row-reverse",
      )}
    >
      {label}
      <span className={cn("text-[11px]", !active && "text-muted-foreground/50")} aria-hidden>
        {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}
