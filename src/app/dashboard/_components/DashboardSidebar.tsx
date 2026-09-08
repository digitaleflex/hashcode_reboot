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
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/dashboard/agenda", icon: Calendar },
  { label: "Mon profil", href: "/dashboard/profile", icon: User },
  { label: "Paramètres", href: "/dashboard/settings", icon: Settings },
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border/60 bg-card/40 min-h-0">
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
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
    </aside>
  );
}
