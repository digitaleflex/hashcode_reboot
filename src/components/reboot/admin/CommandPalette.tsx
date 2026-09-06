"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from "@/components/ui/dialog";
import { Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/reboot/shared";

/* ── Types ────────────────────────────────────────────────────────────────── */

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: "navigation" | "actions" | "filters";
  action: () => void;
}

interface CommandPaletteProps {
  /** Controlled open state — owned by the dashboard so header/sidebar buttons can open it. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (sectionId: string) => void;
  onSetFilter: (key: string, value: string) => void;
  onExport: (kind: "csv" | "json") => void;
  onLogout: () => void;
  onRefresh: () => void;
}

const GROUP_LABELS: Record<CommandItem["group"], string> = {
  navigation: "Navigation",
  actions: "Actions",
  filters: "Filtres rapides",
};

/* ── Component ────────────────────────────────────────────────────────────── */

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onSetFilter,
  onExport,
  onLogout,
  onRefresh,
}: CommandPaletteProps) {
  const [search, setSearch] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const commandItems = React.useMemo<CommandItem[]>(
    () => [
      // Navigation
      { id: "nav-stats", label: "Vue d'ensemble", group: "navigation", action: () => onNavigate("section-stats") },
      { id: "nav-members", label: "Membres", group: "navigation", action: () => onNavigate("section-members") },
      { id: "nav-activity", label: "Activité", group: "navigation", action: () => onNavigate("section-activity") },
      { id: "nav-exports", label: "Exports", group: "navigation", action: () => onNavigate("section-exports") },
      // Actions
      { id: "act-refresh", label: "Rafraîchir les données", hint: "R", group: "actions", action: onRefresh },
      {
        id: "act-search",
        label: "Rechercher un membre",
        hint: "E",
        group: "actions",
        action: () => {
          const input = document.querySelector<HTMLInputElement>('input[placeholder*="Recherche"]');
          input?.focus();
        },
      },
      { id: "act-export-csv", label: "Exporter en CSV", group: "actions", action: () => onExport("csv") },
      { id: "act-export-json", label: "Exporter en JSON", group: "actions", action: () => onExport("json") },
      { id: "act-logout", label: "Se déconnecter", group: "actions", action: onLogout },
      // Filtres rapides — statuts
      { id: "f-pending", label: "Membres en attente", group: "filters", action: () => onSetFilter("status", "PENDING") },
      { id: "f-approved", label: "Membres validés", group: "filters", action: () => onSetFilter("status", "APPROVED") },
      { id: "f-waitlist", label: "Membres waitlist", group: "filters", action: () => onSetFilter("status", "WAITLIST") },
      // Filtres rapides — domaines
      { id: "f-cyber", label: "Membres Cyber", group: "filters", action: () => onSetFilter("domain", "cybersecurity") },
      { id: "f-web", label: "Membres Web", group: "filters", action: () => onSetFilter("domain", "web") },
      { id: "f-ai", label: "Membres AI", group: "filters", action: () => onSetFilter("domain", "ai") },
    ],
    [onNavigate, onSetFilter, onExport, onLogout, onRefresh],
  );

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return commandItems;
    return commandItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [commandItems, search]);

  // Reset selection when the query or open state changes.
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [search, open]);

  // Focus input on open.
  React.useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  // Keep the selected item in view.
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-cmd-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const runItem = React.useCallback(
    (item: CommandItem | undefined) => {
      if (!item) return;
      onOpenChange(false);
      item.action();
    },
    [onOpenChange],
  );

  const onInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        runItem(filteredItems[selectedIndex]);
      }
    },
    [filteredItems, selectedIndex, runItem],
  );

  const grouped = React.useMemo(() => {
    const groups: { group: CommandItem["group"]; items: CommandItem[] }[] = [
      { group: "navigation", items: [] },
      { group: "actions", items: [] },
      { group: "filters", items: [] },
    ];
    for (const item of filteredItems) {
      groups.find((g) => g.group === item.group)?.items.push(item);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [filteredItems]);

  // Flat index across groups for arrow-key selection.
  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay />
      <DialogContent
        className="bg-card border-border/60 max-w-lg p-0 overflow-hidden animate-hash-in"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Palette de commandes</DialogTitle>
        {/* Search input */}
        <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
          <Search className="size-4 text-muted-foreground shrink-0" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={
              filteredItems[selectedIndex] ? `cmd-${filteredItems[selectedIndex].id}` : undefined
            }
            placeholder="Rechercher une commande…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onInputKeyDown}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            aria-label="Rechercher une commande"
          />
          <kbd className="mono-label text-muted-foreground border border-border rounded-sm px-1.5 py-0.5 text-[10px] shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Commandes"
          className="max-h-[55vh] overflow-y-auto scroll-slim py-2"
        >
          {filteredItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune commande pour « {search} ».
            </p>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} className="px-2 py-1.5">
                <MonoLabel className="text-muted-foreground px-2 py-1 block">
                  {GROUP_LABELS[group]}
                </MonoLabel>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    const active = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        id={`cmd-${item.id}`}
                        data-cmd-index={idx}
                        role="option"
                        aria-selected={active}
                        type="button"
                        onMouseMove={() => setSelectedIndex(idx)}
                        onClick={() => runItem(item)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 rounded-sm px-3 py-2.5 text-left text-sm min-h-[40px]",
                          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
                          active ? "bg-lime/10 text-lime" : "text-foreground hover:bg-lime/5",
                        )}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {item.hint && (
                            <span className="mono-label text-muted-foreground border border-border rounded-sm px-1.5 py-0.5 text-[10px]">
                              {item.hint}
                            </span>
                          )}
                          <ArrowRight
                            className={cn(
                              "size-3.5 transition-opacity",
                              active ? "opacity-100 text-lime" : "opacity-0",
                            )}
                            aria-hidden
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
