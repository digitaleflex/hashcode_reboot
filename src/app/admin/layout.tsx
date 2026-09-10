"use client";

import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import { AdminSidebar } from "@/components/reboot/admin/AdminSidebar";
import { CommandPalette } from "@/components/reboot/admin/CommandPalette";
import { ChangePasscodeDialog } from "@/components/reboot/admin/ChangePasscodeDialog";
import { SessionReminder } from "./session-reminder";
import { adminMono, adminSans } from "./fonts";
import {
  LogOut,
  Command,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SECTION_MAP: Record<string, string> = {
  "/admin/stats": "section-stats",
  "/admin/members": "section-members",
  "/admin/invitations": "section-invitations",
  "/admin/marketing": "section-marketing",
  "/admin/events": "section-events",
  "/admin/activity": "section-activity",
  "/admin/exports": "section-exports",
  "/admin/audit-log": "section-audit-log",
  "/admin/settings": "section-settings",
};

const routeMap: Record<string, string> = {
  "section-stats": "/admin/stats",
  "section-members": "/admin/members",
  "section-invitations": "/admin/invitations",
  "section-marketing": "/admin/marketing",
  "section-events": "/admin/events",
  "section-activity": "/admin/activity",
  "section-exports": "/admin/exports",
  "section-audit-log": "/admin/audit-log",
  "section-settings": "/admin/settings",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isPaletteOpen, setIsPaletteOpen] = React.useState(false);

  const activeSectionId = SECTION_MAP[pathname] || "section-stats";

  const handleLogout = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (response.ok) {
        queryClient.clear();
        router.push("/");
        toast({ title: "Déconnexion réussie" });
      } else {
        throw new Error("Logout failed");
      }
    } catch {
      toast({
        title: "Erreur de déconnexion",
        description: "Impossible de se déconnecter.",
        variant: "destructive",
      });
    }
  }, [queryClient, router, toast]);

  const onNavigate = React.useCallback(
    (sectionId: string) => {
      const targetRoute = routeMap[sectionId];
      if (targetRoute) {
        router.push(targetRoute);
      }
    },
    [router],
  );

  const openPalette = React.useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = React.useCallback(() => setIsPaletteOpen(false), []);
  const onSetFilter = React.useCallback((key: string, value: string) => {
    // Filters handled by members page
  }, []);

  return (
    <div
      className={`${adminSans.variable} ${adminMono.variable} admin-scope min-h-screen flex flex-col`}
    >
      <header className="sticky top-0 z-40 h-14 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="h-full px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="size-6 text-lime shrink-0" />
          </div>

          <div className="flex items-center gap-1">
            <RebootButton
              variant="outline"
              size="sm"
              onClick={openPalette}
              className="gap-2"
            >
              <Command className="size-4" />
              <span className="hidden sm:inline mono-label text-xs">Ctrl K</span>
            </RebootButton>

            <ChangePasscodeDialog
              onSessionExpired={handleLogout}
              onChanged={() => toast({ title: "Passcode changé avec succès." })}
            />

            <RebootButton
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline mono-label text-xs">Déconnexion</span>
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
        <main className="flex-1 min-w-0 overflow-auto bg-muted/10">
          <div className="mx-auto max-w-7xl w-full px-5 sm:px-8 py-8">
            {children}
          </div>
          <footer className="px-5 sm:px-8 py-4 border-t border-border/60">
            <p className="text-center text-xs text-muted-foreground mono-label">
              HASHCODE REBOOT · Admin — accès réservé
            </p>
          </footer>
        </main>
      </div>

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
