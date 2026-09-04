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
import type { GeneratedProfile, ProfileAnswers } from "@/lib/profiling/types";
import { DEFAULT_WHATSAPP_URL, REASON_LABELS } from "@/lib/profiling/auto-controls";
import { countryName, countryFlag } from "@/lib/profiling/countries";
import { track } from "@/lib/analytics";
import { Check, Clock, Mail, MessageCircle, Share2, ShieldCheck } from "lucide-react";

export interface WelcomeResult {
  memberId: string;
  accessLane: "immediate" | "pending";
  profileStatus: string;
  communityStatus: string;
  reasons: string[];
  profile: GeneratedProfile;
  duplicate?: boolean;
}

/**
 * Client-side WhatsApp URL: only `NEXT_PUBLIC_*` vars are inlined in the
 * browser bundle, with fallback on the current invite link when unset.
 */
const WHATSAPP_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_URL ?? DEFAULT_WHATSAPP_URL;

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
  const isImmediate = result.accessLane === "immediate";
  const isDuplicate = !!result.duplicate;
  const [shareState, setShareState] = React.useState<"idle" | "copied">(
    "idle",
  );

  function handleWhatsAppClick() {
    track({ type: "whatsapp_join_clicked", memberId: result.memberId });
  }
  function handleCommunityCtaClick() {
    track({ type: "community_cta_clicked", memberId: result.memberId });
  }
  async function handleShare() {
    track({ type: "share_profile_clicked", memberId: result.memberId });
    const shareUrl = `${window.location.origin}/?share=${result.memberId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Mon profil HASHCODE",
          text: `Je viens de rejoindre le Reboot HASHCODE comme ${result.profile.archetype}.`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
      }
    } catch {
      // user cancelled — silent
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-3xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <Logo variant="compact" size="sm" />
          <MonoLabel className="text-muted-foreground">
            {isDuplicate ? "Profil existant" : "Profil enregistré"}
          </MonoLabel>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-8 py-10 sm:py-16">
        <div className="mx-auto max-w-xl">
          {/* Duplicate banner */}
          {isDuplicate && (
            <div className="mb-6 rounded-md border border-border bg-card p-4 flex items-start gap-3 animate-hash-in">
              <span className="text-lime shrink-0 mt-0.5">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-sm text-foreground font-medium">
                  Tu as déjà commencé ton profil HASHCODE.
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  On a retrouvé ton profil. Voici où en est ton accès.
                </p>
              </div>
            </div>
          )}

          {/* Hero block */}
          <div className="animate-hash-in">
            <HashSymbol className="text-lime" size={44} />
            <h1 className="mt-5 font-display font-extrabold italic tracking-tight text-3xl sm:text-4xl text-foreground leading-[0.95]">
              Bienvenue dans le Reboot.
            </h1>
            <p className="mt-3 text-muted-foreground text-base sm:text-lg leading-relaxed">
              {isImmediate
                ? "Ton profil est enregistré. La nouvelle expérience HASHCODE se construit maintenant."
                : "Ton profil est enregistré. On te recontacte très vite pour ton invitation personnelle."}
            </p>
          </div>

          {/* Branching result card */}
          <div className="mt-7">
            {isImmediate ? (
              <ImmediateBranch answers={answers} result={result} />
            ) : (
              <PendingBranch answers={answers} result={result} />
            )}
          </div>

          {/* Profile card */}
          <div className="mt-8">
            <MonoLabel className="text-muted-foreground mb-3 block">
              Ton profil
            </MonoLabel>
            <ProfileCard
              profile={result.profile}
              goal={answers.threeMonthGoal}
              firstName={answers.firstName}
            />
          </div>

          {/* Footer actions */}
          <div className="mt-8 flex flex-col items-center gap-3">
            {isImmediate && (
              <ExternalCta
                href={WHATSAPP_URL}
                size="lg"
                className="w-full sm:w-auto mx-auto flex justify-center"
              >
                <span
                  className="inline-flex items-center gap-2 w-full justify-center"
                  onClick={handleWhatsAppClick}
                >
                  <MessageCircle className="size-4" />
                  Rejoindre la communauté officielle
                </span>
              </ExternalCta>
            )}
            <RebootButton size="lg" variant="outline" onClick={onReset} className="w-full sm:w-auto sm:mx-auto">
              Retourner à HASHCODE
            </RebootButton>
          </div>

          {/* Secondary actions: share + privacy — pill style for visibility */}
          <div className="mt-5 flex flex-wrap gap-2 items-center justify-center">
            <button
              onClick={handleShare}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-colors focus-lime",
                shareState === "copied"
                  ? "border-lime/60 bg-lime/10 text-lime"
                  : "border-border bg-card text-muted-foreground hover:text-lime hover:border-lime/50",
              )}
            >
              <Share2 className="size-3.5" />
              {shareState === "copied" ? "Lien copié ✓" : "Partager mon profil"}
            </button>
            {onOpenPrivacy && (
              <button
                onClick={onOpenPrivacy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs text-muted-foreground hover:text-lime hover:border-lime/50 transition-colors focus-lime"
              >
                <ShieldCheck className="size-3.5" />
                Confidentialité
              </button>
            )}
          </div>

          {/* Member ID — code block style for premium/technical feel */}
          <div className="mt-8 flex items-center justify-center gap-2">
            <span className="mono-label text-muted-foreground">ID</span>
            <code className="font-mono text-xs text-muted-foreground bg-card border border-border/60 px-2.5 py-1 rounded-sm select-all tabular-nums">
              {result.memberId}
            </code>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-border/60">
        <div className="mx-auto max-w-3xl px-5 sm:px-8 py-4">
          <p className="text-center text-xs text-muted-foreground">
            HASHCODE · REBOOT — Une nouvelle génération de la communauté commence.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Branch A — immediate access                                        */
/* ------------------------------------------------------------------ */

function ImmediateBranch({
  answers,
}: {
  answers: ProfileAnswers;
  result: WelcomeResult;
}) {
  return (
    <div className="relative rounded-lg border border-lime/40 bg-lime/[0.04] p-5 sm:p-6 overflow-hidden lift-on-hover">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime to-transparent" />
      {/* Subtle lime aura for depth */}
      <div
        className="absolute -top-8 -right-8 size-32 rounded-full blur-3xl opacity-[0.08] pointer-events-none"
        style={{ background: "var(--primary)" }}
        aria-hidden
      />
      <div className="relative flex items-start gap-4">
        <span className="shrink-0 size-10 rounded-full bg-lime text-black flex items-center justify-center shadow-[0_0_20px_rgba(197,244,65,0.4)]">
          <Check className="size-5" strokeWidth={3} />
        </span>
        <div className="flex-1">
          <MonoLabel className="text-lime">Accès immédiat</MonoLabel>
          <h2 className="mt-1 font-display font-bold text-lg text-foreground leading-snug">
            Tu peux rejoindre la communauté officielle maintenant.
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Ton profil est compatible avec HASHCODE. On t&apos;ouvre l&apos;accès
            tout de suite — pas d&apos;attente, pas de friction.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat
              icon={<Check className="size-3.5" />}
              label="Profil validé"
              value="APPROVED"
              tone="lime"
            />
            <MiniStat
              icon={<MessageCircle className="size-3.5" />}
              label="Invitation"
              value="Envoyée"
              tone="lime"
            />
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span className="mono-label">Maintenant · {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {answers.country && (
            <p className="mt-3 text-xs text-muted-foreground">
              Communauté locale&nbsp;: {countryFlag(answers.country)}{" "}
              {countryName(answers.country)} — on te retrouvera aussi là.
            </p>
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
}: {
  answers: ProfileAnswers;
  result: WelcomeResult;
}) {
  const reasons = result.reasons
    .map((r) => REASON_LABELS[r] ?? r)
    .filter(Boolean);

  return (
    <div className="relative rounded-lg border border-border bg-card p-5 sm:p-6 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-muted-foreground/60 to-transparent" />
      <div className="flex items-start gap-4">
        <span className="shrink-0 size-9 rounded-full bg-secondary text-foreground flex items-center justify-center">
          <Clock className="size-5" />
        </span>
        <div className="flex-1">
          <MonoLabel className="text-muted-foreground">En traitement</MonoLabel>
          <h2 className="mt-1 font-display font-bold text-lg text-foreground">
            On prépare ton invitation personnalisée.
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Pour certaines inscriptions, une touche humaine fait une vraie
            différence. On revient vers toi par email avec ton accès.
          </p>

          {reasons.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {reasons.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <span className="text-lime mono-label text-[10px]">→</span>
                  {r}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat
              icon={<Clock className="size-3.5" />}
              label="Statut"
              value="EN ATTENTE"
              tone="muted"
            />
            <MiniStat
              icon={<Mail className="size-3.5" />}
              label="Contact"
              value={answers.email}
              tone="muted"
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Délai estimé&nbsp;: sous 48 h. Vérifie tes spams — l&apos;email vient
            de HASHCODE.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini stat block                                                     */
/* ------------------------------------------------------------------ */

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "lime" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 flex items-center gap-2.5",
        tone === "lime"
          ? "border-lime/40 bg-lime/5"
          : "border-border bg-secondary/40",
      )}
    >
      <span className={cn(icon && (tone === "lime" ? "text-lime" : "text-muted-foreground"))}>
        {icon}
      </span>
      <div className="min-w-0">
        <MonoLabel className="text-muted-foreground block">{label}</MonoLabel>
        <div
          className={cn(
            "text-xs font-medium truncate",
            tone === "lime" ? "text-foreground" : "text-foreground/90",
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
