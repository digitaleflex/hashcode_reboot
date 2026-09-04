"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "../lib/fetchJson";

export interface MemberRow {
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

export type SortKey =
  | "createdAt"
  | "firstName"
  | "primaryDomain"
  | "level"
  | "profileStatus";
export type SortDir = "asc" | "desc";

const VALID_SORT_KEYS: SortKey[] = [
  "createdAt",
  "firstName",
  "primaryDomain",
  "level",
  "profileStatus",
];
const FILTER_KEYS = [
  "domain",
  "country",
  "level",
  "mentoring",
  "budget",
  "status",
  "lane",
] as const;

function readInitialUrl(): {
  filters: Record<string, string>;
  search: string;
  sortKey: SortKey;
  sortDir: SortDir;
  page: number;
  pageSize: number;
} {
  const fallback = {
    filters: {} as Record<string, string>,
    search: "",
    sortKey: "createdAt" as SortKey,
    sortDir: "desc" as SortDir,
    page: 1,
    pageSize: 50,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const sp = new URLSearchParams(window.location.search);
    const filters: Record<string, string> = {};
    for (const k of FILTER_KEYS) {
      const v = sp.get(k);
      if (v) filters[k] = v;
    }
    const q = sp.get("q") ?? "";
    const rawSort = sp.get("sortKey") ?? sp.get("sort") ?? "createdAt";
    const sortKey = (VALID_SORT_KEYS as string[]).includes(rawSort)
      ? (rawSort as SortKey)
      : ("createdAt" as SortKey);
    const rawDir = sp.get("sortDir") ?? sp.get("dir") ?? "desc";
    const sortDir: SortDir = rawDir === "asc" ? "asc" : "desc";
    const rawPage = Number(sp.get("page") ?? "1");
    const page =
      Number.isFinite(rawPage) && rawPage >= 1
        ? Math.floor(rawPage)
        : 1;
    const rawSize = Number(sp.get("pageSize") ?? "50");
    const pageSize =
      Number.isFinite(rawSize) && rawSize >= 1
        ? Math.min(Math.max(Math.floor(rawSize), 1), 200)
        : 50;
    return { filters, search: q, sortKey, sortDir, page, pageSize };
  } catch {
    return fallback;
  }
}

function sortClientSide(
  list: MemberRow[],
  sortKey: SortKey,
  sortDir: SortDir,
): MemberRow[] {
  const sorted = [...list];
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
}

export function useMembers({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const initial = React.useMemo(readInitialUrl, []);
  const [filters, setFilters] = React.useState<Record<string, string>>(initial.filters);
  const [searchQuery, setSearchQuery] = React.useState(initial.search);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState(
    initial.search,
  );
  const [sortKey, setSortKey] = React.useState<SortKey>(initial.sortKey);
  const [sortDir, setSortDir] = React.useState<SortDir>(initial.sortDir);
  const [page, setPageState] = React.useState(initial.page);
  const [pageSize, setPageSizeState] = React.useState(initial.pageSize);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // Debounce recherche 300ms avec cleanup (conservé Phase 2).
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Persistance URL sans useSearchParams (éviter Suspense) : replaceState.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      // Nettoie nos clés puis réécrit.
      for (const k of [
        ...FILTER_KEYS,
        "q",
        "sortKey",
        "sortDir",
        "page",
        "pageSize",
      ]) {
        sp.delete(k);
      }
      for (const [k, v] of Object.entries(filters)) {
        if (v) sp.set(k, v);
      }
      if (debouncedSearchQuery.trim())
        sp.set("q", debouncedSearchQuery.trim());
      sp.set("sortKey", sortKey);
      sp.set("sortDir", sortDir);
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      const qs = sp.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`,
      );
    } catch {
      /* ignore */
    }
  }, [filters, debouncedSearchQuery, sortKey, sortDir, page, pageSize]);

  // Query clé : include tous les filtres pertinents pour invalider correctement.
  const queryKey = React.useMemo(() => ["members", filters, debouncedSearchQuery, page, pageSize, sortKey, sortDir], [filters, debouncedSearchQuery, page, pageSize, sortKey, sortDir]);

  const { data: queryData, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      if (debouncedSearchQuery.trim()) params.set("q", debouncedSearchQuery.trim());
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("sortKey", sortKey);
      params.set("sortDir", sortDir);
      const { res, data, error, code, retryAfterSec } = await fetchJson(
        `/api/members?${params.toString()}`, { cache: "no-store" },
      );
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        throw new Error("unauthorized");
      }
      if (!res.ok) {
        const msg = error ?? "Erreur de chargement des membres.";
        throw new Error(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(msg, retryAfterSec)
            : msg,
        );
      }
      return data;
    },
    staleTime: 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Traiter les données de la query : adapter au format attendu par l'UI (paginé ou legacy).
  const rawList = ((queryData?.members ?? []) as MemberRow[]);
  const serverSorted = typeof queryData?.total === "number";

  const members = serverSorted ? rawList : sortClientSide(rawList, sortKey, sortDir);
  const total = serverSorted ? (queryData?.total as number) : members.length;
  const recentMembers = (queryData?.members ?? []).slice(0, 5) as MemberRow[];

  // Synchroniser la page côté serveur si le backend fournit une page.
  React.useEffect(() => {
    if (serverSorted && queryData?.page && queryData.page !== page) {
      setPageState(queryData.page as number);
    }
  }, [serverSorted, queryData?.page, page, setPageState]);

  // Sélection: intersecter avec les ids présents dans les données chargées.
  React.useEffect(() => {
    const alive = new Set(members.map((m) => m.id));
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (alive.has(id)) next.add(id);
        else changed = true;
      }
      return changed || next.size !== prev.size ? next : prev;
    });
  }, [members]);

  // Mutation pour rafraîchir les données (similaire à l'ancien refreshMembers).
  const refreshMembersMutation = useMutation({
    mutationFn: async () => {
      await refetch();
    },
    onSuccess: () => {
      // Requête déjà rafraîchie par refetch.
    },
    onError: () => {
      // Erreur déjà capturée par useQuery.
    },
  });

  function setFilter(key: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev };
      if (!value || value === "all") delete next[key];
      else next[key] = value;
      return next;
    });
    setPageState(1);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPageState(1);
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

  function setPage(p: number) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    setPageState(Math.min(Math.max(1, Math.floor(p) || 1), totalPages));
  }

  function setPageSize(s: number) {
    const v = Math.min(Math.max(Math.floor(s) || 50, 1), 200);
    setPageSizeState(v);
    setPageState(1);
  }

  async function refreshMembers() {
    await refreshMembersMutation.mutateAsync();
  }

  return {
    members,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    filters,
    setFilters: (v: Record<string, string>) => {
      setFilters(v);
      setPageState(1);
    },
    setFilter,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    sortKey,
    sortDir,
    toggleSort,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll,
    loading: isLoading,
    loadError: isError ? (error?.message ?? "Erreur de chargement des données.") : null,
    setLoadError: () => {}, // Remplacé par la gestion d'erreur TanStack
    loadMembers: refetch,
    refreshMembers,
    recentMembers,
    serverSorted,
  };
}
