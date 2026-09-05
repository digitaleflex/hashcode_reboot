"use client";

import * as React from "react";
import { Users } from "lucide-react";

/**
 * Notifies the admin of pending member approvals.
 * Shows count of members with profileStatus = "PENDING".
 * Invisible when count is zero.
 */
export function PendingApprovalsBanner({ pendingCount }: { pendingCount: number }) {
  if (pendingCount === 0) return null;

  const urgent = pendingCount > 50;
  const bgClass = urgent
    ? "border-amber-500/30 bg-amber-500/10"
    : "border-lime/30 bg-lime/5";

  return (
    <div
      className={`rounded-md border p-3 sm:p-4 flex items-center gap-3 ${bgClass}`}
      role="status"
    >
      <Users className="size-5 shrink-0 text-amber-300" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground font-medium">
          {pendingCount} nouveau{pendingCount > 1 ? "x" : ""} membre{pendingCount > 1 ? "s" : ""} en attente
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Va dans la section Membres pour examiner les profils.
        </p>
      </div>
    </div>
  );
}