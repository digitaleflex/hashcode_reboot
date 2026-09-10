"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import {
  Mail,
  MailCheck,
  MailX,
  MailWarning,
  MailOpen,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  Send,
  ExternalLink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface InvitationStats {
  total: number;
  NOT_INVITED: number;
  INVITED: number;
  ACCEPTED: number;
  REFUSED: number;
  BOUNCED: number;
  EXPIRED: number;
}

interface MemberInvitation {
  id: string;
  email: string;
  firstName: string | null;
  phone: string | null;
  country: string | null;
  level: string | null;
  primaryDomain: string | null;
  invitationStatus: string;
  invitedAt: string | null;
  invitationClicks: number;
  lastClickedAt: string | null;
  refusedAt: string | null;
  refusedReason: string | null;
  bouncedAt: string | null;
  profileStatus: string;
  communityStatus: string;
  source: string | null;
  createdAt: string;
  recentEvents: { type: string; at: string; url?: string }[];
}

interface InvitationsResponse {
  ok: boolean;
  stats: InvitationStats;
  members: MemberInvitation[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

/* ── Status config ─────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  NOT_INVITED: { label: "Non invité", color: "text-muted-foreground", bg: "bg-muted/40", icon: Clock },
  INVITED: { label: "Invité", color: "text-blue-400", bg: "bg-blue-500/10", icon: Mail },
  ACCEPTED: { label: "Accepté", color: "text-lime", bg: "bg-lime/10", icon: MailCheck },
  REFUSED: { label: "Refusé", color: "text-red-400", bg: "bg-red-500/10", icon: MailX },
  BOUNCED: { label: "Bounce", color: "text-orange-400", bg: "bg-orange-500/10", icon: MailWarning },
  EXPIRED: { label: "Expiré", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: Clock },
};

const STATUS_FILTERS = ["ALL", "INVITED", "ACCEPTED", "REFUSED", "BOUNCED", "NOT_INVITED"] as const;

/* ── Stat Card ─────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors text-center min-w-[80px]",
        active
          ? "border-lime/40 bg-lime/5"
          : "border-border/40 bg-card hover:bg-lime/5 hover:border-lime/20",
        onClick && "cursor-pointer",
      )}
    >
      <Icon className={cn("size-5", color)} />
      <span className="text-2xl font-bold tracking-tight">{value}</span>
      <span className="mono-label text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}

/* ── Member Row ────────────────────────────────────────────────────────── */

function MemberRow({
  member,
  onRelance,
}: {
  member: MemberInvitation;
  onRelance: (ids: string[]) => void;
}) {
  const cfg = STATUS_CONFIG[member.invitationStatus] || STATUS_CONFIG.NOT_INVITED;
  const StatusIcon = cfg.icon;
  const lastEvent = member.recentEvents[0];

  return (
    <tr className="border-b border-border/30 hover:bg-lime/5 transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex flex-col">
          <span className="font-medium text-sm">{member.firstName || "—"}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{member.email}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 hidden sm:table-cell">
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
          <StatusIcon className="size-3" />
          {cfg.label}
        </span>
      </td>
      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
        {member.level || "—"} · {member.primaryDomain || "—"}
      </td>
      <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
        {member.country || "—"}
      </td>
      <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-center">
        {member.invitationClicks > 0 ? (
          <span className="text-lime font-medium">{member.invitationClicks}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-3 py-2.5 hidden xl:table-cell text-xs text-muted-foreground">
        {lastEvent ? (
          <div className="flex flex-col">
            <span>{lastEvent.type === "email.opened" ? "📧 Ouvert" : "🔗 Clic"}</span>
            <span>{new Date(lastEvent.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
          </div>
        ) : member.lastClickedAt ? (
          <span>{new Date(member.lastClickedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        {member.invitationStatus === "INVITED" && member.invitationClicks === 0 && (
          <button
            type="button"
            onClick={() => onRelance([member.id])}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            title="Relancer cette invitation"
          >
            <Send className="size-3.5 inline" />
          </button>
        )}
      </td>
    </tr>
  );
}

/* ── Relance Dialog ────────────────────────────────────────────────────── */

function RelanceDialog({
  open,
  onClose,
  onConfirm,
  count,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-card border border-border/60 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2">{`Relancer ${count} invitation${count > 1 ? "s" : ""} ?`}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Un email de relance sera envoyé aux membres qui n'ont pas encore cliqué sur leur invitation.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-1.5 text-sm font-medium bg-lime text-black rounded-lg hover:bg-lime/90 disabled:opacity-50"
          >
            {loading ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function AdminInvitationsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = React.useState<InvitationsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [relanceOpen, setRelanceOpen] = React.useState(false);
  const [relanceLoading, setRelanceLoading] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const handleSessionExpired = React.useCallback(() => {
    router.push("/?admin=1");
  }, [router]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", "50");

      const { res, data, error, code } = await fetchJson(
        `/api/admin/invitations?${params.toString()}`,
      );

      if (res.status === 401 || code === "UNAUTHORIZED") {
        handleSessionExpired();
        return;
      }
      if (!res.ok || !data?.ok) {
        toast({ title: "Erreur", description: error || "Chargement échoué.", variant: "destructive" });
        return;
      }
      setData(data);
    } catch {
      toast({ title: "Erreur réseau", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, handleSessionExpired, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRelance = React.useCallback(
    async (ids: string[]) => {
      setRelanceLoading(true);
      try {
        const { res, data: d, error, code, retryAfterSec } = await fetchJson(
          "/api/invite/relance",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberIds: ids, confirm: true }),
          },
        );
        if (res.status === 401 || code === "UNAUTHORIZED") {
          handleSessionExpired();
          return;
        }
        if (!res.ok || !d?.ok) {
          toast({
            title: "Erreur relance",
            description: res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(error ?? "Trop de demandes.", retryAfterSec) : error || "Échec.",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Relance envoyée", description: `${d.sent} email(s) envoyé(s).` });
        setRelanceOpen(false);
        setSelectedIds(new Set());
        fetchData();
      } catch {
        toast({ title: "Erreur réseau", variant: "destructive" });
      } finally {
        setRelanceLoading(false);
      }
    },
    [fetchData, handleSessionExpired, toast],
  );

  const stats = data?.stats;
  const members = data?.members || [];
  const pagination = data?.pagination;

  // Filtrage côté client pour la recherche
  const filtered = React.useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.email.toLowerCase().includes(q) ||
        (m.firstName || "").toLowerCase().includes(q) ||
        (m.phone || "").includes(q),
    );
  }, [members, search]);

  // IDs à relancer : tous les INVITED non cliqués visibles
  const relanceableIds = React.useMemo(
    () =>
      filtered
        .filter((m) => m.invitationStatus === "INVITED" && m.invitationClicks === 0)
        .map((m) => m.id),
    [filtered],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invitations</h1>
          <p className="text-sm text-muted-foreground">
            Gestion des invitations et suivi des clics
          </p>
        </div>
        {relanceableIds.length > 0 && (
          <button
            type="button"
            onClick={() => setRelanceOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-lime text-black font-medium text-sm rounded-lg hover:bg-lime/90 transition-colors"
          >
            <Send className="size-4" />
            Relancer ({relanceableIds.length})
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <StatCard label="Total" value={stats.total} icon={Mail} color="text-foreground" active={statusFilter === "ALL"} onClick={() => { setStatusFilter("ALL"); setPage(1); }} />
          <StatCard label="Invités" value={stats.INVITED} icon={Mail} color="text-blue-400" active={statusFilter === "INVITED"} onClick={() => { setStatusFilter("INVITED"); setPage(1); }} />
          <StatCard label="Acceptés" value={stats.ACCEPTED} icon={MailCheck} color="text-lime" active={statusFilter === "ACCEPTED"} onClick={() => { setStatusFilter("ACCEPTED"); setPage(1); }} />
          <StatCard label="Refusés" value={stats.REFUSED} icon={MailX} color="text-red-400" active={statusFilter === "REFUSED"} onClick={() => { setStatusFilter("REFUSED"); setPage(1); }} />
          <StatCard label="Bounces" value={stats.BOUNCED} icon={MailWarning} color="text-orange-400" active={statusFilter === "BOUNCED"} onClick={() => { setStatusFilter("BOUNCED"); setPage(1); }} />
          <StatCard label="Non invités" value={stats.NOT_INVITED} icon={Clock} color="text-muted-foreground" active={statusFilter === "NOT_INVITED"} onClick={() => { setStatusFilter("NOT_INVITED"); setPage(1); }} />
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher par nom, email, téléphone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-card border border-border/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lime/40 placeholder:text-muted-foreground"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-border/40 rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left">
                <th className="px-3 py-2.5 mono-label text-[10px] text-muted-foreground font-medium">MEMBRE</th>
                <th className="px-3 py-2.5 mono-label text-[10px] text-muted-foreground font-medium hidden sm:table-cell">STATUT</th>
                <th className="px-3 py-2.5 mono-label text-[10px] text-muted-foreground font-medium hidden md:table-cell">NIVEAU / DOMAINE</th>
                <th className="px-3 py-2.5 mono-label text-[10px] text-muted-foreground font-medium hidden lg:table-cell">PAYS</th>
                <th className="px-3 py-2.5 mono-label text-[10px] text-muted-foreground font-medium hidden lg:table-cell text-center">CLICS</th>
                <th className="px-3 py-2.5 mono-label text-[10px] text-muted-foreground font-medium hidden xl:table-cell">DERNIER EVENT</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                    Aucun membre trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onRelance={(ids) => {
                      setSelectedIds(new Set(ids));
                      setRelanceOpen(true);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {pagination.total} résultat(s) · page {pagination.page}/{pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded border border-border/40 text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-1.5 rounded border border-border/40 text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Relance Dialog */}
      <RelanceDialog
        open={relanceOpen}
        onClose={() => { setRelanceOpen(false); setSelectedIds(new Set()); }}
        onConfirm={() => handleRelance(selectedIds.size > 0 ? Array.from(selectedIds) : relanceableIds)}
        count={selectedIds.size > 0 ? selectedIds.size : relanceableIds.length}
        loading={relanceLoading}
      />
    </div>
  );
}
