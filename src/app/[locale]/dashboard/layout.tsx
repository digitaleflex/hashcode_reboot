import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { selectMessages } from "@/i18n/client-messages";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { buildAccountData } from "@/lib/account-data";
import { Logo } from "@/components/brand/logo";
import { DashboardSidebar } from "./_components/DashboardSidebar";
import { LogoutButton } from "@/app/[locale]/account/logout-button";
import { MobileBottomNav } from "@/components/reboot/mobile-bottom-nav";

export const dynamic = "force-dynamic";

/**
 * Layout partagé du dashboard membre.
 * Contient la top bar + sidebar. Persiste sur toutes les routes /dashboard/*
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/dashboard");
  }

  const member = await db.member.findUnique({
    where: { id: session.member.id },
  });
  if (!member || member.deletedAt) {
    redirect("/login?next=/dashboard");
  }

  const data = buildAccountData(member);

  // Le layout racine exclut `dashboard` du payload public : on le réinjecte ici
  // (avec le reste, moins `admin` qui ne sert pas dans l'espace membre).
  const locale = await getLocale();
  const messages = selectMessages(await getMessages({ locale }), ["admin"]);

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="glass sticky top-0 z-40 h-16 border-b border-[var(--line-soft)]">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-3 rounded-md focus-lime" aria-label="HASHCODE REBOOT — accueil">
              {/* `size-6` sur le wordmark complet l'écrasait dans 24px. */}
              <Logo variant="compact" size="sm" />
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2.5 sm:inline-flex">
              <span className="grid size-8 place-items-center rounded-full bg-lime/15 font-display text-sm font-bold text-lime">
                {data.member.firstName.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm text-foreground">{data.member.firstName}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar (responsive: drawer mobile + sidebar desktop) */}
        <DashboardSidebar
          firstName={data.member.firstName}
        />

        {/* Main content */}
        <main className="relative flex-1 min-w-0 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>
      <MobileBottomNav />
      </div>
    </NextIntlClientProvider>
  );
}
