"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import {
  RebootButton,
  ExternalCta,
} from "./shared";
import { ProfileCard } from "./profile-card";
import type { GeneratedProfile, ProfileAnswers } from "@/lib/profiling/types";
import type { OrientationResult } from "@/lib/orientation/types";
import { getReasonLabels } from "@/lib/profiling/auto-controls";
import { countryName, countryFlag } from "@/lib/profiling/countries";
import { track } from "@/lib/analytics";
import {
  ArrowUpRight,
  Check,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  Share2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { EmailVerificationNudge } from "./email-verify-card";
import { useTranslations } from "next-intl";
import { RecommendationExperience } from "./recommendation/recommendation-experience";
import { publicTagLabels } from "@/lib/profiling/public-tags";

export interface WelcomeResult {
  memberId: string;
  accessLane: "immediate" | "pending";
  profileStatus: string;
  communityStatus: string;
  reasons: string[];
  profile: GeneratedProfile;
  duplicate?: boolean;
  nextBestAction?: OrientationResult["nextBestAction"];
  orientationStatus?: OrientationResult["status"];
  orientationSource?: "server" | "local";
  orientationRecommendations?: OrientationResult["recommendations"];
}

const WHATSAPP_URL = (() => {
  const url = process.env.NEXT_PUBLIC_WHATSAPP_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "[WhatsApp] NEXT_PUBLIC_WHATSAPP_URL manquant ou vide. Ajoutez-la dans Vercel → Settings → Environment Variables, puis redéployez.",
    );
  }
  return url;
})();

export function Welcome({
  answers,
  result,
  onReset,
  onOpenPrivacy,
  onCompleteProfile,
}: {
  answers: ProfileAnswers;
  result: WelcomeResult;
  onReset: () => void;
  onOpenPrivacy?: () => void;
  onCompleteProfile?: () => void;
}) {
  const t = useTranslations("profiling");
  const isImmediate = result.accessLane === "immediate";
  const isDuplicate = !!result.duplicate;
  const [shareState, setShareState] = React.useState<"idle" | "copied">("idle");
  const orientationTrackedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!result.orientationStatus) return;

    const source = result.orientationSource ?? "server";
    const state =
      result.orientationStatus === "OK"
        ? result.nextBestAction
          ? "ok_with_action"
          : "ok_without_action"
        : result.orientationStatus === "INSUFFICIENT_DATA"
          ? "insufficient_data"
          : "no_match";
    const key = `${result.memberId}:${state}:${source}`;
    if (orientationTrackedRef.current === key) return;
    orientationTrackedRef.current = key;

    track({
      type: "orientation_evaluated",
      memberId: source === "server" ? result.memberId : undefined,
      ref: `${state}:${source}`,
      value: result.nextBestAction ? 1 : 0,
    });
  }, [
    result.memberId,
    result.nextBestAction,
    result.orientationSource,
    result.orientationStatus,
  ]);

  function handleNextBestActionClick() {
    if (!result.nextBestAction) return;
    track({
      type: "next_best_action_clicked",
      memberId: result.memberId,
      ref: result.nextBestAction.id,
    });
  }

  function handleCompleteProfile() {
    track({
      type: "profile_completion_cta_clicked",
      memberId: result.memberId === "local" ? undefined : result.memberId,
      ref: result.orientationStatus ?? "insufficient_data",
    });
    onCompleteProfile?.();
  }

  function handleWhatsAppClick() {
    track({ type: "whatsapp_join_clicked", memberId: result.memberId });
  }

  async function handleShare() {
    track({ type: "share_profile_clicked", memberId: result.memberId });
    const shareUrl = `${window.location.origin}/?share=${result.memberId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: t("welcome.shareTitle", { archetype: result.profile.archetype }),
          text: t("welcome.shareText", { archetype: result.profile.archetype }),
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
      }
    } catch {
      // User cancelled sharing.
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <header className="glass sticky top-0 z-40 border-b border-[var(--line-soft)]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
          <Logo variant="compact" size="sm" />
          <button
            onClick={handleShare}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors focus-lime",
              shareState === "copied"
                ? "border-lime/60 bg-lime/10 text-lime"
                : "border-[var(--line-strong)] text-foreground hover:border-lime/50",
            )}
          >
            <Share2 className="size-4" />
            {shareState === "copied" ? t("welcome.linkCopied") : t("welcome.shareProfile")}
          </button>
        </div>
      </header>

      <main className="relative" aria-labelledby="welcome-title">
        <div className="grid-radial" aria-hidden />
        <div className="spotlight" aria-hidden />

        <div className="relative mx-auto max-w-[1200px] px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:pb-24 lg:pt-16">
          {/* 1. Célébration + identité ----------------------------------- */}
          <section className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="animate-hash-in">
              <div className="relative inline-grid size-14 place-items-center">
                <span className="animate-ring-burst absolute inset-0 rounded-full border-2 border-lime" aria-hidden />
                <span className="grid size-14 place-items-center rounded-full bg-lime text-black shadow-[0_0_40px_rgba(197,244,65,0.35)]">
                  <Check className="size-7" strokeWidth={3} />
                </span>
              </div>

              <h1
                id="welcome-title"
                className="mt-7 max-w-2xl font-display text-[clamp(2.4rem,5.5vw,4.25rem)] font-bold leading-[1] tracking-[-0.04em] text-balance"
              >
                <span className="text-gradient">{t("welcome.heroGreeting")}</span>{" "}
                <span className="text-gradient-lime">{answers.firstName}.</span>
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {isImmediate ? t("welcome.subtitleImmediate") : t("welcome.subtitlePending")}
              </p>

              {publicTagLabels(result.profile.tags).length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2" aria-label={t("welcome.tagsAria")}>
                  {publicTagLabels(result.profile.tags).slice(0, 4).map((tag) => (
                    <li key={tag} className="chip text-xs text-muted-foreground">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}

              {/* Action principale : l'accès communauté (ou son statut). */}
              <div className="mt-9">
                {isImmediate ? (
                  <ImmediateBranch
                    answers={answers}
                    result={result}
                    t={t}
                    onWhatsAppClick={handleWhatsAppClick}
                  />
                ) : (
                  <PendingBranch answers={answers} result={result} t={t} />
                )}
              </div>
            </div>

            <div className="lg:sticky lg:top-24">
              <div className="mb-3 flex items-center justify-between">
                <span className="ds-overlabel">{t("welcome.yourProfile")}</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound className="size-3.5" />
                  {t("welcome.publicProfile")}
                </span>
              </div>
              <ProfileCard
                profile={result.profile}
                goal={answers.threeMonthGoal}
                firstName={answers.firstName}
                headingLevel={2}
              />
            </div>
          </section>

          {/* 2. Checklist d'activation ------------------------------------ */}
          <section className="mt-16 lg:mt-20" aria-labelledby="next-steps-title">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="ds-overlabel ds-overlabel--accent">{t("welcome.stepsEyebrow")}</span>
                <h2 id="next-steps-title" className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {t("welcome.stepsTitle")}
                </h2>
              </div>
              <p className="max-w-md text-sm text-muted-foreground">{t("welcome.stepsSubtitle")}</p>
            </div>

            <ol className="mt-8 grid gap-4 lg:grid-cols-3">
              <ChecklistItem n={1} done title={t("welcome.stepProfileTitle")}>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("welcome.stepProfileText", { archetype: result.profile.archetype })}
                </p>
              </ChecklistItem>

              {!isDuplicate && (
                <ChecklistItem n={2} title={t("welcome.stepEmailTitle")}>
                  <EmailVerificationNudge email={answers.email} firstName={answers.firstName} />
                </ChecklistItem>
              )}

              {!isDuplicate && !answers.phone?.trim() ? (
                <ChecklistItem n={3} title={t("welcome.stepPhoneTitle")} optional={t("welcome.whatsappCaptureOptional")}>
                  <WhatsAppCapture memberId={result.memberId} />
                </ChecklistItem>
              ) : (
                <ChecklistItem n={isDuplicate ? 2 : 3} title={t("welcome.stepSpaceTitle")}>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("welcome.stepSpaceText")}</p>
                  <a
                    href="/login?next=%2Fdashboard"
                    className="group mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line-strong)] px-4 text-sm font-medium transition-colors hover:border-lime/60 focus-lime"
                  >
                    {t("welcome.stepSpaceCta")}
                    <ArrowUpRight className="size-4" />
                  </a>
                </ChecklistItem>
              )}
            </ol>
          </section>

          {/* 3. Orientation personnalisée -------------------------------- */}
          {(result.nextBestAction || result.orientationStatus) && (
            <section className="mt-12" aria-label={t("welcome.orientationAria")}>
              <RecommendationExperience
                action={result.nextBestAction ?? null}
                status={result.orientationStatus ?? "NO_MATCH"}
                recommendations={result.orientationRecommendations ?? []}
                onCompleteProfile={handleCompleteProfile}
                onActionClick={handleNextBestActionClick}
              />
            </section>
          )}

          {/* 4. Sorties ---------------------------------------------------- */}
          <section className="mt-14 flex flex-col gap-4 border-t border-[var(--line-soft)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <RebootButton size="md" variant="outline" onClick={onReset} className="w-full sm:w-auto">
              {t("welcome.backToHashcode")}
            </RebootButton>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {onOpenPrivacy && (
                <button
                  onClick={onOpenPrivacy}
                  className="inline-flex min-h-11 items-center gap-2 transition-colors hover:text-foreground focus-lime"
                >
                  <ShieldCheck className="size-3.5" />
                  {t("welcome.privacy")}
                </button>
              )}
              <span>{t("welcome.privacyPromise")}</span>
              <code className="select-all font-mono text-[10px] text-muted-foreground/70">
                ID · {result.memberId}
              </code>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Checklist item                                                     */
/* ------------------------------------------------------------------ */

function ChecklistItem({
  n,
  title,
  done,
  optional,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  optional?: string;
  children: React.ReactNode;
}) {
  return (
    <li className={cn("surface flex flex-col p-5 sm:p-6", done && "surface-accent")}>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold",
            done ? "bg-lime text-black" : "border border-[var(--line-strong)] text-foreground",
          )}
          aria-hidden
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <h3 className="flex-1 font-display text-base font-semibold text-foreground">{title}</h3>
        {optional && <span className="text-[11px] text-muted-foreground">{optional}</span>}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* WhatsApp capture                                                   */
/* ------------------------------------------------------------------ */

function WhatsAppCapture({ memberId }: { memberId: string }) {
  const t = useTranslations("profiling");
  const [phone, setPhone] = React.useState("");
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || state !== "idle") return;

    setState("saving");
    setError(null);

    try {
      const res = await fetch("/api/account/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? t("welcome.errorGeneric"));
        setState("idle");
        return;
      }

      setState("saved");
    } catch {
      setError(t("welcome.errorNetwork"));
      setState("idle");
    }
  }

  if (state === "saved") {
    return (
      <p className="flex items-center gap-2 text-sm text-foreground" role="status">
        <Check className="size-5 shrink-0 text-lime" />
        {t("welcome.addedToWhatsApp")}
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("welcome.addToWhatsAppHint")}
      </p>

      <label htmlFor="whatsapp-phone" className="mt-4 block text-xs font-medium text-muted-foreground">
        {t("welcome.whatsappNumber")}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="whatsapp-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={40}
          placeholder={t("welcome.whatsappNumberPlaceholder")}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-[var(--line-strong)] bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-lime/60 focus:outline-none focus:ring-2 focus:ring-lime/25"
        />
        <button
          type="submit"
          disabled={state === "saving" || !phone.trim()}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-lime px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 focus-lime disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state === "saving" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          {t("welcome.add")}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        {t("welcome.whatsappPrivacyNote")}
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Branch A — immediate access                                        */
/* ------------------------------------------------------------------ */

function ImmediateBranch({
  answers,
  result,
  t,
  onWhatsAppClick,
}: {
  answers: ProfileAnswers;
  result: WelcomeResult;
  t: ReturnType<typeof useTranslations>;
  onWhatsAppClick: () => void;
}) {
  return (
    <div className="surface surface-accent relative overflow-hidden p-6 sm:p-7">

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <span className="icon-tile icon-tile--accent">
            <MessageCircle className="size-5" />
          </span>
          <span className="chip chip--accent text-xs">
            <span className="chip__dot" aria-hidden />
            {t("welcome.accessOpen")}
          </span>
        </div>

        <h2 className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t("welcome.joinNow")}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("welcome.immediateText")}
        </p>

        <ExternalCta
          href={WHATSAPP_URL}
          size="lg"
          className="mt-6"
          onClick={onWhatsAppClick}
        >
          <MessageCircle className="size-5" />
          {t("welcome.joinWhatsAppCta")}
        </ExternalCta>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MiniStat
            icon={<UserRound className="size-3.5" />}
            label={t("welcome.profileValidated")}
            value={t("welcome.approved")}
          />
          <MiniStat
            icon={<MessageCircle className="size-3.5" />}
            label={t("welcome.invitation")}
            value={t("welcome.sent")}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {t("welcome.now", {
              time: new Date().toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </span>
          {answers.country && (
            <span>
              {t("welcome.localCommunity", {
                flag: countryFlag(answers.country),
                country: countryName(answers.country),
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Branch B — pending / human review                                  */
/* ------------------------------------------------------------------ */

function PendingBranch({
  answers,
  result,
  t,
}: {
  answers: ProfileAnswers;
  result: WelcomeResult;
  t: ReturnType<typeof useTranslations>;
}) {
  const reasonLabels = getReasonLabels(t);
  const reasons = result.reasons
    .map((r) => reasonLabels[r] ?? r)
    .filter(Boolean);

  return (
    <div className="surface relative overflow-hidden p-6 sm:p-7">

      <div className="flex items-start justify-between gap-4">
        <span className="icon-tile">
          <Clock className="size-5" />
        </span>
        <span className="chip text-xs text-muted-foreground">{t("welcome.processing")}</span>
      </div>

      <h2 className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {t("welcome.pendingTitle")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t("welcome.pendingText")}
      </p>

      {reasons.length > 0 && (
        <ul className="mt-5 space-y-2">
          {reasons.map((reason, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span className="text-lime">→</span>
              {reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <MiniStat
          icon={<Clock className="size-3.5" />}
          label={t("welcome.status")}
          value={t("welcome.pending")}
        />
        <MiniStat
          icon={<Mail className="size-3.5" />}
          label={t("welcome.contact")}
          value={answers.email}
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {t("welcome.estimatedDelay")}
      </p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--line-soft)] bg-background/50 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <span className="block text-[11px] text-muted-foreground">{label}</span>
        <div className="truncate text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}
