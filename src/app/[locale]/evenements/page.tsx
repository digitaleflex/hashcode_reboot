import type { Metadata } from "next";
import { getSession } from "@/lib/account-auth";
import { listPublicEvents } from "@/lib/public-events";
import { PublicEventsPage } from "@/components/reboot/public-events-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Événements HASHCODE REBOOT — sessions, workshops et meetups",
  description:
    "Découvre les prochains événements de HASHCODE REBOOT : sessions, workshops et meetups. Inscris-toi en un clic ou dis-nous que ça t'intéresse.",
  alternates: { canonical: "/evenements" },
  openGraph: {
    title: "Événements HASHCODE REBOOT",
    description:
      "Sessions, workshops et meetups ouverts à la communauté. Inscris-toi ou dis-nous que ça t'intéresse.",
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
