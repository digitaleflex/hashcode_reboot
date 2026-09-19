import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { buildAccountData } from "@/lib/account-data";
import { WelcomeCard } from "./_components/WelcomeCard";
import { StatusCard } from "./_components/StatusCard";
import { QuickActions } from "./_components/QuickActions";
import { ProfileSummary } from "./_components/ProfileSummary";
import { AgendaCard } from "./_components/AgendaCard";
import { NextSteps } from "@/app/account/_components/NextSteps";

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

  // Profil invité jamais complété (ex : import) → parcours de confirmation.
  if (member.profileStatus === "PENDING" && !member.goal?.trim()) {
    redirect("/dashboard/profile-complet");
  }

  const data = buildAccountData(member);

  return (
    <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-6">
      {/* Nudge WhatsApp : le numéro n'est plus demandé à l'inscription —
          on le récupère ici s'il manque (ajout direct au groupe). */}
      {!member.phone && (
        <Link
          href="/dashboard/settings"
          className="block rounded-md border border-lime/40 bg-lime/[0.04] px-4 py-3 text-sm text-foreground transition-colors hover:border-lime/60"
        >
          <span className="font-medium">Ajoute ton WhatsApp</span>{" "}
          <span className="text-muted-foreground">
            pour qu&apos;on t&apos;ajoute directement au groupe — 10 secondes dans tes paramètres.
          </span>
        </Link>
      )}
      <WelcomeCard
        firstName={data.member.firstName}
        profile={data.profile}
        status={data.status}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatusCard status={data.status} />
        <ProfileSummary profile={data.profile} member={data.member} />
      </div>

      <NextSteps archetype={data.profile?.archetype ?? null} />

      <QuickActions
        communityStatus={data.status.communityStatus}
        profileStatus={data.status.profileStatus}
      />

      <AgendaCard />

      {/* Mentorship preview — links to dedicated mentoring page */}
      <Link
        href="/dashboard/mentoring"
        className="block rounded-xl border border-border/60 bg-card/40 p-6 space-y-4 hover:border-lime/40 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-lime/10 group-hover:bg-lime/20 transition-colors">
            <GraduationCap className="size-5 text-lime" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg">Votre mentorat</h3>
            <p className="text-sm text-muted-foreground">
              Suivi personnalisé et séances — bientôt disponible
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground ml-auto group-hover:text-lime transition-colors" />
        </div>
        <div className="text-sm text-muted-foreground">
          Votre mentor vous attend — en cours de préparation…
        </div>
      </Link>

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
