import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/account-auth";
import { getPublicEventDetail } from "@/lib/event-detail";
import { EventDetailPage } from "@/components/reboot/event-detail/event-detail-page";

export const dynamic = "force-dynamic";

/**
 * /evenements/[id] — page de détail PUBLIQUE d'un événement.
 *
 * Route plus spécifique que le catch-all `[locale]/[...rest]` : elle est donc
 *prioritaire, et `notFound()` rend la 404 localisée de `app/[locale]`.
 *
 * La page s'appuie sur `getPublicEventDetail`, qui n'applique AUCUN filtre de
 * date ni de statut (contrairement à `listPublicEvents`) : un lien partagé vers
 * un événement passé reste consultable et affiche « Terminé » / « Annulé ».
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getPublicEventDetail(id).catch(() => null);

  if (!event) {
    return { title: "Événement introuvable — HASHCODE REBOOT" };
  }

  const when = new Date(event.startsAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    title: `${event.title} — HASHCODE REBOOT`,
    description:
      event.description?.slice(0, 155) ??
      `${event.title} : ${when}. Rejoignez la communauté HASHCODE REBOOT.`,
    alternates: { canonical: `/evenements/${event.id}` },
    openGraph: {
      title: `${event.title} — HASHCODE REBOOT`,
      description:
        event.description?.slice(0, 155) ??
        `${event.title} : ${when}. Rejoignez la communauté HASHCODE REBOOT.`,
      type: "article",
      url: `/evenements/${event.id}`,
    },
  };
}

export default async function EvenementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession().catch(() => null);
  const event = await getPublicEventDetail(id, session?.memberId ?? null).catch(
    () => null,
  );

  if (!event) notFound();

  return <EventDetailPage event={event} isAuthed={Boolean(session)} />;
}