"use client";

import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { RebootButton } from "../shared";
import { AdminSidebar } from "./AdminSidebar";
import { CommandPalette } from "./CommandPalette";
import { SessionReminder } from "@/app/[locale]/admin/session-reminder";
import { adminMono, adminSans } from "@/app/[locale]/admin/fonts";
import { LogOut, Command } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MobileBottomNav } from "@/components/reboot/mobile-bottom-nav";
import { useTranslations } from "next-intl";
import {
  resolveAdminSectionId,
  SECTION_ROUTES,
  type AdminSectionId,
} from "./admin-sections";

/**
 * Coquille visuelle de l'espace admin.
 *
 * Extrait de `src/app/[locale]/admin/layout.tsx` afin que ce layout puisse
 * être un **server component** : c'est lui qui porte la garde d'accès
 * (`getAdminRoleFromRequestHeaders`), impossible depuis un module client.
 * Aucun état ni comportement n'est modifié par cette extraction.
 *
 * D27 — les tables de correspondance section ↔ route vivent désormais dans
 * `./admin-sections` (module pur, testé par `tests/admin-sections.test.cjs`).
 */

const DEFAULT_SECTION_ID: AdminSectionId = "section-stats";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin.sidebar");
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isPaletteOpen, setIsPaletteOpen] = React.useState(false);
  const [notificationsCount, setNotificationsCount] = React.useState(0);

  // Fetch notifications count on mount
  React.useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setNotificationsCount(data.totals?.pending ?? 0);
        }
      } catch {
        setNotificationsCount(0);
      }
    }
    fetchCount();
  }, []);
  const activeSectionId = resolveAdminSectionId(pathname) ?? DEFAULT_SECTION_ID;

  const handleLogout = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (response.ok) {
        queryClient.clear();
        router.push("/");
        toast({ title: t("header.logoutSuccess") });
      } else {
        throw new Error("Logout failed");
      }
    } catch {
      toast({
        title: t("header.logoutErrorTitle"),
        description: t("header.logoutErrorDescription"),
        variant: "destructive",
      });
    }
  }, [queryClient, router, toast, t]);

  const onNavigate = React.useCallback(
    (sectionId: string) => {
      const targetRoute = SECTION_ROUTES[sectionId as AdminSectionId];
      if (targetRoute) {
        router.push(targetRoute);
      }
    },
    [router],
  );

  const openPalette = React.useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = React.useCallback(() => setIsPaletteOpen(false), []);
  const onSetFilter = React.useCallback((_key: string, _value: string) => {
    // Filters handled by members page
  }, []);

  return (
    <div
      className={`${adminSans.variable} ${adminMono.variable} admin-scope min-h-screen flex flex-col`}
    >
      <header className="sticky top-0 z-40 h-14 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="size-6 text-lime shrink-0" />
            <span className="mono-label text-sm text-lime/80">HASHCODE Admin</span>
          </div>

          <div className="flex items-center gap-1">
            <RebootButton
              variant="outline"
              size="sm"
              onClick={openPalette}
              className="gap-2"
            >
              <Command className="size-4" />
              <span className="mono-label text-xs">Ctrl K</span>
            </RebootButton>

            <span className="ml-2 text-xs text-muted-foreground">
              {notificationsCount} {t("header.newCount", { n: notificationsCount })}
            </span>

            <RebootButton
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline mono-label text-xs">{t("header.logout")}</span>
            </RebootButton>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <AdminSidebar
          activeSection={activeSectionId}
          onNavigate={onNavigate}
          onOpenPalette={openPalette}
        />
        <main className="flex-1 min-w-0 overflow-y-auto bg-muted/10 pb-20 md:pb-0">
          <div className="mx-auto max-w-7xl w-full px-5 sm:px-8 py-8">
            {children}
          </div>
          <footer className="px-5 sm:px-8 py-4 border-t border-border/60">
            <p className="text-center text-xs text-muted-foreground mono-label">
              {t("header.footer")}
            </p>
          </footer>
        </main>
      </div>
      <MobileBottomNav />

      <SessionReminder />
      <CommandPalette
        open={isPaletteOpen}
        onOpenChange={closePalette}
        onNavigate={onNavigate}
        onSetFilter={onSetFilter}
        onExport={() => router.push("/admin/exports")}
        onLogout={handleLogout}
        onRefresh={() => router.refresh()}
      />
    </div>
  );
}