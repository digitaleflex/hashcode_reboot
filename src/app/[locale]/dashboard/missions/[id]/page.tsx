import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flag,
  MessageSquareQuote,
} from "lucide-react";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { MissionActions } from "./MissionActions";

export const dynamic = "force-dynamic";

const DOMAIN_KEYS: Record<string, string> = {
  web: "domainWeb",
  cybersecurity: "domainCyber",
  ai: "domainAi",
};
const LEVEL_KEYS: Record<string, string> = {
  beginner: "levelBeginner",
  practicing: "levelPracticing",
  autonomous: "levelAutonomous",
  advanced: "levelAdvanced",
};
const STATUS_KEYS: Record<string, string> = {
  UPCOMING: "statusUpcoming",
  ACTIVE: "statusActive",
  SUBMITTED: "statusSubmitted",
  VALIDATED: "statusValidated",
  REJECTED: "statusRejected",
  ABANDONED: "statusAbandoned",
};
const DECISION_KEYS: Record<string, string> = {
  APPROVED: "decisionApproved",
  REVISION: "decisionRevision",
  REJECTED: "decisionRejected",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * /dashboard/missions/[id] — détail d'une mission et suivi des réalisations.
 *
 * Lecture directe en base (Server Component) : la mission doit être PUBLISHED,
 * sinon 404 (un brouillon n'est jamais révélé). Les actions passent par les
 * API serveur, qui revérifient session/CSRF/transitions.
 */
export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("dashboard.missions.detail");
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect(`/login?next=/dashboard/missions/${id}`);

  const mission = await db.mission.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      domain: true,
      level: true,
      sourceRef: true,
    },
  });
  if (!mission) notFound();

  const memberId = session.member.id;
  const [assignments, submissions] = await Promise.all([
    db.missionAssignment.findMany({
      where: { missionId: id, memberId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        validatedAt: true,
        abandonedAt: true,
      },
    }),
    db.missionSubmission.findMany({
      where: { missionId: id, memberId },
      orderBy: { attempt: "desc" },
      select: {
        id: true,
        attempt: true,
        content: true,
        status: true,
        submittedAt: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            decision: true,
            feedback: true,
            reviewer: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const latest = assignments[0] ?? null;
  const latestSubmission = submissions[0] ?? null;
  // Retour affiché uniquement s'il concerne la dernière tentative : sinon un
  // ancien feedback pourrait contredire le statut « en attente de revue ».
  const latestReview = latestSubmission?.reviews[0] ?? null;

  const isRevision =
    latest?.status === "ACTIVE" && latestSubmission?.status === "REVISION";
  const canStart = latest === null || latest.status === "ABANDONED";
  const restart = latest?.status === "ABANDONED";
  const canSubmit =
    latest !== null &&
    (latest.status === "ACTIVE" || latest.status === "REJECTED") &&
    !["PENDING", "IN_REVIEW"].includes(latestSubmission?.status ?? "");
  const canAbandon =
    latest?.status === "ACTIVE" || latest?.status === "UPCOMING";

  const statusText = (() => {
    if (!latest) return t("statusUpcoming");
    switch (latest.status) {
      case "UPCOMING":
        return t("statusUpcoming");
      case "ACTIVE":
        return isRevision ? t("statusRevision") : t("statusActive");
      case "SUBMITTED":
        return t("statusSubmitted");
      case "VALIDATED":
        return t("statusValidated");
      case "REJECTED":
        return t("statusRejected");
      case "ABANDONED":
        return t("statusAbandoned");
      default:
        return t("statusActive");
    }
  })();

  const statusTone =
    latest?.status === "VALIDATED"
      ? "border-emerald-400/40 bg-emerald-400/10"
      : latest?.status === "SUBMITTED"
        ? "border-amber-400/40 bg-amber-400/10"
        : latest?.status === "REJECTED" || isRevision
          ? "border-orange-400/40 bg-orange-400/10"
          : latest?.status === "ABANDONED"
            ? "border-border/60 bg-secondary/40"
            : "border-lime/40 bg-lime/10";

  const sourceIsUrl =
    mission.sourceRef !== null && /^https?:\/\//i.test(mission.sourceRef);

  return (
    <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-8">
      <Link
        href="/dashboard/missions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-5" aria-hidden />
        {t("back")}
      </Link>

      <header className="space-y-3">
        <div className="flex items-center gap-2 text-lime">
          <Flag className="size-5" aria-hidden />
          <span className="mono-label">MISSION</span>
        </div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
          {mission.title}
        </h1>
        {mission.description && (
          <p className="text-sm text-muted-foreground max-w-2xl whitespace-pre-line">
            {mission.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {DOMAIN_KEYS[mission.domain]
              ? t(DOMAIN_KEYS[mission.domain])
              : mission.domain}
          </span>
          <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {LEVEL_KEYS[mission.level]
              ? t(LEVEL_KEYS[mission.level])
              : mission.level}
          </span>
          {latest && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                latest.status === "VALIDATED"
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                  : latest.status === "SUBMITTED"
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    : "border-border/60 bg-secondary/50 text-muted-foreground",
              )}
            >
              {STATUS_KEYS[latest.status]
                ? t(STATUS_KEYS[latest.status])
                : latest.status}
            </span>
          )}
        </div>

        {mission.sourceRef && (
          <p className="text-sm text-muted-foreground">
            {t("source")} :{" "}
            {sourceIsUrl ? (
              <a
                href={mission.sourceRef}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-lime underline-offset-2 hover:underline"
              >
                {mission.sourceRef}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : (
              <span className="text-foreground">{mission.sourceRef}</span>
            )}
          </p>
        )}
      </header>

      {/* Statut courant */}
      <section
        aria-labelledby="mission-status-title"
        className={cn("rounded-lg border p-5 sm:p-6 space-y-2", statusTone)}
      >
        <h2
          id="mission-status-title"
          className="flex items-center gap-2 font-display font-bold text-base tracking-tight"
        >
          {latest?.status === "VALIDATED" ? (
            <CheckCircle2 className="size-5" aria-hidden />
          ) : (
            <Clock3 className="size-5" aria-hidden />
          )}
          {t("statusTitle")}
        </h2>
        <p className="text-sm">{statusText}</p>
        {latest?.createdAt && latest.status !== "ABANDONED" && (
          <p className="text-xs text-muted-foreground">
            {t("startedOn", { date: formatDate(latest.createdAt) })}
          </p>
        )}
        {latest?.validatedAt && (
          <p className="text-xs text-emerald-300">
            {t("validatedOn", { date: formatDate(latest.validatedAt) })}
          </p>
        )}
      </section>

      {/* Retour le plus récent */}
      {latestReview && (
        <section
          aria-labelledby="mission-feedback-title"
          className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 space-y-3"
        >
          <h2
            id="mission-feedback-title"
            className="flex items-center gap-2 font-display font-bold text-base tracking-tight"
          >
            <MessageSquareQuote className="size-5 text-lime" aria-hidden />
            {t("feedbackTitle")}
          </h2>
          <p className="text-sm font-medium">
            {DECISION_KEYS[latestReview.decision]
              ? t(DECISION_KEYS[latestReview.decision])
              : latestReview.decision}
          </p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {latestReview.feedback}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("reviewer", { reviewer: latestReview.reviewer })} ·{" "}
            {formatDate(latestReview.createdAt)}
          </p>
        </section>
      )}

      {/* Actions */}
      <section aria-label={t("statusTitle")}>
        <MissionActions
          missionId={mission.id}
          canStart={canStart}
          restart={restart}
          canSubmit={canSubmit}
          canAbandon={canAbandon}
          initialContent={
            canSubmit && latestSubmission ? latestSubmission.content : ""
          }
        />
      </section>

      {/* Historique des soumissions */}
      <section
        aria-labelledby="mission-history-title"
        className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 space-y-4"
      >
        <h2
          id="mission-history-title"
          className="font-display font-bold text-base tracking-tight"
        >
          {t("historyTitle")}
        </h2>

        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
        ) : (
          <ol className="space-y-3">
            {submissions.map((submission) => {
              const review = submission.reviews[0] ?? null;
              return (
                <li
                  key={submission.id}
                  className="rounded-md border border-border/50 bg-background/40 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {t("attempt", { attempt: submission.attempt })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(submission.submittedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {review
                      ? DECISION_KEYS[review.decision]
                        ? t(DECISION_KEYS[review.decision])
                        : review.decision
                      : t("reviewPending")}
                  </p>
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      {t("contentLabel")}
                    </summary>
                    <p className="mt-2 whitespace-pre-line text-sm text-foreground">
                      {submission.content}
                    </p>
                  </details>
                  {review && (
                    <div className="rounded-md border border-border/40 bg-card/50 px-3 py-2 space-y-1">
                      <p className="text-xs font-medium text-lime">
                        {t("feedbackTitle")}
                      </p>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {review.feedback}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("reviewer", { reviewer: review.reviewer })}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
