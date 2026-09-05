"use client";

import * as React from "react";
import { LayoutDashboard, Users, Activity, FileJson, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "hashcode-admin-sidebar";

const ITEMS = [
  { id: "section-stats", label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "section-members", label: "Membres", icon: Users },
  { id: "section-activity", label: "Activité", icon: Activity },
  { id: "section-exports", label: "Exports", icon: FileJson },
] as const;

function useCollapsed() {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

function NavItem({
  id,
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : `Aller à ${label}`}
      aria-label={`Aller à ${label}`}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors duration-150 min-h-[44px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
        active
          ? "bg-lime/10 text-lime ring-1 ring-inset ring-lime/40"
          : "text-muted-foreground hover:bg-lime/5 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-lime" : "text-muted-foreground group-hover:text-foreground",
        )}
        aria-hidden
      />
      {!collapsed && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}
    </button>
  );
}

interface AdminSidebarProps {
  /** Currently active section id, e.g. "section-members" */
  activeSection?: string;
  /** Called when user clicks a nav item with the target section id */
  onNavigate?: (sectionId: string) => void;
}

export function AdminSidebar({ activeSection = "section-stats", onNavigate }: AdminSidebarProps) {
  const { collapsed, toggle } = useCollapsed();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const mobileCloseRef = React.useRef<HTMLButtonElement>(null);
  const mobileOpenRef = React.useRef<HTMLButtonElement>(null);

  function handleNav(sectionId: string) {
    // Source unique de scroll : le parent. Évite le double scrollIntoView.
    onNavigate?.(sectionId);
    setMobileOpen(false);
    // Le focus revient au bouton d’ouverture (FAB) à la fermeture.
    requestAnimationFrame(() => mobileOpenRef.current?.focus());
  }

  function closeMobile(returnFocus = true) {
    setMobileOpen(false);
    if (returnFocus) {
      requestAnimationFrame(() => mobileOpenRef.current?.focus());
    }
  }

  // Close drawer on Esc + rend le focus au bouton d’ouverture.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) closeMobile(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Focus le bouton fermer à l’ouverture du tiroir mobile.
  React.useEffect(() => {
    if (mobileOpen) mobileCloseRef.current?.focus();
  }, [mobileOpen]);

  // Lock body scroll when mobile drawer open
  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const desktopContent = (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div className={cn("flex items-center border-b border-border/60 h-14 shrink-0", collapsed ? "justify-center px-0" : "px-4")}>
        {!collapsed && (
          <span className="mono-label text-lime text-sm truncate">HASHCODE</span>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Ouvrir le menu" : "Réduire le menu"}
          aria-expanded={!collapsed}
          className={cn(
            "min-h-[32px] min-w-[32px] size-8 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-lime/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset ml-auto shrink-0",
            collapsed && "ml-0",
          )}
        >
          {collapsed ? <ChevronRight className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
        </button>
      </div>

      {/* Nav */}
      <nav aria-label="Navigation admin" className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {ITEMS.map((item) => (
          <NavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            active={activeSection === item.id}
            collapsed={collapsed}
            onClick={() => handleNav(item.id)}
          />
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border/60 shrink-0">
          <p className="text-muted-foreground mono-label">v2.0 · Admin</p>
        </div>
      )}
    </div>
  );

  const mobileContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-border/60 h-14 shrink-0 px-4">
        <span className="mono-label text-lime text-sm truncate">HASHCODE</span>
      </div>
      <nav aria-label="Navigation admin" className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {ITEMS.map((item) => (
          <NavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            active={activeSection === item.id}
            collapsed={false}
            onClick={() => handleNav(item.id)}
          />
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-border/60 shrink-0">
        <p className="text-muted-foreground mono-label">v2.0 · Admin</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — calée sous le header (h-14) */}
      <aside
        aria-label="Menu de navigation admin"
        className={cn(
          "hidden md:flex flex-col bg-card border-r border-border/60 sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 transition-[width] duration-200 ease-in-out z-30",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {desktopContent}
      </aside>

      {/* Mobile overlay + drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => closeMobile(false)}
          aria-hidden="true"
        />
      )}
      <aside
        id="admin-mobile-nav"
        role="dialog"
        aria-labelledby="sidebar-title"
        aria-modal="true"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={cn(
          "md:hidden flex flex-col bg-card border-r border-border/60 fixed top-0 left-0 h-full z-50 transition-transform duration-200 ease-in-out w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <span id="sidebar-title" className="sr-only">Menu de navigation admin</span>
        <button
          ref={mobileCloseRef}
          type="button"
          className="absolute top-3 right-3 size-8 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-lime/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset"
          onClick={() => closeMobile(true)}
          aria-label="Fermer le menu"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {mobileContent}
      </aside>

      {/* Mobile — bouton menu en bas à droite, hors zone de pagination */}
      {!mobileOpen && (
        <button
          ref={mobileOpenRef}
          type="button"
          className="md:hidden fixed bottom-5 right-5 z-30 min-h-[48px] min-w-[48px] size-12 flex items-center justify-center rounded-full bg-lime text-black shadow-lg hover:bg-lime/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
          onClick={() => setMobileOpen(true)}
          aria-label="Ouvrir le menu de navigation"
          aria-expanded={mobileOpen}
          aria-controls="admin-mobile-nav"
        >
          <LayoutDashboard className="size-5" aria-hidden />
        </button>
      )}
    </>
  );
}
