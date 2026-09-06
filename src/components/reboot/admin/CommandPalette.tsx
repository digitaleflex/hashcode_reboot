"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { Command, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/reboot/shared";

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  group: "navigation" | "actions" | "filters";
  action: () => void;
}

interface CommandPaletteProps {
  onNavigate: (sectionId: string) => void;
  onSetFilter: (key: string, value: string) => void;
  onExport: (type: "csv" | "json") => void;
  onLogout: () => void;
  onRefresh: () => void;
  onOpenPalette: () => void;
}

export function CommandPalette({
  onNavigate,
  onSetFilter,
  onExport,
  onLogout,
  onRefresh,
  onOpenPalette,
}: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const commandItems: CommandItem[] = React.useMemo(() => [
    // Navigation
    {
      id: "overview",
      label: "Vue d'ensemble",
      group: "navigation",
      action: () => onNavigate("section-stats"),
    },
    {
      id: "members",
      label: "Membres",
      group: "navigation",
      action: () => onNavigate("section-members"),
    },
    {
      id: "activity",
      label: "Activité",
      group: "navigation",
      action: () => onNavigate("section-activity"),
    },
    {
      id: "exports",
      label: "Exports",
      group: "navigation",
      action: () => onNavigate("section-exports"),
    },
    // Actions
    {
      id: "refresh",
      label: "Rafraîchir",
      shortcut: "r",
      group: "actions",
      action: onRefresh,
    },
    {
      id: "search",
      label: "Recherche",
      shortcut: "e",
      group: "actions",
      action: () => {
        setOpen(false);
        const input = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Recherche"]',
        );
        input?.focus();
      },
    },
    {
      id: "export-csv",
      label: "Exporter CSV",
      group: "actions",
      action: () => onExport("csv"),
    },
    {
      id: "export-json",
      label: "Exporter JSON",
      group: "actions",
      action: () => onExport("json"),
    },
    {
      id: "logout",
      label: "Déconnexion",
      group: "actions",
      action: onLogout,
    },
    // Filtres rapides
    {
      id: "pending",
      label: "En attente",
      group: "filters",
      action: () => onSetFilter("status", "PENDING"),
    },
    {
      id: "approved",
      label: "Validés",
      group: "filters",
      action: () => onSetFilter("status", "APPROVED"),
    },
    {
      id: "waitlist",
      label: "Waitlist",
      group: "filters",
      action: () => onSetFilter("status", "WAITLIST"),
    },
    {
      id: "cyber",
      label: "Cyber",
      group: "filters",
      action: () => onSetFilter("domain", "cybersecurity"),
    },
    {
      id: "web",
      label: "Web",
      group: "filters",
      action: () => onSetFilter("domain", "web"),
    },
    {
      id: "ai",
      label: "AI",
      group: "filters",
      action: () => onSetFilter("domain", "ai"),
    },
  ], [onNavigate, onSetFilter, onExport, onLogout, onRefresh]);

  const filteredItems = React.useMemo(() => {
    if (!search) return commandItems;
    return commandItems.filter((item) =>
      item.label.toLowerCase().includes(search.toLowerCase()),
    );
  }, [commandItems, search]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          setOpen(false);
        }
      }
    },
    [filteredItems, selectedIndex],
  );

  React.useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        onOpenPalette();
      }
    };

    document.addEventListener("keydown", handleKeyDownGlobal);
    return () => {
      document.removeEventListener("keydown", handleKeyDownGlobal);
    };
  }, [onOpenPalette]);

  React.useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setSelectedIndex(0);
    }
  }, [open]);

  const groupedItems = React.useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      actions: [],
      filters: [],
    };

    filteredItems.forEach((item) => {
      groups[item.group].push(item);
    });

    return groups;
  }, [filteredItems]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogOverlay />
      <DialogContent
        className="bg-card border-lime/40 p-0 overflow-hidden animate-hash-in"
        showCloseButton={false}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Command className="size-5 text-lime" />
            <MonoLabel className="text-lime">Commandes</MonoLabel>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher des commandes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset"
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedItems).map(([group, items]) => (
            items.length > 0 && (
              <div key={group} className="px-4 py-2">
                <MonoLabel className="text-muted-foreground uppercase text-xs">
                  {group === "navigation" ? "Navigation" : group === "actions" ? "Actions" : "Filtres rapides"}
                </MonoLabel>
                <div className="mt-2 space-y-1">
                  {items.map((item, index) => {
                    const globalIndex = filteredItems.findIndex((i) => i.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.action();
                          setOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-md text-left hover:bg-lime/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
                          selectedIndex === globalIndex && "bg-lime/10",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span>{item.label}</span>
                        </span>
                        {item.shortcut && (
                          <MonoLabel className="text-muted-foreground text-xs">
                            {item.shortcut === "escape" ? "Esc" : item.shortcut}
                          </MonoLabel>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}