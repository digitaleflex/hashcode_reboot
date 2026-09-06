"use client";

import * as React from "react";
import { useMembers } from "@/components/reboot/admin/hooks/useMembers";
import { MemberTable } from "@/components/reboot/admin/MemberTable";
import { MemberDetailDialog } from "@/components/reboot/admin/MemberDetailDialog";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function AdminMembersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [bulkAction, setBulkAction] = React.useState<string | null>(null);
  const [bulkResult, setBulkResult] = React.useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSessionExpired = React.useCallback(() => {
    router.push("/?admin=1");
  }, [router]);

  const {
    members, total, page, pageSize, setPage,
    filters, setFilters, setFilter,
    searchQuery, setSearchQuery, debouncedSearchQuery,
    sortKey, sortDir, toggleSort,
    selectedIds, setSelectedIds, toggleSelect, toggleSelectAll,
    recentMembers, loading, refreshMembers, serverSorted,
  } = useMembers({ onSessionExpired: handleSessionExpired });

  const runBulk = React.useCallback(
    async (action: "approve" | "invite" | "waitlist" | "reject" | "delete") => {
      if (selectedIds.size === 0) return;
      if (action === "delete" && !confirmBulkDelete) {
        setConfirmBulkDelete(true);
        return;
      }
      setBulkAction(action);
      setBulkResult(null);
      try {
        const { res, data, error, code, retryAfterSec } = await fetchJson(
          "/api/members/bulk",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(selectedIds), action }),
          },
        );
        if (res.status === 401 || code === "UNAUTHORIZED") {
          handleSessionExpired();
          return;
        }
        if (!res.ok || !data?.ok) {
          const base = error ?? "Échec de l'action bulk.";
          setBulkResult(
            `Erreur: ${res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(base, retryAfterSec) : base}`,
          );
          return;
        }
        const affected = (data.affected as number) ?? 0;
        const partial = (data.partial as boolean) ?? false;
        const missing = (data.missing as number) ?? 0;
        setBulkResult(
          partial
            ? `${affected} membre(s) — action "${action}" partielle (${missing} introuvable(s)).`
            : `${affected} membre(s) — action "${action}" appliquée`,
        );
        toast({
          title: `${affected} membre(s) traité(s)`,
          description: `Action « ${action} » appliquée avec succès.`,
        });
        setConfirmBulkDelete(false);
        await refreshMembers();
      } catch (e) {
        if (isAbortError(e)) return;
        setBulkResult("Échec de l'action bulk.");
      } finally {
        setBulkAction(null);
      }
    },
    [selectedIds, confirmBulkDelete, handleSessionExpired, refreshMembers, toast],
  );

  const deleteMember = React.useCallback(
    async (id: string) => {
      try {
        const { res, error, code, retryAfterSec } = await fetchJson(`/api/members/${id}`, {
          method: "DELETE",
        });
        if (res.status === 401 || code === "UNAUTHORIZED") {
          handleSessionExpired();
          return;
        }
        if (!res.ok) {
          const base = error ?? "Échec de la suppression.";
          toast({
            title: "Erreur",
            description:
              res.status === 429 || code === "RATE_LIMITED"
                ? withRetryAfter(base, retryAfterSec)
                : base,
            variant: "destructive",
          });
          return;
        }
        setSelectedId(null);
        await refreshMembers();
      } catch (e) {
        if (isAbortError(e)) return;
        toast({ title: "Erreur", description: "Échec de la suppression.", variant: "destructive" });
      }
    },
    [handleSessionExpired, refreshMembers],
  );

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4 animate-hash-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
          <button
            onClick={() => {
              setError(null);
              void refreshMembers();
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
          >
            Réessayer
          </button>
        </div>
      )}

      <section aria-label="Membres">
        <MemberTable
          members={members}
          total={total}
          page={page}
          pageSize={pageSize}
          sortKey={sortKey}
          sortDir={sortDir}
          filters={filters}
          searchQuery={searchQuery}
          recentMembers={recentMembers}
          selectedIds={selectedIds}
          bulkAction={bulkAction}
          bulkResult={bulkResult}
          confirmBulkDelete={confirmBulkDelete}
          loading={loading}
          serverSorted={serverSorted}
          onToggleSort={toggleSort}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onFilter={setFilter}
          onClearFilters={() => setFilters({})}
          onSearchChange={setSearchQuery}
          onSelectMember={setSelectedId}
          onBulk={(a) => void runBulk(a)}
          onCancelSelection={() => {
            setSelectedIds(new Set());
            setConfirmBulkDelete(false);
          }}
          onDismissBulkResult={() => setBulkResult(null)}
          onConfirmBulkDeleteChange={setConfirmBulkDelete}
          onPageChange={setPage}
        />
      </section>

      <MemberDetailDialog
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={() => void refreshMembers()}
        onDelete={deleteMember}
        onSessionExpired={handleSessionExpired}
      />
    </div>
  );
}
