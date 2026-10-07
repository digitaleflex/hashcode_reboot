// HASHCODE REBOOT — notifications Discord (webhook).
//
// Principe : une alerte ne doit JAMAIS faire échouer l'appelant. Un Discord
// indisponible, un webhook expiré ou une variable absente ne justifient pas de
// casser un cron, un backup ou une route de santé. Toute erreur est donc
// journalisée puis absorbée, et la fonction retourne toujours un verdict.
//
// Sécurité : l'URL du webhook EST un secret (elle permet de poster dans le
// salon). Elle n'est jamais journalisée, ni incluse dans un message d'erreur,
// ni renvoyée dans la réponse de la route qui l'appelle.

/** Vert — opération réussie. */
export const DISCORD_COLOR_OK = 0x2ecc71;
/** Orange — dégradé, à surveiller mais pas bloquant. */
export const DISCORD_COLOR_WARN = 0xe67e22;
/** Rouge — échec réel, action humaine attendue. */
export const DISCORD_COLOR_ERROR = 0xe74c3c;
/** Bleu — information neutre. */
export const DISCORD_COLOR_INFO = 0x3498db;

/** Champ d'un embed Discord. */
export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordAlertInput {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
}

/**
 * Poste un embed sur le webhook Discord configuré.
 *
 * Timeout 5 s : une route de santé qui attend Discord pendant 30 s pendant
 * qu'un webhook est down deviendrait elle-même un faux positif de santé.
 */
export async function sendDiscordAlert(
  input: DiscordAlertInput,
): Promise<{ ok: boolean; status?: number }> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.warn("[Discord] DISCORD_WEBHOOK_URL non configuré — alerte ignorée");
    return { ok: false };
  }
  const embed: Record<string, unknown> = {
    title: input.title,
    timestamp: new Date().toISOString(),
  };
  if (input.description !== undefined) embed.description = input.description;
  if (input.color !== undefined) embed.color = input.color;
  if (input.fields !== undefined) embed.fields = input.fields;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: null, embeds: [embed] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Jamais `url` dans le log : c'est le secret lui-même.
      console.error("[Discord] échec de l'envoi", { status: res.status });
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    // Type d'erreur uniquement : le message peut contenir l'URL (fetch le
    // met dans `cause` sur les erreurs réseau).
    console.error("[Discord] envoi impossible", {
      name: err instanceof Error ? err.name : typeof err,
    });
    return { ok: false };
  }
}