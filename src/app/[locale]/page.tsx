"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Landing } from "@/components/reboot/landing";
import { Welcome, type WelcomeResult } from "@/components/reboot/welcome";
import { HashSymbol, Logo } from "@/components/brand/logo";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { PrivacyModal } from "@/components/reboot/privacy-modal";
import { CookieConsent } from "@/components/reboot/cookie-consent";
import { OfflineBanner } from "@/components/reboot/offline-banner";
import { AlertCircle } from "lucide-react";
import type { ProfileAnswers } from "@/lib/profiling/types";
import { generateProfile } from "@/lib/profiling/engine";
import { runAutoControls } from "@/lib/profiling/auto-controls";
import { orientationEngine } from "@/lib/orientation/engine";
import type { OrientationResult } from "@/lib/orientation/types";
import { track, getSource } from "@/lib/analytics";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";

// framer-motion sort du bundle initial : chargé seulement quand
// l'utilisateur démarre le profiling (phase "profiling").
const ProfilingFlow = dynamic(
  () => import("@/components/reboot/profiling-flow").then((m) => m.ProfilingFlow),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[50vh] flex flex-col items-center justify-center gap-3"
        role="status"
        aria-label="Chargement du questionnaire"
      >
        <span className="size-8 rounded-full border-2 border-lime/30 border-t-lime animate-spin" />
        <p className="mono-label text-muted-foreground">Préparation…</p>
      </div>
    ),
  },
);

type Phase = "landing" | "profiling" | "submitting" | "result" | "admin";

interface SubmitResponse {
  ok: boolean;
  duplicate?: boolean;
  memberId?: string;
  accessLane?: "immediate" | "pending";
  profileStatus?: string;
  communityStatus?: string;
  reasons?: string[];
  profile?: ReturnType<typeof generateProfile>;
  nextBestAction?: OrientationResult["nextBestAction"];
  orientationStatus?: OrientationResult["status"];
  orientationSource?: "server" | "local";
  error?: string;
  message?: string;
}

/**
 * Orientation côté client (repli local) : le moteur est pur et déterministe,
 * il peut être évalué dans le navigateur quand la réponse serveur est
 * absente (soft-fail, doublon) ou incomplète. Ne casse jamais le parcours.
 */
function localOrientation(answers: ProfileAnswers): {
  nextBestAction: OrientationResult["nextBestAction"];
  orientationStatus: OrientationResult["status"];
} {
  try {
    const r = orientationEngine.evaluate(answers);
    return { nextBestAction: r.nextBestAction, orientationStatus: r.status };
  } catch {
    return { nextBestAction: null, orientationStatus: "NO_MATCH" };
  }
}

export default function Home() {
  const t = useTranslations("profiling");
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("landing");
  const [answers, setAnswers] = React.useState<ProfileAnswers | null>(null);
  const [result, setResult] = React.useState<WelcomeResult | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [retryAnswers, setRetryAnswers] = React.useState<ProfileAnswers | null>(null);
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const [sharedMemberId, setSharedMemberId] = React.useState<string | null>(null);
  const profilingStartedRef = React.useRef(false);

  // `?admin=1` redirige vers le parcours OTP (`/login?next=/admin`) : la
  // garde serveur du layout /admin tranche (pas de probe client
  // /api/admin/verify, pas de flash de la landing en attendant la réponse).
  // Allow `?share=<id>` to show a public shared profile.
  // Allow `?resume=1` (relance email) to auto-open the profiling flow.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") {
      // Nettoie `?admin=1` de l'entrée d'historique courante avant de partir
      // (même motif `history.replaceState` que otp-form.tsx).
      window.history.replaceState({}, "", window.location.pathname);
      router.replace("/login?next=%2Fadmin");
    } else if (params.get("share")) {
      setSharedMemberId(params.get("share"));
      track({ type: "reboot_page_view", ref: "shared-profile" });
    } else if (params.get("resume")) {
      track({ type: "reboot_page_view", ref: "relance-resume" });
      setPhase("profiling");
      if (!profilingStartedRef.current) {
        profilingStartedRef.current = true;
        track({ type: "profiling_resumed" });
      }
    } else {
      track({ type: "reboot_page_view" });
    }
  }, [router]);

  React.useEffect(() => {
    if (phase === "admin" && window.location.pathname !== "/admin") {
      window.location.assign("/admin");
    }
  }, [phase]);

  function handleJoin(ref?: string) {
    // `ref` identifie le CTA déclenché (hero, header, axes, final…).
    // Ajout rétrocompatible : les appels sans argument continuent
    // d'émettre `reboot_cta_clicked` avec `ref: undefined`.
    track({ type: "reboot_cta_clicked", ref });
    setPhase("profiling");
    if (!profilingStartedRef.current) {
      profilingStartedRef.current = true;
      track({ type: "profiling_started" });
    }
  }

  function handleBackToLanding() {
    setPhase("landing");
  }

  async function handleSubmit(finalAnswers: ProfileAnswers) {
    track({ type: "profiling_completed" });
    setAnswers(finalAnswers);
    setPhase("submitting");
    setSubmitError(null);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...finalAnswers, source: getSource() }),
      });
      const data: SubmitResponse = await res.json();
      if (!res.ok || !data.ok) {
        // Soft-fail: still show a welcome with pending lane if we have a profile.
        const gen = generateProfile(finalAnswers);
        const controls = runAutoControls(finalAnswers);
        const fallback = localOrientation(finalAnswers);
        setResult({
          memberId: data.memberId ?? "local",
          accessLane: controls.accessLane,
          profileStatus: controls.profileStatus,
          communityStatus: controls.communityStatus,
          reasons: controls.reasons,
          profile: gen,
          nextBestAction: fallback.nextBestAction,
          orientationStatus: fallback.orientationStatus,
          orientationSource: "local",
        });
        if (data.error) setSubmitError(data.error);
        setPhase("result");
        return;
      }
      // Duplicate → le serveur ne renvoie plus aucun champ membre
      // (anti-énumération) : on affiche le profil LOCAL recalculé,
      // même motif soft-fail que ci-dessus.
      if (data.duplicate) {
        const gen = generateProfile(finalAnswers);
        const controls = runAutoControls(finalAnswers);
        const fallback = localOrientation(finalAnswers);
        setResult({
          memberId: "local",
          accessLane: controls.accessLane,
          profileStatus: controls.profileStatus,
          communityStatus: controls.communityStatus,
          reasons: controls.reasons,
          profile: gen,
          duplicate: true,
          nextBestAction: fallback.nextBestAction,
          orientationStatus: fallback.orientationStatus,
          orientationSource: "local",
        });
        setPhase("result");
        return;
      }
      setResult({
        memberId: data.memberId!,
        accessLane: data.accessLane ?? "pending",
        profileStatus: data.profileStatus ?? "PENDING",
        communityStatus: data.communityStatus ?? "NOT_INVITED",
        reasons: data.reasons ?? [],
        profile: data.profile ?? generateProfile(finalAnswers),
        nextBestAction: data.nextBestAction ?? localOrientation(finalAnswers).nextBestAction,
        orientationStatus: data.orientationStatus ?? localOrientation(finalAnswers).orientationStatus,
        orientationSource: data.orientationStatus ? "server" : "local",
      });
      setPhase("result");
    } catch (err) {
      const gen = generateProfile(finalAnswers);
      const controls = runAutoControls(finalAnswers);
      const fallback = localOrientation(finalAnswers);
      setResult({
        memberId: "local",
        accessLane: controls.accessLane,
        profileStatus: controls.profileStatus,
        communityStatus: controls.communityStatus,
        reasons: controls.reasons,
        profile: gen,
        nextBestAction: fallback.nextBestAction,
        orientationStatus: fallback.orientationStatus,
      });
      setRetryAnswers(finalAnswers);
      setSubmitError(
        t("page.submitError"),
      );
      setPhase("result");
    }
  }

  async function handleRetry() {
    if (!retryAnswers) return;
    setSubmitError(null);
    setPhase("submitting");
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retryAnswers),
      });
      const data: SubmitResponse = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? t("page.submitFailed"));
        setPhase("result");
        return;
      }
      if (data.duplicate) {
        const gen = generateProfile(retryAnswers);
        const controls = runAutoControls(retryAnswers);
        const fallback = localOrientation(retryAnswers);
        setResult({
          memberId: "local",
          accessLane: controls.accessLane,
          profileStatus: controls.profileStatus,
          communityStatus: controls.communityStatus,
          reasons: controls.reasons,
          profile: gen,
          duplicate: true,
          nextBestAction: fallback.nextBestAction,
          orientationStatus: fallback.orientationStatus,
          orientationSource: "local",
        });
        setRetryAnswers(null);
        setPhase("result");
        return;
      }
      setResult({
        memberId: data.memberId!,
        accessLane: data.accessLane ?? "pending",
        profileStatus: data.profileStatus ?? "PENDING",
        communityStatus: data.communityStatus ?? "NOT_INVITED",
        reasons: data.reasons ?? [],
        profile: data.profile ?? generateProfile(retryAnswers),
        nextBestAction: data.nextBestAction ?? localOrientation(retryAnswers).nextBestAction,
        orientationStatus: data.orientationStatus ?? localOrientation(retryAnswers).orientationStatus,
        orientationSource: data.orientationStatus ? "server" : "local",
      });
      setRetryAnswers(null);
      setPhase("result");
    } catch {
      setSubmitError(t("page.stillFailing"));
      setPhase("result");
    }
  }

  function reset() {
    setAnswers(null);
    setResult(null);
    setSubmitError(null);
    setSharedMemberId(null);
    setPhase("landing");
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", "/");
    }
  }

  if (phase === "admin") {
    // Redirect is performed in an effect so render stays pure.
    return null;
  }

  if (phase === "profiling")
    return (
      <>
        <ProfilingFlow
          onComplete={handleSubmit}
          onBack={handleBackToLanding}
          initialValues={answers ?? undefined}
        />
        <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      </>
    );

  if (phase === "submitting") return <SubmittingScreen t={t} />;

  if (phase === "result" && result && answers)
    return (
      <>
        {submitError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-md border border-destructive/40 bg-destructive/5 px-5 py-3 text-sm text-foreground shadow-lg flex items-center gap-4 max-w-md">
            <AlertCircle className="size-4 text-destructive shrink-0" />
            <span className="flex-1">{submitError}</span>
            {retryAnswers && (
              <button
                onClick={handleRetry}
                className="text-xs px-3 py-1.5 rounded-md bg-lime text-black font-medium hover:bg-lime/90 transition-colors focus-lime whitespace-nowrap shrink-0"
              >
                {t("page.retry")}
              </button>
            )}
          </div>
        )}
        <Welcome
          answers={answers}
          result={result}
          onReset={reset}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          onCompleteProfile={() => setPhase("profiling")}
        />
        <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      </>
    );

  // Public shared-profile view (?share=<id>).
  if (sharedMemberId)
    return (
      <SharedProfileView memberId={sharedMemberId} onExit={reset} t={t} />
    );

  return (
    <>
      <OfflineBanner />
      <Landing onJoin={handleJoin} onOpenPrivacy={() => setPrivacyOpen(true)} />
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <CookieConsent />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Public shared-profile view                                          */
/* ------------------------------------------------------------------ */

function SharedProfileView({
  memberId,
  onExit,
  t,
}: {
  memberId: string;
  onExit: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [data, setData] = React.useState<{
    profile: {
      firstName: string;
      archetype: string | null;
      domain: string;
      level: string;
      goal: string;
      availability: string;
      learningStyle: string;
      mentoring: string | null;
      threeMonthGoal: string | null;
      tags: string[];
    };
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(`/api/members/${memberId}/share`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError(t("page.profileNotFound")));
  }, [memberId, t]);

  return (
    <div className="min-h-screen flex flex-col bg-background bg-vignette bg-noise">
      <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
      <div className="relative z-10 flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          {error && (
            <div className="text-center animate-hash-in">
              <HashSymbol className="mx-auto text-lime" size={40} />
              <h1 className="mt-5 font-display font-bold text-2xl tracking-tight">
                {error}
              </h1>
              <RebootButton
                size="md"
                variant="outline"
                onClick={onExit}
                className="mt-6 group"
              >
                {t("page.backToHashcode")}
              </RebootButton>
            </div>
          )}
          {data && (
            <div className="animate-hash-in">
              <div className="text-center mb-6">
                <MonoLabel className="text-lime">{t("page.publicProfile")}</MonoLabel>
                <h1 className="mt-3 font-display font-extrabold italic tracking-tight text-3xl">
                  {data.profile.firstName} ·{" "}
                  <span className="text-lime text-glow-lime">
                    {data.profile.archetype ?? "MEMBER"}
                  </span>
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("page.howHashcodeUnderstood")}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime/70 to-transparent" />
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 mt-2">
                  <Field label={t("page.domain")} value={data.profile.domain} />
                  <Field label={t("page.level")} value={data.profile.level} />
                  <Field label={t("page.goal")} value={data.profile.goal} />
                  <Field label={t("page.availability")} value={data.profile.availability} />
                  <Field label={t("page.style")} value={data.profile.learningStyle} />
                  <Field
                    label={t("page.mentoring")}
                    value={
                      data.profile.mentoring === "yes"
                        ? t("page.mentoringInterested")
                        : data.profile.mentoring === "maybe"
                        ? t("page.mentoringCurious")
                        : t("page.mentoringNotNow")
                    }
                  />
                </div>
                {data.profile.threeMonthGoal && (
                  <div className="mt-5 pt-5 border-t border-border/70">
                    <MonoLabel className="text-muted-foreground">{t("page.threeMonthGoal")}</MonoLabel>
                    <p className="mt-1 text-foreground italic font-display text-base">
                      « {data.profile.threeMonthGoal} »"
                    </p>
                  </div>
                )}
                {data.profile.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {data.profile.tags.slice(0, 8).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-sm border border-border px-2 py-0.5 text-xs mono-label text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-6 text-center">
                <RebootButton size="lg" onClick={onExit} className="group">
                  {t("page.buildMyProfile")}
                </RebootButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MonoLabel className="text-muted-foreground">{label}</MonoLabel>
      <div className="mt-0.5 text-sm text-foreground font-medium">{value}</div>
    </div>
  );
}

function SubmittingScreen({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-5">
      <div className="text-center animate-hash-in">
        <div className="relative inline-flex">
          <HashSymbol className="text-lime" size={44} />
          <span className="absolute inset-0 animate-hash-sweep rounded-sm overflow-hidden" />
        </div>
        <h1 className="mt-6 font-display font-bold text-xl text-foreground">
          {t("page.savingProfile")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("page.autoControlsRunning")}
        </p>
        <MonoLabel className="mt-5 inline-block text-muted-foreground">
          HASHCODE · REBOOT
        </MonoLabel>
      </div>
    </div>
  );
}