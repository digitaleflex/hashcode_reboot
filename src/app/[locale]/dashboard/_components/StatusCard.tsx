import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Hourglass,
  XCircle,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AccountStatus } from "@/app/[locale]/account/_components/types";

/**
 * Carte statut — état du profil + de la communauté.
 * Server component.
 */
export async function StatusCard({ status }: { status: AccountStatus }) {
  const t = await getTranslations("dashboard.profile");

  const profileIcon = {
    APPROVED: <CheckCircle2 className="size-5 text-lime" />,
    PENDING: <Clock className="size-5 text-amber-400" />,
    WAITLIST: <Hourglass className="size-5 text-blue-400" />,
    REJECTED: <XCircle className="size-5 text-red-400" />,
  }[status.profileStatus];

  const profileLabel = {
    APPROVED: t("statusCard.profile.approved"),
    PENDING: t("statusCard.profile.pending"),
    WAITLIST: t("statusCard.profile.waitlist"),
    REJECTED: t("statusCard.profile.rejected"),
  }[status.profileStatus];

  const communityLabelMap = {
    NOT_INVITED: t("statusCard.community.notInvited"),
    INVITED: t("statusCard.community.invited"),
    JOINED: t("statusCard.community.joined"),
  } as const;

  const communityLabel = communityLabelMap[
    status.communityStatus as keyof typeof communityLabelMap
  ] ?? status.communityStatus;

  const accessLabel = status.accessLane === "immediate"
    ? t("statusCard.access.immediate")
    : t("statusCard.access.pending");

  const accessIcon = status.accessLane === "immediate"
    ? "✓"
    : "…";

  const accessIconClass = status.accessLane === "immediate"
    ? "bg-lime/20 text-lime"
    : "bg-amber-500/20 text-amber-400";

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 space-y-4">
      <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase">
        {t("statusCard.title")}
      </h2>

      <div className="space-y-3">
        {/* Profil */}
        <div className="flex items-center gap-3">
          {profileIcon}
          <div>
            <p className="text-sm font-medium">{t("statusCard.profile.label")}</p>
            <p className="text-xs text-muted-foreground">{profileLabel}</p>
          </div>
        </div>

        {/* Communauté */}
        <div className="flex items-center gap-3">
          <Users className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{t("statusCard.community.label")}</p>
            <p className="text-xs text-muted-foreground">{communityLabel}</p>
          </div>
        </div>

        {/* Accès */}
        <div className="flex items-center gap-3">
          <div
            className={`size-5 rounded-full flex items-center justify-center text-xs font-bold ${accessIconClass}`}
          >
            {accessIcon}
          </div>
          <div>
            <p className="text-sm font-medium">{t("statusCard.access.label")}</p>
            <p className="text-xs text-muted-foreground">{accessLabel}</p>
          </div>
        </div>
      </div>
    </section>
  );
}