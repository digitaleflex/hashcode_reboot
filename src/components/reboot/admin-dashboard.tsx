"use client";

import * as React from "react";
import { CommandPalette } from "./admin/CommandPalette";

interface AdminDashboardProps {
  onExit: () => void;
  onSessionExpired?: () => void;
}

export function AdminDashboard({ onExit, onSessionExpired }: AdminDashboardProps) {
  // ... existing code ...

  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // ... existing code ...

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="compact" size="sm" />
            <span className="hidden sm:inline text-border">/</span>
            <MonoLabel className="text-lime hidden sm:inline">Admin</MonoLabel>
            <span className="hidden md:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-sm border border-lime/40 bg-lime/5">
              <span className="size-1.5 rounded-full bg-lime animate-hash-pulse" />
              <span className="mono-label text-lime">Session active</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ShortcutHelp shortcuts={shortcuts} />
            <RebootButton
              size="sm"
              variant="outline"
              onClick={() => setPaletteOpen(true)}
            >
              <Command className="size-4" />
              <span className="hidden sm:inline">Ctrl K</span>
            </RebootButton>
            <RebootButton
              size="sm"
              variant="outline"
              onClick={() => {
                void refresh();
              }}
              disabled={loading}
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Rafraîchir</span>
            </RebootButton>
            {/* ... existing buttons ... */}
          </div>
        </div>
      </header>

      {/* ... existing code ... */}

      <CommandPalette
        onNavigate={navigateToSection}
        onSetFilter={setFilter}
        onExport={handleExport}
        onLogout={logout}
        onRefresh={refresh}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* ... existing code ... */}
    </div>
  );
}