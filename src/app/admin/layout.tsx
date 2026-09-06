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
  ChevronRight,
  RefreshCw,
  ArrowLeft,
  LogOut,
  Download,
  FileJson,
  Command,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@hooks/use-toast";
import { cn } from "@/lib/utils";

const SECTION_MAP: Record<string, string> = {
  "/admin/stats": "section-stats",
  "/admin/members": "section-members",
  "/admin/activity": "section-activity",
  "/admin/exports": "section-exports",
};

const SECTION_LABELS: Record<string, string> = {
  "section-stats": "Vue d'ensemble",
  "section-members": "Membres",
  "section-activity": "Activité",
  "section-exports": "Exports",
};

const routeMap: Record<string, string> = {
  "section-stats": "/admin/stats",
  "section-members": "/admin/members",
  "section-activity": "/admin/activity",
  "section-exports": "/admin/exports",
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
  const currentSectionLabel = SECTION_LABELS[activeSectionId];

  const handleRefresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const handleExport = React.useCallback(
    async (type: "csv" | "json") => {
      try {
        const url = type === "csv" ? "/api/export" : "/api/export/json";
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Export failed");
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `hashcode-admin-export-${type}-${new Date().toISOString()}.${type}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);

        toast({
          title: "Export terminé",
          description: `Les données ont été exportées au format ${type.toUpperCase()}.`,
        });
      } catch (error) {
        console.error("Export error:", error);
        toast({
          title: "Erreur d'exportation",
          description: "Impossible d'exporter les données.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

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
    } catch (error) {
      console.error("Logout error:", error);
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

  const onSetFilter = React.useCallback((key: string, value: string) => {
    // Placeholder for setting filters. The layout doesn't directly handle filters.
    console.log(`Setting filter: ${key} = ${value}`);
  }, []);

  const openPalette = React.useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = React.useCallback(() => setIsPaletteOpen(false), []);

  return (
    <div
      className={`${adminSans.variable} ${adminMono.variable} admin-scope min-h-screen flex flex-col`}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border/60 bg-card px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Logo className="size-6 text-lime shrink-0" />
          <MonoLabel className="text-sm">Admin</MonoLabel>
          {currentSectionLabel && (
            <>
              <ChevronRight className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{currentSectionLabel}</span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Session active badge */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-500"></span>
            </span>
            <span>Session active</span>
          </div>

          <RebootButton
            variant="ghost"
            className="size-8"
            onClick={openPalette}
            aria-label="Ouvrir la palette de commandes (Ctrl+K)"
          >
            <Command className="size-4" />
          </RebootButton>

          <RebootButton
            variant="ghost"
            className="size-8"
            onClick={handleRefresh}
            aria-label="Rafraîchir la page"
          >
            <RefreshCw className="size-4" />
          </RebootButton>

          <RebootButton
            variant="ghost"
            className="size-8"
            onClick={() => handleExport("csv")}
            aria-label="Exporter en CSV"
          >
            <Download className="size-4" />
          </RebootButton>

          <ChangePasscodeDialog onSessionExpired={handleLogout} onChanged={() => toast({ title: "Passcode changé avec succès." })} />

          <RebootButton
            variant="ghost"
            className={cn("size-8", "hidden md:flex")}
            onClick={() => handleExport("json")}
            aria-label="Exporter en JSON"
          >
            <FileJson className="size-4" />
          </RebootButton>

          <RebootButton
            variant="ghost"
            className="size-8"
            onClick={handleLogout}
            aria-label="Déconnexion"
          >
            <LogOut className="size-4" />
          </RebootButton>

          <RebootButton
            variant="ghost"
            className="size-8"
            onClick={() => router.push("/")}
            aria-label="Retour au site"
          >
            <ArrowLeft className="size-4" />
          </RebootButton>
        </div>
      </header>

      <div className="flex-1 flex flex-row min-h-0">
        <AdminSidebar
          activeSection={activeSectionId}
          onNavigate={onNavigate}
          onOpenPalette={openPalette}
        />
        <main className="flex-1 flex flex-col overflow-auto bg-muted/20">
          <div className="flex-1 p-6">
            {children}
          </div>
          <footer className="px-6 py-4 border-t border-border/60 text-muted-foreground text-sm flex items-center justify-between shrink-0">
            <p>HASHCODE REBOOT © {new Date().getFullYear()}</p>
            <p className="mono-label">Admin v2.0</p>
          </footer>
        </main>
      </div>

      <SessionReminder />
      <CommandPalette
        open={isPaletteOpen}
        onOpenChange={closePalette}
        onNavigate={onNavigate}
        onSetFilter={onSetFilter}
        onExport={handleExport}
        onLogout={handleLogout}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
