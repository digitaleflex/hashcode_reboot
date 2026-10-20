import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CheckCircle2, Clock3, Flag, RotateCcw } from "lucide-react";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Statuts d'assignation considérés comme « en cours » côté membre. */
const ACTIVE_STATUSES = ["UPCOMING", "ACTIVE", "SUBMITTED", "REJECTED"] as const;

/**
 * /dashboard/missions — parcours membre des missions (#232).
 *
 * Server Component : lit directement la base (aucun appel réseau interne).
 * Les écritures (démarrer / soumettre / abandonner) restent dans les API
 * `/api/missions/[id]/*`, avec CSRF + session vérifiées côté serveur.
 */
export default async function MissionsPage() {
  const t = await getTranslations("dashboard.missions.list");
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/missions");

  const memberId = session.member.id;

  const [missions, assignments] = await Promise.all([
    db.mission.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        domain: true,
        level: true,
      },
    }),
    db.missionAssignment.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        missionId: true,
        status: true,
        createdAt: true,
        validatedAt: true,
      },
    }),
  ]);

  // La dernière assignation fait foi (reparier après abandon = nouvelle ligne).
  const latestByMission = new Map<string, (typeof assignments)[number]>();
  for (const assignment of assignments) {
    if (!latestByMission.has(assignment.missionId)) {
      latestByMission.set(assignment.missionId, assignment);
    }
  }

  const withState = missions.map((mission) => ({
    mission,
    assignment: latestByMission.get(mission.id) ?? null,
  }));

  const active = withState.filter(
    (item) =>
      item.assignment !== null &&
      (ACTIVE_STATUSES as readonly string[]).includes(item.assignment.status),
  );
  const available = withState.filter((item) => item.assignment === null);
  const done = withState.filter(
    (item) => item.assignment?.status === "VALIDATED",
  );
  const history = withState.filter(
    (item) => item.assignment?.status === "ABANDONED",
  );

  // Progression sur la dernière assignation de chaque mission. Les missions
  // abandonnées ne comptent pas : elles ne sont ni en cours ni validées.
  const STARTED_STATUSES = ["ACTIVE", "SUBMITTED", "REJECTED", "VALIDATED"];
  const started = withState.filter(
    (item) =>
      item.assignment !== null &&
      STARTED_STATUSES.includes(item.assignment.status),
  ).length;
  const validated = done.length;
  const percent = started === 0 ? 0 : Math.round((validated / started) * 100);

  const domainLabel = (domain: string) => {
    if (domain === "web") return t("domainWeb");
    if (domain === "cybersecurity") return t("domainCyber");
    if (domain === "ai") return t("domainAi");
    return domain;
  };
  const levelLabel = (level: string) => {
    if (level === "beginner") return t("levelBeginner");
    if (level === "practicing") return t("levelPracticing");
    if (level === "autonomous") return t("levelAutonomous");
    if (level === "advanced") return t("levelAdvanced");
    return level;
  };
  const statusLabel = (status: string) => {
    switch (status) {
      case "UPCOMING":
        return t("statusUpcoming");
      case "ACTIVE":
        return t("statusActive");
      case "SUBMITTED":
        return t("statusSubmitted");
      case "VALIDATED":
        return t("statusValidated");
      case "REJECTED":
        return t("statusRejected");
      case "ABANDONED":
        return t("statusAbandoned");
      default:
        return status;
    }
  };
  const statusClass = (status: string) => {
    switch (status) {
      case "VALIDATED":
        return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
      case "SUBMITTED":
        return "border-amber-400/40 bg-amber-400/10 text-amber-300";
      case "REJECTED":
        return "border-orange-400/40 bg-orange-400/10 text-orange-300";
      case "ABANDONED":
        return "border-border/60 bg-secondary/50 text-muted-foreground";
      case "ACTIVE":
      case "UPCOMING":
        return "border-lime/40 bg-lime/10 text-lime";
      default:
        return "border-border/60 bg-secondary/50 text-muted-foreground";
    }
  };
  const ctaLabel = (status: string | null) => {
    if (status === null) return t("ctaStart");
    if (status === "ABANDONED") return t("ctaRestart");
    if (status === "ACTIVE" || status === "REJECTED" || status === "UPCOMING") {
      return t("ctaContinue");
    }
    return t("ctaFollow");
  };

  return (
    <div className="mx-auto max-w-5xl w-full px-5 sm:px-8 py-8 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-lime">
          <Flag className="size-5" aria-hidden />
          <span className="mono-label">CHALLENGES</span>
        </div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t("subtitle")}
        </p>
      </header>

      {/* Progression globale */}
      <section
        aria-label={t("progress", { validated, started })}
        className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {t("progress", { validated, started })}
          </span>
          <span className="font-medium text-lime">
            {t("completion", { percent })}
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-lime transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>

      {missions.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/40 px-6 py-12 text-center">
          <Flag className="size-12 text-muted-foreground/20 mx-auto mb-4" aria-hidden />
          <p className="text-muted-foreground">{t("empty")}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{t("emptySub")}</p>
        </div>
      ) : (
        <>
          <MissionSection
            title={t("sectionActive")}
            empty={t("noActive")}
            icon={<Clock3 className="size-4" aria-hidden />}
          >
            {active.map(({ mission, assignment }) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                statusLabel={
                  assignment ? statusLabel(assignment.status) : null
                }
                statusClass={
                  assignment ? statusClass(assignment.status) : undefined
                }
                cta={ctaLabel(assignment?.status ?? null)}
                ctaAria={t("ctaAria", { title: mission.title })}
                domainLabel={domainLabel(mission.domain)}
                levelLabel={levelLabel(mission.level)}
              />
            ))}
          </MissionSection>

          <MissionSection
            title={t("sectionAvailable")}
            empty={t("noAvailable")}
            icon={<Flag className="size-4" aria-hidden />}
          >
            {available.map(({ mission }) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                statusLabel={null}
                cta={ctaLabel(null)}
                ctaAria={t("ctaAria", { title: mission.title })}
                domainLabel={domainLabel(mission.domain)}
                levelLabel={levelLabel(mission.level)}
              />
            ))}
          </MissionSection>

          {done.length > 0 && (
            <MissionSection
              title={t("sectionDone")}
              icon={<CheckCircle2 className="size-4" aria-hidden />}
            >
              {done.map(({ mission, assignment }) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  statusLabel={
                    assignment ? statusLabel(assignment.status) : null
                  }
                  statusClass={
                    assignment ? statusClass(assignment.status) : undefined
                  }
                  cta={ctaLabel(assignment?.status ?? null)}
                  ctaAria={t("ctaAria", { title: mission.title })}
                  domainLabel={domainLabel(mission.domain)}
                  levelLabel={levelLabel(mission.level)}
                />
              ))}
            </MissionSection>
          )}

          {history.length > 0 && (
            <MissionSection
              title={t("sectionHistory")}
              icon={<RotateCcw className="size-4" aria-hidden />}
            >
              {history.map(({ mission, assignment }) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  statusLabel={
                    assignment ? statusLabel(assignment.status) : null
                  }
                  statusClass={
                    assignment ? statusClass(assignment.status) : undefined
                  }
                  cta={ctaLabel(assignment?.status ?? null)}
                  ctaAria={t("ctaAria", { title: mission.title })}
                  domainLabel={domainLabel(mission.domain)}
                  levelLabel={levelLabel(mission.level)}
                />
              ))}
            </MissionSection>
          )}
        </>
      )}
    </div>
  );
}

function MissionSection({
  title,
  empty,
  icon,
  children,
}: {
  title: string;
  empty?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const nodes = Array.isArray(children) ? children : [children];
  if (nodes.every((node) => node === null || node === false)) {
    if (!empty) return null;
    return (
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 mono-label text-muted-foreground uppercase">
          {icon}
          {title}
        </h2>
        <p className="text-sm text-muted-foreground/70">{empty}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 mono-label text-muted-foreground uppercase">
        {icon}
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function MissionCard({
  mission,
  statusLabel,
  statusClass,
  cta,
  ctaAria,
  domainLabel,
  levelLabel,
}: {
  mission: {
    id: string;
    title: string;
    description: string | null;
    domain: string;
    level: string;
  };
  statusLabel: string | null;
  statusClass?: string;
  cta: string;
  ctaAria: string;
  domainLabel: string;
  levelLabel: string;
}) {
  return (
    <article className="rounded-lg border border-border/60 bg-card/40 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display font-bold text-lg tracking-tight">
          {mission.title}
        </h3>
        {statusLabel && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium",
              statusClass,
            )}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {mission.description && (
        <p className="text-sm text-muted-foreground line-clamp-3">
          {mission.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {domainLabel}
        </span>
        <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {levelLabel}
        </span>
      </div>

      <div className="mt-auto pt-1">
        <Link
          href={`/dashboard/missions/${mission.id}`}
          aria-label={ctaAria}
          className="inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-lime/90 focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
        >
          {cta}
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
