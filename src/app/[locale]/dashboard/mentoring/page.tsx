/*─────────────────────────────────────────────────────────────
  T02 — /dashboard/mentoring — Page membre (P0)
  ──▶ Affichage du suivi de mentorat + liens vers ateliers
 ────────────────────────────────────────────────────────────── */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/reboot/shared";
import { Loader2, UserX, CheckCircle2, ChevronDown } from "lucide-react";

interface MentorInfo {
  hasMentor: boolean;
  mentorName?: string;
  mentorSince?: string;
  mentoringInterest: "yes" | "maybe" | "no";
  mentoringValidated: boolean;
}

/**
 * Récupère les infos de mentorat du membre connecté.
 * Jusque-là on simule des données — à remplacer par un appel API réel
 * lorsque le backend aura le champ `mentoring*` sur member.
 */
async function fetchMentorInfo() {
  const res = await fetch("/api/account/me", { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  const m = data.member ?? {};
  return {
    hasMentor: !!(m.mentorId || m.mentoringInterest === "yes"),
    mentorName: m.mentorName,
    mentorSince: m.mentoringSince,
    mentoringInterest: m.mentoringInterest ?? "no",
    mentoringValidated: !!m.mentoringValidated,
  };
}

export default function DashboardMentoring() {
  const router = useRouter();
  const [info, setInfo] = useState<MentorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await fetchMentorInfo();
      setInfo(data);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <MonoLabel className="text-lime">Chargement…</MonoLabel>
        <Loader2 className="mt-3 size-6 animate-spin" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <MonoLabel className="text-destructive">Profil incomplet</MonoLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          Impossible de charger les informations de mentorat.
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl w-full px-5 sm:px-8 py-12">
      <MonoLabel className="text-lime mb-2">VOTRE MENTORAT</MonoLabel>

      <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
        Suivi de mentorat
      </h1>

      {/* État actuel */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-6 mb-10">
        {info.mentoringValidated ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-lime" />
            <span className="text-foreground font-medium">
              Mentorat {info.mentoringInterest === "yes" ? "validé" : "en cours"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <UserX className="size-6 text-destructive" />
            <span className="text-muted-foreground">
              Aucun mentor attribué pour le moment
            </span>
          </div>
        )}

        {info.hasMentor && (
          <p className="mt-2 text-sm text-muted-foreground">
            Vous êtes accompagné·e par {info.mentorName ?? "un mentor"} depuis {info.mentorSince || "—"}
          </p>
        )}

        {!info.hasMentor && info.mentoringInterest === "yes" && (
          <p className="mt-2 text-sm text-lime">
            Vous avez exprimé votre intérêt pour un mentor — un membre de
            l'équipe vous contactera sous 48 h.
          </p>
        )}

        {!info.hasMentor && info.mentoringInterest === "maybe" && (
          <p className="mt-2 text-sm text-amber-400">
            Vous avez indiqué « Peut-être ». Modifiez votre choix dans votre
            espace personnel.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 space-y-4">
        {/* Bouton: Trouver un mentor */}
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-lime text-black px-6 py-3 font-medium hover:bg-lime/90 transition-colors"
          onClick={() => router.push("/dashboard/mentoring/setup")}
        >
          Trouver un mentor
        </button>

        {/* Historique des mentorats */}
        <details className="group">
          <summary className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors">
            Historique
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-2 text-xs text-muted-foreground">
            <p>Aucun historique pour le moment</p>
          </div>
        </details>
      </div>
    </main>
  );
}