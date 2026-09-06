"use client";

import * as React from "react";
import { Landing } from "@/components/reboot/landing";
import { ProfilingFlow } from "@/components/reboot/profiling-flow";
import { Welcome, type WelcomeResult } from "@/components/reboot/welcome";
import { AdminLogin } from "@/components/reboot/admin-login";
import { HashSymbol, Logo } from "@/components/brand/logo";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { PrivacyModal } from "@/components/reboot/privacy-modal";
import { CookieConsent } from "@/components/reboot/cookie-consent";
import { OfflineBanner } from "@/components/reboot/offline-banner";
import { AlertCircle } from "lucide-react";
import type { ProfileAnswers } from "@/lib/profiling/types";
import { generateProfile } from "@/lib/profiling/engine";
import { runAutoControls } from "@/lib/profiling/auto-controls";
import { track } from "@/lib/analytics";

type Phase = "landing" | "profiling" | "submitting" | "result" | "admin-login" | "admin";

interface SubmitResponse {
  ok: boolean;
  duplicate?: boolean;
  memberId?: string;
  accessLane?: "immediate" | "pending";
  profileStatus?: string;
  communityStatus?: string;
  reasons?: string[];
  profile?: ReturnType<typeof generateProfile>;
  error?: string;
  message?: string;
}

export default function Home() {
  const [phase, setPhase] = React.useState<Phase>("landing");
  const [answers, setAnswers] = React.useState<ProfileAnswers | null>(null);
  const [result, setResult] = React.useState<WelcomeResult | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [retryAnswers, setRetryAnswers] = React.useState<ProfileAnswers | null>(null);
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const [sharedMemberId, setSharedMemberId] = React.useState<string | null>(null);
  const profilingStartedRef = React.useRef(false);

  // Allow `?admin=1` to reveal the in-page admin dashboard (gated by auth).
  // Allow `?share=<id>` to show a public shared profile.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") {
      // Check auth status; if authed go straight to admin, else show login.
      fetch("/api/admin/verify", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          setPhase(d.authed ? "admin" : "admin-login");
        })
        .catch(() => setPhase("admin-login"));
    } else if (params.get("share")) {
      setSharedMemberId(params.get("share"));
      track({ type: "reboot_page_view", ref: "shared-profile" });
    } else {
      track({ type: "reboot_page_view" });
    }
  }, []);

  React.useEffect(() => {
    if (phase === "admin" && window.location.pathname !== "/admin") {
      window.location.assign("/admin");
    }
  }, [phase]);

  function handleJoin() {
    track({ type: "reboot_cta_clicked" });
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
        body: JSON.stringify(finalAnswers),
      });
      const data: SubmitResponse = await res.json();
      if (!res.ok || !data.ok) {
        // Soft-fail: still show a welcome with pending lane if we have a profile.
        const gen = generateProfile(finalAnswers);
        const controls = runAutoControls(finalAnswers);
        setResult({
          memberId: data.memberId ?? "local",
          accessLane: controls.accessLane,
          profileStatus: controls.profileStatus,
          communityStatus: controls.communityStatus,
          reasons: controls.reasons,
          profile: gen,
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
        setResult({
          memberId: "local",
          accessLane: controls.accessLane,
          profileStatus: controls.profileStatus,
          communityStatus: controls.communityStatus,
          reasons: controls.reasons,
          profile: gen,
          duplicate: true,
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
      });
      setPhase("result");
    } catch (err) {
      const gen = generateProfile(finalAnswers);
      const controls = runAutoControls(finalAnswers);
      setResult({
        memberId: "local",
        accessLane: controls.accessLane,
        profileStatus: controls.profileStatus,
        communityStatus: controls.communityStatus,
        reasons: controls.reasons,
        profile: gen,
      });
      setRetryAnswers(finalAnswers);
      setSubmitError(
        "Connexion impossible. Ton profil est prêt — réessaie dans un instant.",
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
        setSubmitError(data.error ?? "Échec de la soumission.");
        setPhase("result");
        return;
      }
      if (data.duplicate) {
        const gen = generateProfile(retryAnswers);
        const controls = runAutoControls(retryAnswers);
        setResult({
          memberId: "local",
          accessLane: controls.accessLane,
          profileStatus: controls.profileStatus,
          communityStatus: controls.communityStatus,
          reasons: controls.reasons,
          profile: gen,
          duplicate: true,
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
      });
      setRetryAnswers(null);
      setPhase("result");
    } catch {
      setSubmitError("Toujours impossible. Vérifie ta connexion.");
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

  if (phase === "admin-login")
    return (
      <AdminLogin
        onAuthed={() => setPhase("admin")}
        onExit={reset}
      />
    );

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
        />
        <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      </>
    );

  if (phase === "submitting") return <SubmittingScreen />;

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
                Réessayer
              </button>
            )}
          </div>
        )}
        <Welcome
          answers={answers}
          result={result}
          onReset={reset}
          onOpenPrivacy={() => setPrivacyOpen(true)}
        />
        <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      </>
    );

  // Public shared-profile view (?share=<id>).
  if (sharedMemberId)
    return (
      <SharedProfileView memberId={sharedMemberId} onExit={reset} />
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
}: {
  memberId: string;
  onExit: () => void;
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
      accessLane: string;
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
      .catch(() => setError("Profil introuvable ou non public."));
  }, [memberId]);

  const DOMAIN_LABEL: Record<string, string> = {
    web: "Web Development",
    cybersecurity: "Cybersecurity",
    ai: "Applied AI",
  };
  const LEVEL_LABEL: Record<string, string> = {
    beginner: "Débutant",
    practicing: "Pratique",
    autonomous: "Autonome",
    advanced: "Avancé",
  };

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
                Retour à HASHCODE
              </RebootButton>
            </div>
          )}
          {data && (
            <div className="animate-hash-in">
              <div className="text-center mb-6">
                <MonoLabel className="text-lime">Profil public · HASHCODE REBOOT</MonoLabel>
                <h1 className="mt-3 font-display font-extrabold italic tracking-tight text-3xl">
                  {data.profile.firstName} ·{" "}
                  <span className="text-lime text-glow-lime">
                    {data.profile.archetype ?? "MEMBER"}
                  </span>
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Voici comment HASHCODE a compris ce membre.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime/70 to-transparent" />
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 mt-2">
                  <Field label="Domaine" value={DOMAIN_LABEL[data.profile.domain] ?? data.profile.domain} />
                  <Field label="Niveau" value={LEVEL_LABEL[data.profile.level] ?? data.profile.level} />
                  <Field label="Objectif" value={data.profile.goal} />
                  <Field label="Rythme" value={data.profile.availability} />
                  <Field label="Style" value={data.profile.learningStyle} />
                  <Field
                    label="Mentorat"
                    value={
                      data.profile.mentoring === "yes"
                        ? "Intéressé"
                        : data.profile.mentoring === "maybe"
                          ? "Curieux"
                          : "Pas pour le moment"
                    }
                  />
                </div>
                {data.profile.threeMonthGoal && (
                  <div className="mt-5 pt-5 border-t border-border/70">
                    <MonoLabel className="text-muted-foreground">Objectif à 3 mois</MonoLabel>
                    <p className="mt-1 text-foreground italic font-display text-base">
                      « {data.profile.threeMonthGoal} »
                    </p>
                  </div>
                )}
                {data.profile.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {data.profile.tags.slice(0, 8).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-sm border border-border px-2 py-0.5 text-xs mono-label text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-6 text-center">
                <RebootButton size="lg" onClick={onExit} className="group">
                  Construire mon profil
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

function SubmittingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-5">
      <div className="text-center animate-hash-in">
        <div className="relative inline-flex">
          <HashSymbol className="text-lime" size={44} />
          <span className="absolute inset-0 animate-hash-sweep rounded-sm overflow-hidden" />
        </div>
        <h1 className="mt-6 font-display font-bold text-xl text-foreground">
          On enregistre ton profil…
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Contrôles automatiques en cours.
        </p>
        <MonoLabel className="mt-5 inline-block text-muted-foreground">
          HASHCODE · REBOOT
        </MonoLabel>
      </div>
    </div>
  );
}
