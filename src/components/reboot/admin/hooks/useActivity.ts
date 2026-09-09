"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson, withRetryAfter } from "../lib/fetchJson";

export interface ActivityMember {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  profileStatus: string;
  country: string;
  city: string | null;
}

export interface ActivityEvent {
  id: string;
  type: string;
  sessionId: string | null;
  memberId: string | null;
  member: ActivityMember | null;
  ref: string | null;
  value: number | null;
  createdAt: string;
}

export function useActivity({
  limit = 12,
  onSessionExpired,
}: {
  limit?: number;
  onSessionExpired: () => void;
}) {
  return useQuery({
    queryKey: ["admin", "activity", { limit }],
    queryFn: async () => {
       const { res, data, code, error, retryAfterSec } = await fetchJson(
         `/api/admin/activity?limit=${limit}`,
         { cache: "no-store" },
       );
       if (res.status === 401 || code === "UNAUTHORIZED") {
         onSessionExpired();
         throw new Error("unauthorized");
       }
       if (!res.ok) {
         const msg = error ?? "Erreur de chargement de l'activité.";
         throw new Error(
           res.status === 429 || code === "RATE_LIMITED"
             ? withRetryAfter(msg, retryAfterSec)
             : msg,
         );
       }
      return (data?.events ?? []) as ActivityEvent[];
    },
    staleTime: 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}