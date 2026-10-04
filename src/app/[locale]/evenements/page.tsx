import type { Metadata } from "next";
import { getSession } from "@/lib/account-auth";
import { listPublicEvents } from "@/lib/public-events";
import { PublicEventsPage } from "@/components/reboot/public-events-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Événements — HASHCODE REBOOT",
  description:
    "Découvrez les prochains workshops, sessions, meetups et événements de la communauté HASHCODE REBOOT.",
  alternates: { canonical: "/evenements" },
  openGraph: {
    title: "Événements — HASHCODE REBOOT",
    description:
      "Découvrez les prochains workshops, sessions, meetups et événements de la communauté HASHCODE REBOOT.",
    type: "website",
    url: "/evenements",
  },
};

/**
 * Page PUBLIQUE /evenements — accessible sans compte.
 *
 * Vue membre connecté → RSVP enregistré ; visiteur anonyme → signal d'intérêt
 * (aucune donnée personnelle) + invitation à créer son profil.
 */
export default async function EvenementsPage() {
  // getSession() n'exige pas d'authentification : null si visiteur anonyme.
  // Les événements sont rendus côté serveur (indexables + visibles sans JS).
  const [session, initial] = await Promise.all([
    getSession().catch(() => null),
    listPublicEvents({ limit: 20 })
      .then((events) => ({ loaded: true, events }))
      .catch(() => ({ loaded: false, events: [] })),
  ]);

  return (
    <PublicEventsPage
      isAuthed={Boolean(session)}
      firstName={session?.member.firstName ?? null}
      initialEvents={initial.events}
      initialLoaded={initial.loaded}
    />
  );
}
