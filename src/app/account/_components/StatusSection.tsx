import * as React from "react";
import { CheckCircle2, Clock, Hourglass, MessageCircle, XCircle } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/profiling/auto-controls";
import type { AccountStatus } from "./types";

/**
 * Section "Statut & prochaines étapes".
 * Server component : pas d'interaction directe (sauf le bouton WhatsApp).
 *
 * Variantes :
 *  - APPROVED : lien WhatsApp + confirmation
 *  - PENDING : explication + suggestion (mettre à jour l'objectif)
 *  - WAITLIST : "On revient vers toi"
 *  - REJECTED : message neutre + invitation à mettre à jour
 */
export function StatusSection({ status }: { status: AccountStatus }) {
  switch (status.profileStatus) {
    case "APPROVED":
      return <Approved />;
    case "PENDING":
      return <Pending />;
    case "WAITLIST":
      return <Waitlist />;
    case "REJECTED":
      return <Rejected />;
    default:
      return null;
  }
}

function Approved() {
  return (
    <section className="rounded-md border border-lime/30 bg-lime/5 p-5 sm:p-6 space-y-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="size-5 text-lime shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display font-bold text-lg">Tu es validé dans HASHCODE.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bienvenue dans la communauté. Rejoins le groupe WhatsApp officiel pour suivre
            les sessions, partager tes progrès et rencontrer les autres membres.
          </p>
        </div>
      </div>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-lime text-black hover:bg-lime/90 font-medium border border-transparent min-h-[48px] h-12 px-6 text-base w-full sm:w-auto"
      >
        <MessageCircle className="size-4" />
        Rejoindre le groupe WhatsApp
      </a>
    </section>
  );
}

function Pending() {
  return (
    <section className="rounded-md border border-amber-500/30 bg-amber-500/5 p-5 sm:p-6 space-y-3">
      <div className="flex items-start gap-3">
        <Clock className="size-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display font-bold text-lg">On examine ton dossier.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quelques points peuvent nécessiter une vérification humaine (email, complétude
            du profil, demande de mentorat prioritaire). On revient vers toi rapidement.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Conseil : complète ton objectif à 3 mois ci-dessous. Ça aide beaucoup à la
            validation.
          </p>
        </div>
      </div>
    </section>
  );
}

function Waitlist() {
  return (
    <section className="rounded-md border border-blue-500/30 bg-blue-500/5 p-5 sm:p-6 space-y-3">
      <div className="flex items-start gap-3">
        <Hourglass className="size-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display font-bold text-lg">Tu es sur la liste d&apos;attente.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Les prochaines vagues s&apos;ouvrent en fonction des places disponibles. On te
            contactera par email dès qu&apos;une place se libère — inutile de recréer un
            profil.
          </p>
        </div>
      </div>
    </section>
  );
}

function Rejected() {
  return (
    <section className="rounded-md border border-red-500/30 bg-red-500/5 p-5 sm:p-6 space-y-3">
      <div className="flex items-start gap-3">
        <XCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display font-bold text-lg">Profil non retenu cette fois.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu peux mettre à jour tes informations ci-dessous et repasser la validation.
            On relit les dossiers chaque semaine.
          </p>
        </div>
      </div>
    </section>
  );
}
