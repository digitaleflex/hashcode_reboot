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
  Filter,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Hourglass,
  RefreshCw,
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
  { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  NOT_INVITED: { label: "Non invité", color: "text-muted-foreground", bg: "bg-muted/40", icon: Hourglass, description: "Membres n'ayant jamais reçu d'invitation" },
  INVITED: { label: "Invité", color: "text-blue-400", bg: "bg-blue-500/10", icon: Mail, description: "Invitation envoyée, en attente de clic" },
  ACCEPTED: { label: "Accepté", color: "text-lime", bg: "bg-lime/10", icon: CheckCircle, description: "A cliqué et rejoint la communauté" },
  REFUSED: { label: "Refusé", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle, description: "A explicitement refusé l'invitation" },
  BOUNCED: { label: "Bounce", color: "text-orange-400", bg: "bg-orange-500/10", icon: AlertTriangle, description: "Email non délivré (adresse invalide)" },
  EXPIRED: { label: "Expiré", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: Clock, description: "Lien d'invitation expiré (72h)" },
};

const STATUS_ORDER = ["INVITED", "ACCEPTED", "REFUSED", "BOUNCED", "EXPIRED", "NOT_INVITED"] as const;
const STATUS_FILTERS = ["ALL", ...STATUS_ORDER] as const;

type StatusFilter = typeof STATUS_FILTERS[number];

/* ── Components ────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
  description,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  active?: boolean;
  onClick?: () => void;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all text-center min-w-[90px] relative overflow-hidden",
        active
          ? "border-lime/40 bg-lime/5 shadow-[0_0_0_1px_rgba(197,244,65,0.3)]"
          : "border-border/40 bg-card hover:bg-lime/5 hover:border-lime/20",
        onClick && "cursor-pointer",
      )}
      title={description}
    >
      <div className="relative">
        <Icon className={cn("size-5", color)} />
        {active && (
          <span className="absolute -top-1 -right-1 size-2 bg-lime rounded-full border-2 border-card" />
        )}
      </div>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
      <span className="mono-label text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NOT_INVITED;
  const StatusIcon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
      <StatusIcon className="size-3" />
      {cfg.label}
    </span>
  );
}

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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const getDomainLabel = (domain: string | null) => {
    const labels: Record<string, string> = { web: "Web", cybersecurity: "Cyber", ai: "IA" };
    return labels[domain || ""] || domain || "—";
  };

  const getLevelLabel = (level: string | null) => {
    const labels: Record<string, string> = { beginner: "Débutant", practicing: "Pratiquant", autonomous: "Autonome", advanced: "Expert" };
    return labels[level || ""] || level || "—";
  };

  return (
    <tr className="border-b border-border/30 hover:bg-lime/5 transition-colors data-[status=invited]:bg-blue-500/5">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-lime/10 flex items-center justify-center text-lime font-medium text-sm">
            {(member.firstName?.[0] || member.email[0]).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-sm truncate max-w-[200px]">{member.firstName || "—"}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[250px]">{member.email}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={member.invitationStatus} />
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium">{getLevelLabel(member.level)}</span>
          <span className="text-xs text-muted-foreground">{getDomainLabel(member.primaryDomain)}</span>
        </div>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
        {member.country || "—"}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-center">
        <div className="flex items-center justify-center gap-1">
          {member.invitationClicks > 0 ? (
            <>
              <MailOpen className="size-3.5 text-lime" />
              <span className="text-lime font-medium">{member.invitationClicks}</span>
            </>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
        {lastEvent ? (
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1">
              {lastEvent.type === "email.opened" ? (
                <MailOpen className="size-3 text-blue-400" />
              ) : (
                <ExternalLink className="size-3 text-lime" />
              )}
              {lastEvent.type === "email.opened" ? "Ouvert" : "Clic"}
            </span>
            <span>{formatDate(lastEvent.at)}</span>
          </div>
        ) : member.lastClickedAt ? (
          <span>{formatDate(member.lastClickedAt)}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {member.invitationStatus === "INVITED" && member.invitationClicks === 0 && (
          <button
            type="button"
            onClick={() => onRelance([member.id])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors"
            title="Relancer cette invitation"
          >
            <RefreshCw className="size-3.5" />
            Relancer
          </button>
        )}
        {member.invitationStatus === "INVITED" && member.invitationClicks > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-lime bg-lime/10 rounded-lg">
            <CheckCircle className="size-3" />
            Engagé
          </span>
        )}
      </td>
    </tr>
  );
}

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
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center">
            <Send className="size-5 text-lime" />
          </div>
          <h3 className="text-lg font-bold">{`Relancer ${count} invitation${count > 1 ? "s" : ""} ?`}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Un email de relance sera envoyé aux membres qui n'ont pas encore cliqué sur leur invitation.
          {count > 1 && " Chaque membre recevra un nouveau lien magique valide 72h."}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium bg-lime text-black rounded-lg hover:bg-lime/90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Envoyer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ status, onClearFilter }: { status: StatusFilter; onClearFilter: () => void }) {
  const configs: Record<StatusFilter, { icon: React.ComponentType<{ className?: string }>; title: string; description: string }> = {
    ALL: { icon: Users, title: "Aucun membre", description: "Aucun membre ne correspond à vos critères." },
    INVITED: { icon: Mail, title: "Aucune invitation en cours", description: "Les invitations envoyées apparaîtront ici." },
    ACCEPTED: { icon: CheckCircle, title: "Aucun membre accepté", description: "Les membres ayant rejoint apparaîtront ici." },
    REFUSED: { icon: XCircle, title: "Aucun refus", description: "Les refus d'invitation apparaîtront ici." },
    BOUNCED: { icon: AlertTriangle, title: "Aucun bounce", description: "Les emails non délivrés apparaîtront ici." },
    EXPIRED: { icon: Hourglass, title: "Aucune invitation expirée", description: "Les invitations expirées apparaîtront ici." },
    NOT_INVITED: { icon: Users, title: "Aucun membre non invité", description: "Tous les membres ont été invités." },
  };

  const cfg = configs[status] || configs.ALL;
  const Icon = cfg.icon;

  return (
    <div className="py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">{cfg.title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">{cfg.description}</p>
      {status !== "ALL" && (
        <button
          type="button"
          onClick={onClearFilter}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-lime hover:text-lime/80 transition-colors"
        >
          <Filter className="size-4" />
          Voir tout
        </button>
      )}
    </div>
  );
}

function StatusTabs({ active, onChange, stats }: { active: StatusFilter; onChange: (s: StatusFilter) => void; stats: InvitationStats }) {
  return (
    <div className="flex flex-wrap gap-1 bg-muted/30 p-1 rounded-xl">
      {STATUS_FILTERS.map((status) => {
        const cfg = STATUS_CONFIG[status] || { label: status, color: "text-muted-foreground", bg: "bg-transparent", icon: Users };
        const Icon = cfg.icon;
        const count = stats[status as keyof InvitationStats] || 0;
        const isActive = active === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50",
            )}
            title={cfg.description}
          >
            <Icon className={cn("size-3.5", isActive ? cfg.color : "text-muted-foreground")} />
            <span>{cfg.label}</span>
            <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-mono", isActive ? "bg-lime text-black" : "bg-muted text-muted-foreground")}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function AdminInvitationsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = React.useState<InvitationsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [relanceOpen, setRelanceOpen] = React.useState(false);
  const [relanceLoading, setRelanceLoading] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: "asc" | "desc" }>({ key: "createdAt", direction: "desc" });

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

  // Tri côté client
  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof MemberInvitation];
      const bVal = b[sortConfig.key as keyof MemberInvitation];

      // Skip sorting for non-sortable fields (arrays, objects)
      if (Array.isArray(aVal) || Array.isArray(bVal) || typeof aVal === "object" || typeof bVal === "object") {
        return 0;
      }

      let aComparable: string | number = aVal as string | number || "";
      let bComparable: string | number = bVal as string | number || "";

      if (sortConfig.key === "createdAt" || sortConfig.key === "invitedAt" || sortConfig.key === "lastClickedAt") {
        aComparable = aComparable ? new Date(aComparable as string).getTime() : 0;
        bComparable = bComparable ? new Date(bComparable as string).getTime() : 0;
      }

      if (aComparable < bComparable) return sortConfig.direction === "asc" ? -1 : 1;
      if (aComparable > bComparable) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  // IDs à relancer : tous les INVITED non cliqués visibles
  const relanceableIds = React.useMemo(
    () =>
      sorted
        .filter((m) => m.invitationStatus === "INVITED" && m.invitationClicks === 0)
        .map((m) => m.id),
    [sorted],
  );

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const SortIcon = ({ key, label }: { key: string; label: string }) => {
    const isActive = sortConfig.key === key;
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        title={`Trier par ${label}`}
      >
        <span className="mono-label text-[10px] text-muted-foreground">{label}</span>
        {isActive && (
          <span className="text-lime">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="size-6 text-lime" />
            Invitations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion des invitations, suivi des clics et relances
          </p>
        </div>
        {relanceableIds.length > 0 && (
          <button
            type="button"
            onClick={() => setRelanceOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-lime text-black font-medium text-sm rounded-lg hover:bg-lime/90 transition-colors shadow-[0_0_0_1px_rgba(197,244,65,0.3)]"
          >
            <RefreshCw className="size-4" />
            Relancer tout ({relanceableIds.length})
          </button>
        )}
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <StatCard
            label="Total"
            value={stats.total}
            icon={Users}
            color="text-foreground"
            active={statusFilter === "ALL"}
            onClick={() => { setStatusFilter("ALL"); setPage(1); }}
            description="Tous les membres"
          />
          <StatCard
            label="Invités"
            value={stats.INVITED}
            icon={Mail}
            color="text-blue-400"
            active={statusFilter === "INVITED"}
            onClick={() => { setStatusFilter("INVITED"); setPage(1); }}
            description="En attente de clic"
          />
          <StatCard
            label="Acceptés"
            value={stats.ACCEPTED}
            icon={CheckCircle}
            color="text-lime"
            active={statusFilter === "ACCEPTED"}
            onClick={() => { setStatusFilter("ACCEPTED"); setPage(1); }}
            description="Ont rejoint la communauté"
          />
          <StatCard
            label="Refusés"
            value={stats.REFUSED}
            icon={XCircle}
            color="text-red-400"
            active={statusFilter === "REFUSED"}
            onClick={() => { setStatusFilter("REFUSED"); setPage(1); }}
            description="Ont refusé l'invitation"
          />
          <StatCard
            label="Bounces"
            value={stats.BOUNCED}
            icon={AlertTriangle}
            color="text-orange-400"
            active={statusFilter === "BOUNCED"}
            onClick={() => { setStatusFilter("BOUNCED"); setPage(1); }}
            description="Emails non délivrés"
          />
          <StatCard
            label="Expirés"
            value={stats.EXPIRED}
            icon={Hourglass}
            color="text-yellow-400"
            active={statusFilter === "EXPIRED"}
            onClick={() => { setStatusFilter("EXPIRED"); setPage(1); }}
            description="Lien expiré (72h)"
          />
          <StatCard
            label="Non invités"
            value={stats.NOT_INVITED}
            icon={Hourglass}
            color="text-muted-foreground"
            active={statusFilter === "NOT_INVITED"}
            onClick={() => { setStatusFilter("NOT_INVITED"); setPage(1); }}
            description="Jamais invités"
          />
        </div>
      )}

      {/* Status Tabs */}
      {stats && (
        <StatusTabs active={statusFilter} onChange={(s) => { setStatusFilter(s); setPage(1); }} stats={stats} />
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher par nom, email, téléphone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-10 py-2.5 bg-card border border-border/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lime/40 placeholder:text-muted-foreground"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              <tr className="border-b border-border/40 bg-muted/30 text-left">
                <th className="px-4 py-3">
                  <SortIcon key="firstName" label="Membre" />
                </th>
                <th className="px-4 py-3">
                  <SortIcon key="invitationStatus" label="Statut" />
                </th>
                <th className="px-4 py-3 hidden md:table-cell">
                  <SortIcon key="level" label="Niveau / Domaine" />
                </th>
                <th className="px-4 py-3 hidden lg:table-cell">
                  <SortIcon key="country" label="Pays" />
                </th>
                <th className="px-4 py-3 hidden lg:table-cell text-center">
                  <SortIcon key="invitationClicks" label="Clics" />
                </th>
                <th className="px-4 py-3 hidden xl:table-cell">
                  <SortIcon key="lastClickedAt" label="Dernier événement" />
                </th>
                <th className="px-4 py-3 w-28 text-right">
                  <span className="mono-label text-[10px] text-muted-foreground">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="size-8 text-lime animate-spin" />
                      <span>Chargement...</span>
                    </div>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState status={statusFilter} onClearFilter={() => setStatusFilter("ALL")} />
                  </td>
                </tr>
              ) : (
                sorted.map((m) => (
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {pagination.total} résultat(s) · page {pagination.page}/{pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Page précédente"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-2 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Page suivante"
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