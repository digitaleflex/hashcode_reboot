"use client";

import * as React from "react";
import { useMembers } from "@/components/reboot/admin/hooks/useMembers";
import { MemberTable } from "@/components/reboot/admin/MemberTable";
import { MemberDetailDialog } from "@/components/reboot/admin/MemberDetailDialog";
import { adminErrorMessage, adminRequest } from "@/components/reboot/admin/lib/adminQuery";
import { isAbortError } from "@/components/reboot/admin/lib/fetchJson";
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

  const {
    members, total, page, pageSize, setPage,
    filters, setFilters, setFilter,
    searchQuery, setSearchQuery, debouncedSearchQuery,
    sortKey, sortDir, toggleSort,
    selectedIds, setSelectedIds, toggleSelect, toggleSelectAll,
    recentMembers, loading, refreshMembers, serverSorted,
    loadError,
  } = useMembers();

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
        // D25 : 401 redirige, 403/429 remontent en `AdminRequestError`.
        const data = await adminRequest<Record<string, unknown>>(
          "/api/members/bulk",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(selectedIds), action }),
          },
          { fallbackMessage: t("bulkErrorBase") },
        );
        if (!data?.ok) {
          setBulkResult(t("bulkErrorPrefix", { detail: t("bulkErrorBase") }));
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
        setBulkResult(t("bulkErrorPrefix", { detail: adminErrorMessage(e, t("bulkErrorBase")) }));
      } finally {
        setBulkAction(null);
      }
    },
    [selectedIds, confirmBulkDelete, refreshMembers, toast, t, setSelectedIds],
  );

  const deleteMember = React.useCallback(
    async (id: string) => {
      try {
        await adminRequest(`/api/members/${id}`, { method: "DELETE" }, {
          fallbackMessage: t("deleteErrorBase"),
        });
        setSelectedId(null);
        await refreshMembers();
      } catch (e) {
        if (isAbortError(e)) return;
        toast({
          title: t("toastErrorTitle"),
          description: adminErrorMessage(e, t("deleteErrorBase")),
          variant: "destructive",
        });
      }
    },
    [refreshMembers, toast, t],
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
        <ImportInvitePanel />
      </section>

      <MemberDetailDialog
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={() => void refreshMembers()}
        onDelete={deleteMember}
      />
    </div>
  );
}