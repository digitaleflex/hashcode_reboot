import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MentoringSetupPage() {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12">
      <div className="mx-auto max-w-xl">
        <Link
          href="/dashboard/mentoring"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour au mentorat
        </Link>
        <h1 className="font-display text-2xl font-semibold">Trouver un mentor</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Cette page est en cours de développement. Vous pourrez bientôt configurer vos préférences de mentorat et lancer une recherche.
        </p>
        <div className="mt-8 rounded-xl border border-border bg-card/25 p-5 text-sm text-muted-foreground">
          <ul className="list-disc pl-4 space-y-1.5">
            <li>Domaines d’intérêt</li>
            <li>Objectifs de progression</li>
            <li>Disponibilité hebdomadaire</li>
            <li>Format préféré (visio, chat, hybride)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
