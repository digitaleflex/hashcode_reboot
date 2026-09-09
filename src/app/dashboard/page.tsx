import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buildAccountData } from "@/lib/account-data";
import { WelcomeCard } from "./_components/WelcomeCard";
import { StatusCard } from "./_components/StatusCard";
import { QuickActions } from "./_components/QuickActions";
import { ProfileSummary } from "./_components/ProfileSummary";
import { AgendaCard } from "./_components/AgendaCard";

/**
 * Dashboard membre — vue d'ensemble.
 * Le layout (layout.tsx) gère le header + sidebar.
 */
export default async function DashboardPage() {
  const session = await import("@/lib/account-auth").then((m) =>
    m.getSession(),
  );
  if (!session) redirect("/login?next=/dashboard");

  const member = await db.member.findUnique({
    where: { id: session.member.id },
  });
  if (!member || member.deletedAt) redirect("/login?next=/dashboard");

  const data = buildAccountData(member);

  return (
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

      <AgendaCard />

      {/* Membre depuis */}
      <p className="text-center text-xs text-muted-foreground pt-4">
        Membre depuis{" "}
        {new Date(data.member.createdAt).toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
