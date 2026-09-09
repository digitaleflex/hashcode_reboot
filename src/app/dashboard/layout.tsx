import { redirect } from "next/navigation";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { buildAccountData } from "@/lib/account-data";
import { Logo } from "@/components/brand/logo";
import { DashboardSidebar } from "./_components/DashboardSidebar";
import { LogoutButton } from "@/app/account/logout-button";

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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 h-14 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-3">
              <Logo className="size-6 text-lime shrink-0" />
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {data.member.firstName}
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
        <main className="flex-1 min-w-0 overflow-auto bg-muted/10 pb-16 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
