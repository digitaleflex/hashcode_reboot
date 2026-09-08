"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  MessageCircle,
  Calendar,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/dashboard/agenda", icon: Calendar },
  { label: "Mon profil", href: "/dashboard/profile", icon: User },
  { label: "Paramètres", href: "/dashboard/settings", icon: Settings },
] as const;

interface DashboardSidebarProps {
  firstName?: string;
  onLogout?: () => void;
}

export function DashboardSidebar({ firstName, onLogout }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Fermer le drawer quand on navigue
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Fermer avec Escape
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    if (mobileOpen) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [mobileOpen]);

  const navContent = (
    <>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/dashboard/"
              : pathname.startsWith(item.href);
          return (
            <button
              key={item.href}
              onClick={() => {
                router.push(item.href);
                setMobileOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer",
                active
                  ? "bg-lime/10 text-lime font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-4 space-y-1 border-t border-border/60 pt-3">
        <a
          href="https://chat.whatsapp.com/GBh0XJfGpPq3RJrmylVljl"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <MessageCircle className="size-4 shrink-0" />
          WhatsApp
        </a>
      </div>
    </>
  );

  return (
    <>
      {/* ── Hamburger mobile (visible < md) ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-4 left-4 z-50 size-12 rounded-full bg-lime text-background flex items-center justify-center shadow-lg hover:bg-lime/90 transition-colors cursor-pointer"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" />
      </button>

      {/* ── Overlay mobile ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Drawer mobile ── */}
      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border/60 flex flex-col transform transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header drawer */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Logo className="size-5 text-lime" />
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

        {navContent}
      </aside>

      {/* ── Sidebar desktop (visible >= md) ── */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border/60 bg-card/40 min-h-0">
        {navContent}
      </aside>
    </>
  );
}
