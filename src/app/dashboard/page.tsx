import { redirect } from "next/navigation";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { buildAccountData } from "@/lib/account-data";
import { Logo } from "@/components/brand/logo";
import { DashboardSidebar } from "./_components/DashboardSidebar";
import { WelcomeCard } from "./_components/WelcomeCard";
import { StatusCard } from "./_components/StatusCard";
import { QuickActions } from "./_components/QuickActions";
import { ProfileSummary } from "./_components/ProfileSummary";
import { LogoutButton } from "@/app/account/logout-button";

export const dynamic = "force-dynamic";

/**
 * Dashboard membre — espace personnel post-login.
 * Vue d'ensemble avec statut, profil, actions rapides.
 */
export default async function DashboardPage() {
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
        {/* Sidebar */}
        <DashboardSidebar />

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto bg-muted/10">
          <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-6">
            <WelcomeCard
              firstName={data.member.firstName}
              profile={data.profile}
              status={data.status}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatusCard status={data.status} />
              <ProfileSummary profile={data.profile} member={data.member} />
            </div>

            <QuickActions
              communityStatus={data.status.communityStatus}
              profileStatus={data.status.profileStatus}
            />

            {/* Membre depuis */}
            <p className="text-center text-xs text-muted-foreground pt-4">
              Membre depuis{" "}
              {new Date(data.member.createdAt).toLocaleDateString("fr-FR", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
