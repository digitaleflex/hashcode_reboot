import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { buildAccountData } from "@/lib/account-data";
import { WelcomeCard } from "./_components/WelcomeCard";
import { ActivationChecklist } from "./_components/ActivationChecklist";
import { OrientationSection } from "./_components/OrientationSection";
import { StatusCard } from "./_components/StatusCard";
import { QuickActions } from "./_components/QuickActions";
import { ProfileSummary } from "./_components/ProfileSummary";
import { AgendaCard } from "./_components/AgendaCard";
import { NextSteps } from "@/app/[locale]/account/_components/NextSteps";
import { getTranslations } from "next-intl/server";

/**
 * Dashboard membre — vue d'ensemble.
 * Le layout (layout.tsx) gère le header + sidebar.
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard.home");
  const session = await import("@/lib/account-auth").then((m) =>
    m.getSession(),
  );
  if (!session) redirect("/login?next=/dashboard");

  const member = await db.member.findUnique({
    where: { id: session.member.id },
  });
  if (!member || member.deletedAt) redirect("/login?next=/dashboard");

  // Profil invité jamais complété (ex : import) → parcours de confirmation.
  if (member.profileStatus === "PENDING" && !member.goal?.trim()) {
    redirect("/dashboard/profile-complet");
  }

  const data = buildAccountData(member);
  const enrollmentCount = await db.workshopEnrollment.count({
    where: { memberId: member.id },
  });

  return (
    <div className="mx-auto max-w-7xl w-full px-5 sm:px-8 lg:px-10 py-8 lg:py-10">
      <WelcomeCard
        firstName={data.member.firstName}
        profile={data.profile}
        status={data.status}
        memberSince={new Date(data.member.createdAt).toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        })}
      />

      {/* Checklist d'activation : remplace la bannière « Ajoute ton WhatsApp »
          (le numéro devient une étape parmi d'autres, avec progression). */}
      <div className="mt-6">
        <ActivationChecklist
          hasPhone={!!member.phone}
          joinedCommunity={member.communityStatus === "JOINED"}
          hasEnrollment={enrollmentCount > 0}
          hasGoal={!!member.threeMonthGoal?.trim()}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatusCard status={data.status} />
            <ProfileSummary profile={data.profile} member={data.member} />
          </div>
          <OrientationSection memberId={session.member.id} member={member} />
          <NextSteps archetype={data.profile?.archetype ?? null} />
        </div>
        <aside className="lg:col-span-4 space-y-6">
          <AgendaCard />
          <QuickActions
            communityStatus={data.status.communityStatus}
            profileStatus={data.status.profileStatus}
          />
          <Link
            href="/dashboard/mentoring"
            className="surface surface-interactive block p-6 space-y-4 group focus-lime"
          >
            <div className="flex items-center gap-3">
              <span className="icon-tile icon-tile--accent">
                <GraduationCap className="size-5" />
              </span>
              <div>
                <h3 className="font-display font-semibold text-lg">{t("mentoring.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("mentoring.subtitle")}</p>
              </div>
              <ArrowRight className="size-5 text-muted-foreground ml-auto group-hover:text-lime transition-colors" />
            </div>
            <div className="text-sm text-muted-foreground">{t("mentoring.description")}</div>
          </Link>
        </aside>
      </div>

    </div>
  );
}