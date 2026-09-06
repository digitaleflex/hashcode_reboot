"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ShortcutHandler = () => void;

interface Shortcut {
  handler: ShortcutHandler;
  description: string;
}

export type ShortcutMap = Record<string, Shortcut>;

/**
 * Centralized keyboard shortcuts hook for the admin dashboard.
 * Disabled when an input/textarea is focused (except Escape).
 *
 * Registered keys:
 *   r     → refresh
 *   e     → focus search
 *   Esc   → close detail dialog
 *   ?     → open shortcut help dialog
 */
export function useAdminKeyboardShortcuts(
  shortcuts: ShortcutMap,
  enabled = true,
) {
  React.useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs (except Escape)
      const target = e.target as HTMLElement;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;

      if (isInput && e.key !== "Escape") return;

      // Ignore modifier key combos
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      const shortcut = shortcuts[key];
      if (shortcut) {
        e.preventDefault();
        shortcut.handler();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, enabled]);
}

/** Dialog-based shortcut help — triggered via ? shortcut or button click. */
export function ShortcutHelp({
  shortcuts,
  open,
  onOpenChange,
}: {
  shortcuts: ShortcutMap;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // Expose a global event so the dashboard can open it from the ? shortcut.
  React.useEffect(() => {
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("hashcode:open-shortcut-help", onOpenEvent);
    return () =>
      window.removeEventListener("hashcode:open-shortcut-help", onOpenEvent);
  }, [setOpen]);

  const entries = Object.entries(shortcuts);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border/60 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Raccourcis clavier
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {entries.map(([key, shortcut]) => (
            <div key={key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-foreground">{shortcut.description}</span>
              <kbd className="px-2 py-1 rounded-sm border border-border bg-card font-mono text-xs uppercase text-muted-foreground">
                {key === "escape" ? "Esc" : key === "?" ? "?" : key.toUpperCase()}
              </kbd>
            </div>
          ))}
          <div className="flex items-center justify-between py-1.5 border-t border-border/40 mt-2 pt-2">
            <span className="text-sm text-foreground">Palette de commandes</span>
            <kbd className="px-2 py-1 rounded-sm border border-border bg-card font-mono text-xs uppercase text-muted-foreground">
              Ctrl K
            </kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
