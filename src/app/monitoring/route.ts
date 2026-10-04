import { NextRequest, NextResponse } from "next/server";

// Le tunnel ne doit jamais être pré-rendu ni mis en cache :
// chaque requête transporte une enveloppe Sentry différente.
export const dynamic = "force-dynamic";

/**
 * En-têtes relais du client vers l'ingestion Sentry.
 * - `sentry-trace` / `baggage` : poursuite du traçage distribué.
 * - `dsn` / `x-sentry-auth` : auth transmise par le SDK quand il en fournit.
 * On ne relaie volontairement ni `content-length` ni les en-têtes
 * hop-by-hop (connexion, transfert, keep-alive…) : `fetch` les recalcule.
 */
const FORWARDED_HEADERS = ["sentry-trace", "baggage", "dsn", "x-sentry-auth"] as const;

/**
 * Dérive l'URL d'ingestion depuis `SENTRY_DSN` à chaque requête.
 * `new URL(dsn).host` donne l'hôte d'ingestion de la bonne région
 * (ex. `o…​.ingest.de.sentry.io` pour l'UE) et le dernier segment du
 * chemin est l'id numérique du projet : rien n'est codé en dur, donc un
 * changement de région/projet côté Sentry reste pris en charge.
 * Retourne `null` si le DSN est absent ou illisible.
 */
function getEnvelopeUrl(): string | null {
  const raw = process.env.SENTRY_DSN;
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const projectId = segments[segments.length - 1];
  if (!url.host || !projectId) return null;
  return `https://${url.host}/api/${projectId}/envelope/`;
}

/** Extrait les en-têtes à relayer vers l'amont, sans les hop-by-hop. */
function pickForwardHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

/**
 * Réponse sûre quand le tunnel est inutilisable (DSN absent/illisible).
 * On répond 204 et non 5xx : une 5xx ferait retenter l'envoi côté SDK en
 * boucle et polluerait les logs, alors qu'un DSN manquant (ex. env local
 * non configuré) doit rester silencieux.
 */
function tunnelUnavailable(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * POST /monitoring — relaie les enveloppes Sentry vers l'ingestion.
 * Le corps est lu en brut (`text()`, jamais parsé en JSON : c'est une
 * enveloppe Sentry, potentiellement binaire) puis transféré tel quel.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const target = getEnvelopeUrl();
  if (!target) return tunnelUnavailable();

  const body = await req.text();
  const headers = pickForwardHeaders(req);
  headers.set("Content-Type", "application/x-sentry-envelope");

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: "POST", headers, body });
  } catch {
    // Ingestion Sentry injoignable (réseau/DNS) : 502, sans exposer le DSN.
    return NextResponse.json({ error: "Sentry injoignable" }, { status: 502 });
  }
  if (!upstream.ok) {
    // Échec amont (quota, enveloppe rejetée…) : 502 générique, sans
    // recopier le corps amont ni la clé du DSN dans la réponse.
    return NextResponse.json({ error: "Échec d'envoi vers Sentry" }, { status: 502 });
  }
  return new NextResponse(null, { status: 200 });
}

/**
 * GET /monitoring — sonde de vivacité du tunnel.
 * Le SDK navigateur émet des requêtes GET (vérifications de session /
 * vivacité) sur l'URL du tunnel : un GET n'a rien à relayer vers
 * l'ingestion (qui n'accepte que des POST d'enveloppes), on répond donc
 * localement. 200 = tunnel en place et DSN configuré.
 */
export async function GET(): Promise<NextResponse> {
  if (!getEnvelopeUrl()) return tunnelUnavailable();
  return new NextResponse(null, { status: 200 });
}
