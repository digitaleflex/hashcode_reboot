"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../lib/fetchJson";

export interface StatsData {
  totals: {
    total: number;
    approved: number;
    pending: number;
    waitlist: number;
    rejected: number;
  };
  domains: {
    web: number;
    cyber: number;
    ai: number;
  };
  mentoring: number;
  byCountry: Array<{ country: string; count: number }>;
  byLevel: Array<{ level: string; count: number }>;
  byAvailability: Array<{ availability: string; count: number }>;
  byBudget: Array<{ budget: string; count: number }>;
  byArchetype: Array<{ archetype: string; count: number }>;
}

export interface StatsWithCompare {
  current: StatsData;
  previous?: StatsData;
  change?: {
    totalPct: number;
    approvedPct: number;
    pendingPct: number;
    waitlistPct: number;
    rejectedPct: number;
  };
}

export function useStats({
  compare = false,
  period = "month",
  onSessionExpired,
}: {
  compare?: boolean;
  period?: "week" | "month";
  onSessionExpired: () => void;
}) {
  return useQuery({
    queryKey: ["admin", "stats", { compare, period }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (compare) {
        params.set("compare", "true");
        params.set("period", period);
      }
      const url = `/api/stats${params.toString() ? `?${params.toString()}` : ""}`;
      const { res, data, code } = await fetchJson(url, { cache: "no-store" });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        throw new Error("unauthorized");
      }
      if (!res.ok) {
        throw new Error("Erreur de chargement des stats.");
      }
      // When compare=true, the API returns { current, previous, change }
      // When compare=false, the API returns the flat stats shape
      if (compare) {
        return data as StatsWithCompare;
      }
      return data as StatsData;
    },
    staleTime: 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}