import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { SessionDetailView } from "../../../_components/SessionDetailView";

export const dynamic = "force-dynamic";

/**
 * /dashboard/ateliers/[slug]/sessions/[sessionId] — page wrapper
 * Server Component. Garde session, vérifie l'existence de la séance
 * et du Workship publié, puis délègue toute l'interactivité au
 * composant client SessionDetailView.
 *
 * Le composant client gère les erreurs 403/404 d'API côté UI
 * (SESSION_LOCKED, NOT_ENROLLED) avec des écrans dédiés : pas
 * de double vérification serveur (qui ne ferait que coûter un
 * tour de DB inutile).
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}) {
  const session = await getSession();
  if (!session) {
    const { slug, sessionId } = await params;
    redirect(`/login?next=${encodeURIComponent(`/dashboard/ateliers/${slug}/sessions/${sessionId}`)}`);
  }

  const { slug, sessionId } = await params;

  // Vérification minimaliste : la séance existe-t-elle dans un atelier publié ?
  // Le gating complet (enrollment + unlock) est fait par l'API (#85) et
  // rendu par le composant client (écran verrouillé / non inscrit).
  const ws = await db.workshopSession.findUnique({
    where: { id: sessionId },
    select: {
      week: {
        select: {
          workshop: { select: { slug: true, status: true } },
        },
      },
    },
  });
  if (!ws || ws.week.workshop.slug !== slug || ws.week.workshop.status !== "published") {
    notFound();
  }

  return <SessionDetailView slug={slug} sessionId={sessionId} />;
}
