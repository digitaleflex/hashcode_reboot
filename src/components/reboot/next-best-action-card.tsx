"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel, RebootButton, CtaArrow } from "./shared";
import type { OrientationResult } from "@/lib/orientation/types";

/**
 * Carte "Next Best Action" — la sortie opérationnelle du moteur d'orientation.
 *
 * Présentation pure : reçoit une action déjà calculée côté serveur
 * (`POST /api/members` → `nextBestAction` + `orientationStatus`).
 * Aucun appel réseau, aucun scoring ici.
 *
 * États :
 *  - OK + action → CTA principal actionnable ;
 *  - INSUFFICIENT_DATA → invitation sobre à compléter le profil ;
 *  - NO_MATCH (ou OK sans action) → message honnête + repli événements.
 */

type NBAStatus = OrientationResult["status"];
type NBA = OrientationResult["nextBestAction"];

const TYPE_LABELS: Record<string, string> = {
  challenge: "Challenge",
  workshop: "Atelier",
  project: "Projet",
  community: "Communauté",
  mentoring: "Mentorat",
  learning_path: "Parcours",
  event: "Événement",
  content: "Contenu",
};

export function NextBestActionCard({
  action,
  status,
  href,
  className,
  onCompleteProfile,
}: {
  action: NBA;
  status: NBAStatus;
  /** Destination du CTA principal (défaut : agenda des événements). */
  href?: string;
  className?: string;
  /** Appelé pour "Compléter mon profil" (état INSUFFICIENT_DATA). */
  onCompleteProfile?: () => void;
}) {
  const target = href ?? "/evenements";

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-card overflow-hidden",
        className,
      )}
      role="region"
      aria-label="Prochaine étape recommandée"
    >
      {/* Top hairline + corner ticks (même motif que ProfileCard) */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime/70 to-transparent" />
      <div className="absolute top-2 left-2 text-lime/50 mono-label text-[8px]" aria-hidden>
        ┌
      </div>
      <div className="absolute top-2 right-2 text-lime/50 mono-label text-[8px]" aria-hidden>
        ┐
      </div>
      {/* Bottom-left lime glow */}
      <div
        className="absolute -bottom-12 -left-12 size-32 rounded-full blur-3xl opacity-[0.05] pointer-events-none"
        style={{ background: "var(--primary)" }}
        aria-hidden
      />

      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <MonoLabel className="text-muted-foreground">
            Prochaine étape
          </MonoLabel>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-lime/40 bg-lime/5 text-lime mono-label">
            <span className="size-1 rounded-full bg-lime animate-hash-pulse" aria-hidden />
            ORIENTATION
          </span>
        </div>

        {status === "OK" && action ? (
          <div className="mt-4">
            <p className="mono-label text-lime">
              {TYPE_LABELS[action.type] ?? action.type}
            </p>
            <h3 className="mt-1.5 font-display font-bold text-xl sm:text-2xl tracking-tight text-foreground">
              {action.id
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {action.reason}
            </p>
            <Link
              href={target}
              className="group mt-5 inline-flex min-h-[44px] w-full sm:w-auto"
            >
              <RebootButton size="lg" className="w-full sm:w-auto">
                Commencer
                <CtaArrow />
              </RebootButton>
            </Link>
          </div>
        ) : status === "INSUFFICIENT_DATA" ? (
          <div className="mt-4">
            <h3 className="font-display font-bold text-xl tracking-tight text-foreground">
              Encore une étape pour te guider
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Ton profil manque encore d&apos;informations pour te recommander
              la bonne prochaine étape. Complète-le, on s&apos;occupe du reste.
            </p>
            {onCompleteProfile && (
              <RebootButton
                size="lg"
                variant="outline"
                className="mt-5 w-full sm:w-auto"
                onClick={onCompleteProfile}
              >
                Compléter mon profil
                <ArrowRight className="size-4" aria-hidden />
              </RebootButton>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <h3 className="font-display font-bold text-xl tracking-tight text-foreground">
              Aucune activité adaptée pour le moment
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Rien ne correspond à ton profil dans les activités en cours.
              Explore l&apos;agenda — de nouvelles sessions arrivent
              régulièrement.
            </p>
            <Link
              href={target}
              className="group mt-5 inline-flex min-h-[44px] w-full sm:w-auto"
            >
              <RebootButton size="lg" variant="outline" className="w-full sm:w-auto">
                Voir les événements
                <CtaArrow />
              </RebootButton>
            </Link>
          </div>
        )}
      </div>

      {/* Bottom hairline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
    </div>
  );
}
