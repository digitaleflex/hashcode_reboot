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
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
        active
          ? "bg-lime/10 text-lime"
          : "text-muted-foreground hover:bg-lime/5 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-lime" : "text-muted-foreground group-hover:text-foreground",
        )}
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

  function handleNav(sectionId: string) {
    onNavigate?.(sectionId);
    setMobileOpen(false);
    if (typeof document !== "undefined") {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  // Close drawer on Esc
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div className={cn("flex items-center border-b border-border/60 h-14 shrink-0", collapsed ? "justify-center px-0" : "px-4")}>
        {!collapsed && (
          <span className="mono-label text-lime text-sm truncate">HASHCODE</span>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Ouvrir le menu" : "Réduire le menu"}
          aria-expanded={!collapsed}
          className={cn(
            "size-8 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-lime/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset ml-auto shrink-0",
            collapsed && "ml-0",
          )}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
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
          <p className="text-[10px] text-muted-foreground mono-label">v2.0 · Admin</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        aria-label="Menu de navigation admin"
        className={cn(
          "hidden md:flex flex-col bg-card border-r border-border/60 sticky top-0 h-screen shrink-0 transition-[width] duration-200 ease-in-out z-40",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay + drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        role="dialog"
        aria-labelledby="sidebar-title"
        aria-modal="true"
        className={cn(
          "md:hidden flex flex-col bg-card border-r border-border/60 fixed top-0 left-0 h-full z-50 transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full",
        )}
      >
        <span id="sidebar-title" className="sr-only">Menu de navigation admin</span>
        <button
          className="absolute top-3 right-3 size-8 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-lime/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer le menu"
        >
          <ChevronLeft className="size-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Mobile hamburger — shown when drawer is closed */}
      {!mobileOpen && (
        <button
          className="md:hidden fixed bottom-4 left-4 z-30 size-10 flex items-center justify-center rounded-full bg-lime text-background shadow-md hover:bg-lime/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
          onClick={() => setMobileOpen(true)}
          aria-label="Ouvrir le menu de navigation"
        >
          <LayoutDashboard className="size-5" />
        </button>
      )}
    </>
  );
}
