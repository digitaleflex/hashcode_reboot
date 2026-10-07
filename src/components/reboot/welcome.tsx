"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { HashSymbol, Logo } from "@/components/brand/logo";
import {
  RebootButton,
  CtaArrow,
  MonoLabel,
  ExternalCta,
} from "./shared";
import { ProfileCard } from "./profile-card";
import { NextBestActionCard } from "./next-best-action-card";
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
  Sparkles,
  UserRound,
} from "lucide-react";
import { EmailVerificationNudge } from "./email-verify-card";
import { useTranslations } from "next-intl";

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
}: {
  answers: ProfileAnswers;
  result: WelcomeResult;
  onReset: () => void;
  onOpenPrivacy?: () => void;
}) {
  const t = useTranslations("profiling");
  const isImmediate = result.accessLane === "immediate";
  const isDuplicate = !!result.duplicate;
  const [shareState, setShareState] = React.useState<"idle" | "copied">("idle");

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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Logo variant="compact" size="sm" />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Profil
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-lime/35 bg-lime/5 px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-lime">
              <span className="size-1.5 rounded-full bg-lime animate-hash-pulse" />
              ACTIF
            </span>
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 72% 12%, rgba(197,244,65,0.11), transparent 30%), radial-gradient(circle at 18% 18%, rgba(197,244,65,0.045), transparent 25%)",
          }}
        />

        <div className="relative mx-auto max-w-[1240px] px-5 pb-14 pt-10 sm:px-8 sm:pt-14 lg:pb-20 lg:pt-16">
          {/* Hero / identity */}
          <section className="grid items-end gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-12">
            <div className="animate-hash-in">
              <div className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/[0.04] px-3 py-1.5">
                <Check className="size-3.5 text-lime" strokeWidth={3} />
                <MonoLabel className="text-lime">Profil reconnu</MonoLabel>
              </div>

              <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.6rem,6vw,5rem)] font-extrabold italic leading-[0.92] tracking-[-0.045em] text-balance">
                Bienvenue dans le Reboot,
                <span className="text-lime text-glow-lime"> {answers.firstName}.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Ton profil est validé. Tu fais maintenant partie de l’écosystème
                HASHCODE. Découvre ta prochaine étape et rejoins la communauté.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {result.profile.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative hidden min-h-[250px] overflow-hidden rounded-2xl border border-border/80 bg-card/25 lg:block">
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(197,244,65,0.12) 1px, transparent 0)",
                  backgroundSize: "22px 22px",
                }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(197,244,65,0.08),transparent_58%)]" />
              <div className="relative flex h-full min-h-[250px] flex-col items-center justify-center">
                <div className="relative grid size-28 place-items-center rounded-full border border-lime/40 bg-background/80 shadow-[0_0_70px_rgba(197,244,65,0.10)]">
                  <div className="absolute inset-3 rounded-full border border-lime/15" />
                  <HashSymbol className="text-lime" size={54} />
                </div>
                <MonoLabel className="mt-5 text-center text-muted-foreground">
                  {result.profile.archetype}
                </MonoLabel>
                <p className="mt-1 text-sm text-foreground/80">
                  Identité HASHCODE activée
                </p>
              </div>
            </div>
          </section>

          {/* Primary actions */}
          <section className="mt-10 grid gap-5 lg:grid-cols-2">
            {isImmediate ? (
              <ImmediateBranch
                answers={answers}
                result={result}
                t={t}
              />
            ) : (
              <PendingBranch answers={answers} result={result} t={t} />
            )}

            <div className="min-w-0">
              {(result.nextBestAction || result.orientationStatus) ? (
                <NextBestActionCard
                  action={result.nextBestAction ?? null}
                  status={result.orientationStatus ?? "NO_MATCH"}
                  className="h-full"
                />
              ) : (
                <div className="h-full rounded-xl border border-border bg-card/35 p-6">
                  <MonoLabel className="text-muted-foreground">
                    Prochaine étape
                  </MonoLabel>
                  <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
                    Ton parcours commence maintenant.
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                    Explore la communauté, les ateliers et les prochains challenges
                    pour transformer ton profil en progression concrète.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Secondary information */}
          <section className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <MonoLabel className="text-muted-foreground">Ton profil</MonoLabel>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound className="size-3.5" />
                  Profil public
                </span>
              </div>
              <ProfileCard
                profile={result.profile}
                goal={answers.threeMonthGoal}
                firstName={answers.firstName}
              />
            </div>

            <div className="space-y-5">
              {!isDuplicate && (
                <EmailVerificationNudge
                  email={answers.email}
                  firstName={answers.firstName}
                />
              )}

              {!isDuplicate && !answers.phone?.trim() && (
                <WhatsAppCapture memberId={result.memberId} />
              )}

              <div className="rounded-xl border border-border bg-card/25 p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-lime/25 bg-lime/5 text-lime">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <MonoLabel className="text-muted-foreground">
                      Aller plus loin
                    </MonoLabel>
                    <p className="mt-1.5 text-sm leading-6 text-foreground/90">
                      Ton profil sert maintenant de point de départ pour les
                      recommandations, les activités et les opportunités HASHCODE.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Footer actions */}
          <section className="mt-8 flex flex-col gap-4 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <RebootButton
              size="md"
              variant="outline"
              onClick={onReset}
              className="w-full sm:w-auto"
            >
              Retourner à HASHCODE
              <ArrowUpRight className="size-4" />
            </RebootButton>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleShare}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-xs transition-colors focus-lime",
                  shareState === "copied"
                    ? "border-lime/60 bg-lime/10 text-lime"
                    : "border-border bg-card/30 text-muted-foreground hover:border-lime/50 hover:text-lime",
                )}
              >
                <Share2 className="size-3.5" />
                {shareState === "copied"
                  ? t("welcome.linkCopied")
                  : t("welcome.shareProfile")}
              </button>

              {onOpenPrivacy && (
                <button
                  onClick={onOpenPrivacy}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card/30 px-4 text-xs text-muted-foreground transition-colors hover:border-lime/50 hover:text-lime focus-lime"
                >
                  <ShieldCheck className="size-3.5" />
                  {t("welcome.privacy")}
                </button>
              )}
            </div>
          </section>

          <div className="mt-6 flex flex-col gap-2 text-center text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p>Reboot — minimum nécessaire, zéro revente, zéro pub.</p>
            <code className="select-all font-mono text-[10px] text-muted-foreground/70">
              ID · {result.memberId}
            </code>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2">
            <HashSymbol className="text-lime" size={18} />
            <span className="font-display text-sm font-bold">HASHCODE</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Build. Learn. Share. Grow.
          </span>
        </div>
      </footer>
    </div>
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
      <div className="rounded-xl border border-lime/35 bg-lime/[0.04] px-4 py-4 text-sm text-foreground">
        <div className="flex items-center gap-2">
          <Check className="size-4 shrink-0 text-lime" />
          {t("welcome.addedToWhatsApp")}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-card/25 p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-lime/25 bg-lime/5 text-lime">
          <MessageCircle className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              Recevoir les infos sur WhatsApp
            </p>
            <MonoLabel className="text-muted-foreground">Optionnel</MonoLabel>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("welcome.addToWhatsAppHint")}
          </p>

          <div className="mt-4 flex gap-2">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              placeholder="+229 …"
              aria-label={t("welcome.whatsappNumber")}
              className="min-w-0 flex-1 rounded-md border border-border/70 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-lime/50 focus:outline-none focus:ring-1 focus:ring-lime/30"
            />
            <button
              type="submit"
              disabled={state === "saving" || !phone.trim()}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-lime px-4 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "saving" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              Ajouter
            </button>
          </div>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            Ton numéro reste privé et n’est pas affiché publiquement.
          </p>
        </div>
      </div>
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
    <div className="relative h-full overflow-hidden rounded-xl border border-lime/40 bg-lime/[0.035] p-6 sm:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime to-transparent" />
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-lime/10 blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-lime text-black shadow-[0_0_24px_rgba(197,244,65,0.24)]">
            <Check className="size-5" strokeWidth={3} />
          </div>
          <MonoLabel className="text-lime">Accès activé</MonoLabel>
        </div>

        <h2 className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Rejoins la communauté maintenant.
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Ton profil est prêt. Tu peux rejoindre HASHCODE pour échanger,
          poser tes questions et participer aux prochaines activités.
        </p>

        <ExternalCta
          href={WHATSAPP_URL}
          size="lg"
          className="mt-6 w-full sm:w-auto"
        >
          <span
            className="inline-flex items-center gap-2"
            onClick={onWhatsAppClick}
          >
            <MessageCircle className="size-4" />
            Rejoindre HASHCODE sur WhatsApp
          </span>
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
    <div className="relative h-full overflow-hidden rounded-xl border border-border bg-card/40 p-6 sm:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-muted-foreground/60 to-transparent" />

      <div className="flex items-start justify-between gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
          <Clock className="size-5" />
        </div>
        <MonoLabel className="text-muted-foreground">En cours</MonoLabel>
      </div>

      <h2 className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Ton profil est en cours de traitement.
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Nous allons vérifier ton profil avant de t’envoyer une invitation
        personnalisée.
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
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border/80 bg-background/45 p-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <MonoLabel className="block text-muted-foreground">{label}</MonoLabel>
        <div className="truncate text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}
