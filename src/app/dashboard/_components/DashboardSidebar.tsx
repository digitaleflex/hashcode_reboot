"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Settings,
  MessageCircle,
  Calendar,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/dashboard/agenda", icon: Calendar },
  { label: "Mon profil", href: "/dashboard/profile", icon: User },
  { label: "Paramètres", href: "/dashboard/settings", icon: Settings },
] as const;

const BOTTOM_ITEMS = [
  {
    label: "WhatsApp",
    href: "/api/community/join",
    icon: MessageCircle,
    external: true,
  },
] as const;

interface DashboardSidebarProps {
  firstName?: string;
  onLogout?: () => void;
}

/* ───────────────────────────────────────────
 *  Composant lien Nav — réutilisable partout
 * ─────────────────────────────────────────── */
function NavLink({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: { label: string; href: string; icon: React.ElementType; external?: boolean };
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "w-full flex items-center gap-3 rounded-md text-sm transition-all duration-150 cursor-pointer group relative",
        collapsed ? "justify-center px-0 py-2.5 mx-auto w-10" : "px-3 py-2.5",
        active
          ? "bg-lime/10 text-lime font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary",
      )}
    >
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}

      {/* Tooltip quand replié */}
      {collapsed && (
        <span className="absolute left-full ml-2 px-2.5 py-1 rounded-md bg-popover text-popover-foreground text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-md border border-border/60 z-50">
          {item.label}
        </span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════
 *  Sidebar principale
 * ═══════════════════════════════════════════ */
export function DashboardSidebar({ firstName }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // ── État replié (desktop) — persister dans localStorage ──
  const [collapsed, setCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Hydrate depuis localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved !== null) setCollapsed(saved === "true");
    } catch {}
    setMounted(true);
  }, []);

  // Sauvegarder à chaque changement
  React.useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("sidebar-collapsed", String(collapsed));
    } catch {}
  }, [collapsed, mounted]);

  // ── État mobile ──
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Fermer le drawer mobile quand on navigue
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape pour fermer le mobile
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    if (mobileOpen) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [mobileOpen]);

  // Lock body scroll quand mobile ouvert
  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  // ── Déterminer lien actif ──
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname === "/dashboard/"
      : pathname.startsWith(href);

  // ── Contenu nav (réutilisable desktop + mobile) ──
  const renderNav = (isCollapsed: boolean) => (
    <>
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            collapsed={isCollapsed}
            onClick={() => {
              router.push(item.href);
              setMobileOpen(false);
            }}
          />
        ))}
      </nav>

      <div className="px-2 pb-4 space-y-1 border-t border-border/60 pt-3">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={false}
            collapsed={isCollapsed}
            onClick={() => {
              window.open(item.href, "_blank", "noopener,noreferrer");
              setMobileOpen(false);
            }}
          />
        ))}

        {/* Bouton déconnexion */}
        <NavLink
          item={{ label: "Déconnexion", href: "#", icon: LogOut }}
          active={false}
          collapsed={isCollapsed}
          onClick={async () => {
            try {
              await fetch("/api/auth/logout", { method: "POST" });
            } catch {
              /* best effort */
            }
            setMobileOpen(false);
            router.push("/login");
            router.refresh();
          }}
        />
      </div>
    </>
  );

  return (
    <>
      {/* ── HAMBURGER MOBILE (FAB bottom-left) ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className={cn(
          "md:hidden fixed bottom-5 left-5 z-50 size-12 rounded-full",
          "bg-lime text-background shadow-lg shadow-lime/20",
          "flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform cursor-pointer",
        )}
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" />
      </button>

      {/* ── OVERLAY + DRAWER MOBILE ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50",
          "w-72 bg-card border-r border-border/60",
          "flex flex-col",
          "transition-transform duration-250 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header drawer */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo className="size-5 text-lime shrink-0" />
            {firstName && (
              <span className="text-sm font-medium truncate">{firstName}</span>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Fermer le menu"
          >
            <X className="size-4" />
          </button>
        </div>

        {renderNav(false)}
      </aside>

      {/* ── SIDEBAR DESKTOP (≥ md) — pliable ── */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border/60 bg-card/40 min-h-0",
          "transition-all duration-200 ease-in-out shrink-0",
          collapsed ? "w-[60px]" : "w-56",
        )}
      >
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {renderNav(collapsed)}
        </div>

        {/* Bouton replier/déplier */}
        <div className="px-2 pb-3 pt-1 border-t border-border/60">
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Déplier la sidebar" : "Replier la sidebar"}
            className={cn(
              "w-full flex items-center gap-3 rounded-md text-sm transition-all cursor-pointer",
              collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
              "text-muted-foreground hover:text-foreground hover:bg-secondary",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="size-4 shrink-0" />
            ) : (
              <>
                <ChevronsLeft className="size-4 shrink-0" />
                <span className="truncate">Replier</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
