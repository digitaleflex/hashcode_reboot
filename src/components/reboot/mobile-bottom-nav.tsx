"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  User,
  Settings,
  Shield,
  Users,
  Mail,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const DASHBOARD_ITEMS: NavItem[] = [
  { label: "Accueil", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/dashboard/agenda", icon: Calendar },
  { label: "Profil", href: "/dashboard/profile", icon: User },
  { label: "Paramètres", href: "/dashboard/settings", icon: Settings },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: "Accueil", href: "/admin/stats", icon: LayoutDashboard },
  { label: "Événements", href: "/admin/events", icon: Calendar },
  { label: "Membres", href: "/admin/members", icon: Users },
  { label: "Paramètres", href: "/admin/settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  const isAdmin = pathname.startsWith("/admin");
  const items = isAdmin ? ADMIN_ITEMS : DASHBOARD_ITEMS;

  // Safe active check: exact for root items, prefix for sub-routes
  const isActive = (href: string) =>
    href === "/dashboard" || href === "/admin/stats"
      ? pathname === href || pathname.startsWith(href + "/")
      : pathname.startsWith(href);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-md border-t border-border/60 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      <div className="flex items-stretch min-h-[56px]">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1",
                "transition-colors duration-150 cursor-pointer",
                active
                  ? "text-lime"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="text-[11px] leading-tight">
                {item.label}
              </span>
              {/* Active indicator */}
              {active && (
                <span className="absolute -top-px left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-lime" />
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
