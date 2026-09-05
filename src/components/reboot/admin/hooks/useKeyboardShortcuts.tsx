"use client";

import * as React from "react";

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
 *   ?     → (placeholder for future help dialog)
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

/** Inline shortcut help display (renders kbd tags). */
export function ShortcutHelp({ shortcuts }: { shortcuts: ShortcutMap }) {
  const entries = Object.entries(shortcuts);
  if (entries.length === 0) return null;

  return (
    <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
      {entries.map(([key, shortcut]) => (
        <React.Fragment key={key}>
          <kbd className="px-1 py-0.5 rounded-sm border border-border bg-card font-mono text-[10px] uppercase">
            {key === "escape" ? "Esc" : key}
          </kbd>
          <span className="mr-1">{shortcut.description}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
