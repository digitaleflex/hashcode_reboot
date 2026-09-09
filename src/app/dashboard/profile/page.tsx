import { redirect } from "next/navigation";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { buildAccountData } from "@/lib/account-data";
import { AccountHeader } from "@/app/account/_components/AccountHeader";
import { ProfileSummary } from "../_components/ProfileSummary";
import { StatusCard } from "../_components/StatusCard";
import { GoalEditor } from "./_components/GoalEditor";
import { ShareProfile } from "./_components/ShareProfile";

export const dynamic = "force-dynamic";

/**
 * /dashboard/profile — vitrine membre + objectif éditable + partage public.
 */
export default async function DashboardProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/profile");

  const member = await db.member.findUnique({
    where: { id: session.member.id },
  });
  if (!member || member.deletedAt) redirect("/login?next=/dashboard/profile");

  const data = buildAccountData(member);

  return (
    <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-6">
      <header>
        <h1 className="font-display font-bold text-2xl tracking-tight">
          Mon profil
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ta vitrine membre, ton objectif et ton lien public.
        </p>
      </header>

      <AccountHeader
        member={data.member}
        profile={data.profile}
        status={data.status}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProfileSummary profile={data.profile} member={data.member} />
        <StatusCard status={data.status} />
      </div>

      <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6">
        <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase mb-4">
          Objectif à 3 mois
        </h2>
        <GoalEditor initialGoal={data.member.threeMonthGoal} />
      </section>

      <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6">
        <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase mb-2">
          Profil public
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Partage ton positionnement dans la communauté, ton CV ou WhatsApp.
        </p>
        <ShareProfile memberId={data.member.id} />
      </section>
    </div>
  );
}
