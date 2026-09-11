"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/reboot/shared";
import { EmailEngagement, type EmailStatsData } from "@/components/reboot/admin/EmailEngagement";
import { ImportInvitePanel } from "@/app/admin/members/ImportInvitePanel";
import { AnnouncePanel } from "@/components/reboot/admin/marketing/AnnouncePanel";
import { RelancePanel } from "@/components/reboot/admin/marketing/RelancePanel";
import { TestEmailPanel } from "@/components/reboot/admin/marketing/TestEmailPanel";
import {
  MarketingGraphs,
  type AudienceSplit,
  type InviteStatusStats,
  type InviteFunnel,
} from "@/components/reboot/admin/marketing/MarketingGraphs";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";
import { cn } from "@/lib/utils";
import { Send, Megaphone, Upload, FlaskConical } from "lucide-react";

const TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "campagnes", label: "Campagnes" },
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
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted-foreground">Pilote emails, campagnes, import et tests depuis un seul espace.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections marketing">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={cn(
              "h-9 px-4 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
              tab === t.id
                ? "border-lime/60 bg-lime/10 text-lime"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section aria-label="Vue d'ensemble marketing" className="space-y-6">
          <MarketingGraphs
            emailStats={emailStats}
            audience={audience}
            inviteStats={inviteStats}
            funnel={funnel}
            loading={loadingStats}
          />
          <div>
            <MonoLabel className="text-muted-foreground">Actions rapides</MonoLabel>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => selectTab("campagnes")}
                className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Send className="size-4 text-lime" aria-hidden />
                  Relancer les invitations
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {inviteStats ? `${inviteStats.INVITED} invité(s) en attente.` : "Relances et lots d'annonce."}
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectTab("campagnes")}
                className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Megaphone className="size-4 text-lime" aria-hidden />
                  Annoncer l'espace membre
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">Envois par lots de 15.</span>
              </button>
              <button
                type="button"
                onClick={() => selectTab("import")}
                className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Upload className="size-4 text-lime" aria-hidden />
                  Importer des contacts
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">CSV + invitation automatique.</span>
              </button>
              <button
                type="button"
                onClick={() => selectTab("test")}
                className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FlaskConical className="size-4 text-lime" aria-hidden />
                  Tester un email
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">Bienvenue / invitation.</span>
              </button>
            </div>
          </div>
          <EmailEngagement data={emailStats} loading={loadingStats} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button type="button" onClick={() => router.push("/admin/invitations")} className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors">
              <MonoLabel className="text-muted-foreground">Invitations</MonoLabel>
              <p className="mt-1 text-sm text-foreground">Suivi des statuts et relances.</p>
            </button>
            <button type="button" onClick={() => router.push("/admin/members?type=invited")} className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors">
              <MonoLabel className="text-muted-foreground">Invités</MonoLabel>
              <p className="mt-1 text-sm text-foreground">Liste filtrée des membres invités.</p>
            </button>
            <button type="button" onClick={() => router.push("/admin/exports")} className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors">
              <MonoLabel className="text-muted-foreground">Exports</MonoLabel>
              <p className="mt-1 text-sm text-foreground">Extraire les cibles de campagne.</p>
            </button>
          </div>
        </section>
      )}

      {tab === "campagnes" && (
        <section aria-label="Campagnes" className="space-y-4">
          <AnnouncePanel onSessionExpired={handleSessionExpired} />
          <RelancePanel onSessionExpired={handleSessionExpired} />
        </section>
      )}

      {tab === "import" && (
        <section aria-label="Import et invitation">
          <ImportInvitePanel onSessionExpired={handleSessionExpired} />
        </section>
      )}

      {tab === "test" && (
        <section aria-label="Test email">
          <TestEmailPanel onSessionExpired={handleSessionExpired} />
        </section>
      )}
    </div>
  );
}