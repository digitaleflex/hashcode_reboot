"use client";

import * as React from "react";
import { useMembers } from "@/components/reboot/admin/hooks/useMembers";
import { MemberTable } from "@/components/reboot/admin/MemberTable";
import { MemberDetailDialog } from "@/components/reboot/admin/MemberDetailDialog";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ImportInvitePanel } from "./ImportInvitePanel";
import { useTranslations } from "next-intl";

export default function AdminMembersPage() {
  const t = useTranslations("admin.members.page");
  const router = useRouter();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [bulkAction, setBulkAction] = React.useState<string | null>(null);
  const [bulkResult, setBulkResult] = React.useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);

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
    loadError,
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
          const base = error ?? t("bulkErrorBase");
          setBulkResult(
            res.status === 429 || code === "RATE_LIMITED"
              ? t("bulkErrorPrefix", { detail: withRetryAfter(base, retryAfterSec) })
              : t("bulkErrorPrefix", { detail: base }),
          );
          return;
        }
        const affected = (data.affected as number) ?? 0;
        const partial = (data.partial as boolean) ?? false;
        const missing = (data.missing as number) ?? 0;
        setBulkResult(
          partial
            ? t("bulkPartial", { affected, action, missing })
            : t("bulkApplied", { affected, action }),
        );
        toast({
          title: t("bulkToastTitle", { affected }),
          description: t("bulkToastDescription", { action }),
        });
        setConfirmBulkDelete(false);
        setSelectedIds(new Set());
        await refreshMembers();
      } catch (e) {
        if (isAbortError(e)) return;
        setBulkResult(t("bulkErrorBase"));
      } finally {
        setBulkAction(null);
      }
    },
    [selectedIds, confirmBulkDelete, handleSessionExpired, refreshMembers, toast, t],
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
          const base = error ?? t("deleteErrorBase");
          toast({
            title: t("toastErrorTitle"),
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
        toast({ title: t("toastErrorTitle"), description: t("deleteErrorBase"), variant: "destructive" });
      }
    },
    [handleSessionExpired, refreshMembers, toast, t],
  );

  return (
    <div className="space-y-8">
      {loadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4 animate-hash-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0" />
            <p className="text-sm text-foreground">{loadError}</p>
          </div>
          <button
            onClick={() => void refreshMembers()}
            className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
          >
            {t("retry")}
          </button>
        </div>
      )}

      <section aria-label={t("sections.members")}>
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

      <section aria-label={t("sections.inviteFormer")}>
        <ImportInvitePanel onSessionExpired={handleSessionExpired} />
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