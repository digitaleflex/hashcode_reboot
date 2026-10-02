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
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";
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
  const router = useRouter();
  const [tab, setTab] = React.useState<TabId>("overview");
  const [emailStats, setEmailStats] = React.useState<EmailStatsData | null>(null);
  const [audience, setAudience] = React.useState<AudienceSplit | null>(null);
  const [inviteStats, setInviteStats] = React.useState<InviteStatusStats | null>(null);
  const [funnel, setFunnel] = React.useState<InviteFunnel | null>(null);
  const [loadingStats, setLoadingStats] = React.useState(true);

  const handleSessionExpired = React.useCallback(() => {
    router.push("/?admin=1");
  }, [router]);

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

  React.useEffect(() => {
    const ctrl = new AbortController();
    setLoadingStats(true);
    Promise.all([
      fetchJson("/api/email-stats", { cache: "no-store", signal: ctrl.signal }),
      fetchJson("/api/stats", { cache: "no-store", signal: ctrl.signal }),
      fetchJson("/api/admin/invitations?page=1&pageSize=1", { cache: "no-store", signal: ctrl.signal }),
    ])
      .then(([emails, stats, invites]) => {
        if (
          emails.res.status === 401 ||
          emails.code === "UNAUTHORIZED" ||
          stats.res.status === 401 ||
          stats.code === "UNAUTHORIZED" ||
          invites.res.status === 401 ||
          invites.code === "UNAUTHORIZED"
        ) {
          handleSessionExpired();
          return;
        }
        if (emails.res.ok) setEmailStats(emails.data as EmailStatsData);
        if (stats.res.ok && stats.data?.totals && stats.data?.invitations) {
          setAudience({
            total: stats.data.totals.total as number,
            registered: stats.data.invitations.registered as number,
            invited: stats.data.invitations.invited as number,
          });
        }
        if (invites.res.ok && invites.data?.ok && invites.data?.stats) {
          setInviteStats(invites.data.stats as InviteStatusStats);
        }
        if (invites.res.ok && invites.data?.ok && invites.data?.funnel) {
          setFunnel(invites.data.funnel as InviteFunnel);
        }
      })
      .catch(() => {
        /* silencieux — les sections gèrent l'absence de données */
      })
      .finally(() => setLoadingStats(false));
    return () => ctrl.abort();
  }, [handleSessionExpired]);

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
          <AnnouncePanel onSessionExpired={handleSessionExpired} />
          <RelancePanel onSessionExpired={handleSessionExpired} />
        </section>
      )}

      {tab === "historique" && (
        <section aria-label={t("sectionsAria.history")}>
          <CampaignLogPanel onSessionExpired={handleSessionExpired} />
        </section>
      )}

      {tab === "import" && (
        <section aria-label={t("sectionsAria.import")}>
          <ImportInvitePanel onSessionExpired={handleSessionExpired} />
        </section>
      )}

      {tab === "test" && (
        <section aria-label={t("sectionsAria.test")}>
          <TestEmailPanel onSessionExpired={handleSessionExpired} />
        </section>
      )}
    </div>
  );
}