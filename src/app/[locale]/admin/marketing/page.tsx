"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/reboot/shared";
import { EmailEngagement, type EmailStatsData } from "@/components/reboot/admin/EmailEngagement";
import { ImportInvitePanel } from "@/app/[locale]/admin/members/ImportInvitePanel";
import { AnnouncePanel } from "@/components/reboot/admin/marketing/AnnouncePanel";
import { RelancePanel } from "@/components/reboot/admin/marketing/RelancePanel";
import { TestEmailPanel } from "@/components/reboot/admin/marketing/TestEmailPanel";
import { CampaignLogPanel } from "@/components/reboot/admin/marketing/CampaignLogPanel";
import {
  MarketingGraphs,
  type AudienceSplit,
  type InviteStatusStats,
  type InviteFunnel,
} from "@/components/reboot/admin/marketing/MarketingGraphs";
import { useAdminQuery } from "@/components/reboot/admin/lib/adminQuery";
import { cn } from "@/lib/utils";
import { Send, Megaphone, Upload, FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";

const TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "campagnes", label: "Campagnes" },
  { id: "historique", label: "Historique" },
  { id: "import", label: "Import" },
  { id: "test", label: "Test" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function readTab(): TabId {
  if (typeof window === "undefined") return "overview";
  const t = new URLSearchParams(window.location.search).get("tab");
  return TABS.some((x) => x.id === t) ? (t as TabId) : "overview";
}

export default function AdminMarketingPage() {
  const t = useTranslations("admin.marketing");
  // D25 : `router` ne sert plus qu'aux boutons de navigation entre pages admin.
  // La redirection 401 est portée par `adminRequest`, plus par un callback.
  const router = useRouter();
  const [tab, setTab] = React.useState<TabId>("overview");

  /**
   * D25 + D32 : les 3 `fetchJson` parallèles deviennent 3 `useQuery`.
   *
   * Le `Promise.all` d'origine était **tout-ou-rien** : une seule erreur
   * annulait les trois sections. Chaque `useQuery` est indépendant, donc une
   * section en panne n'en efface plus les deux autres — c'est le seul écart,
   * et il va dans le sens du `.catch(...)` muet d'origine, qui laissait
   * deja les sections vides en cas d'echec.
   *
   * `retry: false` : ces trois lectures ne sont interrogées qu'au montage.
   * Sans cela, un 401 serait réessayé 3 fois avant que la redirection ne parte.
   */
  const emails = useAdminQuery<EmailStatsData>({
    queryKey: ["admin", "marketing", "email-stats"],
    url: "/api/email-stats",
    init: { cache: "no-store" },
    retry: false,
  });
  const stats = useAdminQuery<{
    totals?: { total?: number };
    invitations?: { registered?: number; invited?: number };
  }>({
    queryKey: ["admin", "marketing", "stats"],
    url: "/api/stats",
    init: { cache: "no-store" },
    retry: false,
  });
  const invites = useAdminQuery<{
    ok?: boolean;
    stats?: InviteStatusStats;
    funnel?: InviteFunnel;
  }>({
    queryKey: ["admin", "marketing", "invites"],
    url: "/api/admin/invitations?page=1&pageSize=1",
    init: { cache: "no-store" },
    retry: false,
  });

  const emailStats = emails.data ?? null;
  const audience = React.useMemo<AudienceSplit | null>(() => {
    const s = stats.data;
    if (!s?.totals || !s?.invitations) return null;
    return {
      total: s.totals.total as number,
      registered: s.invitations.registered as number,
      invited: s.invitations.invited as number,
    };
  }, [stats.data]);
  const inviteStats = invites.data?.ok ? (invites.data.stats ?? null) : null;
  const funnel = invites.data?.ok ? (invites.data.funnel ?? null) : null;
  const loadingStats = emails.isLoading || stats.isLoading || invites.isLoading;

  React.useEffect(() => {
    setTab(readTab());
  }, []);

  const selectTab = React.useCallback((t: TabId) => {
    setTab(t);
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.set("tab", t);
      window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("sectionsAria.tablist")}>
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            role="tab"
            aria-selected={tab === tabItem.id}
            onClick={() => selectTab(tabItem.id)}
            className={cn(
              "h-9 px-4 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
              tab === tabItem.id
                ? "border-lime/60 bg-lime/10 text-lime"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section aria-label={t("sectionsAria.overview")} className="space-y-6">
          <MarketingGraphs
            emailStats={emailStats}
            audience={audience}
            inviteStats={inviteStats}
            funnel={funnel}
            loading={loadingStats}
          />
          <div>
            <MonoLabel className="text-muted-foreground">{t("quickActions")}</MonoLabel>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => selectTab("campagnes")}
                className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Send className="size-4 text-lime" aria-hidden />
                  {t("cards.relanceTitle")}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {inviteStats ? t("cards.relancePending", { count: inviteStats.INVITED }) : t("cards.relanceFallback")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectTab("campagnes")}
                className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Megaphone className="size-4 text-lime" aria-hidden />
                  {t("cards.announceTitle")}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{t("cards.announceDescription")}</span>
              </button>
              <button
                type="button"
                onClick={() => selectTab("import")}
                className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Upload className="size-4 text-lime" aria-hidden />
                  {t("cards.importTitle")}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{t("cards.importDescription")}</span>
              </button>
              <button
                type="button"
                onClick={() => selectTab("test")}
                className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FlaskConical className="size-4 text-lime" aria-hidden />
                  {t("cards.testTitle")}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{t("cards.testDescription")}</span>
              </button>
            </div>
          </div>
          <EmailEngagement data={emailStats} loading={loadingStats} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button type="button" onClick={() => router.push("/admin/invitations")} className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors">
              <MonoLabel className="text-muted-foreground">{t("links.invitationsTitle")}</MonoLabel>
              <p className="mt-1 text-sm text-foreground">{t("links.invitationsDescription")}</p>
            </button>
            <button type="button" onClick={() => router.push("/admin/members?type=invited")} className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors">
              <MonoLabel className="text-muted-foreground">{t("links.invitedTitle")}</MonoLabel>
              <p className="mt-1 text-sm text-foreground">{t("links.invitedDescription")}</p>
            </button>
            <button type="button" onClick={() => router.push("/admin/exports")} className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors">
              <MonoLabel className="text-muted-foreground">{t("links.exportsTitle")}</MonoLabel>
              <p className="mt-1 text-sm text-foreground">{t("links.exportsDescription")}</p>
            </button>
          </div>
        </section>
      )}

      {tab === "campagnes" && (
        <section aria-label={t("sectionsAria.campaigns")} className="space-y-4">
          <AnnouncePanel />
          <RelancePanel />
        </section>
      )}

      {tab === "historique" && (
        <section aria-label={t("sectionsAria.history")}>
          <CampaignLogPanel />
        </section>
      )}

      {tab === "import" && (
        <section aria-label={t("sectionsAria.import")}>
          <ImportInvitePanel />
        </section>
      )}

      {tab === "test" && (
        <section aria-label={t("sectionsAria.test")}>
          <TestEmailPanel />
        </section>
      )}
    </div>
  );
}