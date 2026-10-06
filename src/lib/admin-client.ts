/**
 * Verdict discriminant d'une reponse d'API admin, cote client.
 *
 * POURQUOI CE MODULE EST SEPARE DE TOUT COMPOSANT
 *
 * C'est la piece qui etait implicite et non testable dans 20 composants :
 * chacun refaisait `status === 401 || code === "UNAUTHORIZED"` a la main, et
 * chacun a son tour decidait quoi faire du 403. `classifyAdminResponse` est la
 * seule fonction du depot qui repond a la question "que doit faire le
 * navigateur ?", et elle est pure : ni React, ni `window`, ni `fetch`.
 *
 * LE CONTRAT D24, RENDU EXPLICITE
 *
 *   - 401 `AUTH_REQUIRED`  : aucune session admin. Le client redirige vers la
 *                            connexion. C'est le seul cas qui justifie une
 *                            redirection.
 *   - 403 `FORBIDDEN`      : session VALIDE, role insuffisant. Ce n'est PAS une
 *                            session expiree. Reconnecter ne servirait a rien et
 *                            ne redirige pas : le refus s'affiche tel quel.
 *
 * C'etait le bug D24 : le dashboard et 10 autres sites confondaient les deux et
 * basculaient vers la page de connexion sur un simple role insuffisant. Pire,
 * `TestEmailPanel.tsx:26` fusionnait explicitement les deux cas
 * (`status === 401 || ... || status === 403`) et redirigait donc sur 403.
 *
 * L'ordre de test compte : le **statut** est le signal primaire et il est lu
 * avant le `code`. Une reponse 403 doit rester un 403 meme si elle porte un
 * `code` historique ; on ne laisse pas un `code` lever un 403 au rang de
 * « session expiree ».
 *
 * Aucun composant ne doit plus ecrire cette detection a la main : passer par
 * `classifyAdminResponse`, via `adminRequest` / `useAdminQuery`.
 */

export type AdminVerdictKind =
  /** Reponse exploitable. */
  | "ok"
  /** 401 : pas de session admin. Seul cas qui declenche une redirection. */
  | "unauthorized"
  /** 403 : session valide, role insuffisant. Pas de redirection. */
  | "forbidden"
  /** 429 : quota epuise. Le message porte le `Retry-After`. */
  | "rateLimited"
  /** Toute autre reponse en echec. */
  | "error";

export interface AdminVerdict {
  kind: AdminVerdictKind;
  /**
   * Message affichable. Renseigné pour `forbidden`, `rateLimited` et `error` ;
   * absent pour `ok` et `unauthorized`, qui ne s'affichent pas (le premier est
   * un succes, le second déclenche une redirection).
   */
  message?: string;
  /** Secondes restantes, le cas echeant. */
  retryAfterSec?: number | null;
}

/** Champs minimaux d'une reponse, tels que renvoyes par `fetchJson`. */
export interface AdminResponseLike {
  status: number;
  code?: string | null;
  error?: string | null;
  retryAfterSec?: number | null;
}

/** Message par defaut quand le serveur n'en fournit pas. */
export const DEFAULT_ADMIN_ERROR = "Erreur de chargement.";

/**
 * Message affiche quand le serveur refuse sans motif (403 sans `error`).
 *
 * Chaine identique a `ForbiddenError` dans `src/lib/errors.ts` : le client ne
 * doit pas inventer un libelle different de celui que le serveur enverrait.
 */
export const DEFAULT_FORBIDDEN_MESSAGE = "Accès refusé.";

/**
 * Compose le message d'un 429 avec le `Retry-After`.
 *
 * SOURCE UNIQUE de la chaine : `fetchJson.withRetryAfter` delegue ici. Deux
 * implementations avaient diverge, et 7 sites reecrivaient l'appel en inline.
 */
export function appendRetryAfter(
  base: string,
  retryAfterSec: number | null,
): string {
  if (retryAfterSec !== null && Number.isFinite(retryAfterSec)) {
    return `${base} Réessaie dans ${retryAfterSec}s.`;
  }
  return base;
}

/**
 * Verdict unique d'une reponse admin.
 *
 * @param res      Reponse (`fetchJson` renvoie `{res, code, error, retryAfterSec}`).
 * @param fallback Message d'erreur a utiliser si le serveur n'en fournit pas.
 */
export function classifyAdminResponse(
  res: AdminResponseLike,
  fallback: string = DEFAULT_ADMIN_ERROR,
): AdminVerdict {
  const code = typeof res.code === "string" ? res.code.toUpperCase() : "";
  const serverMessage =
    typeof res.error === "string" && res.error.length > 0 ? res.error : fallback;
  const retryAfterSec = res.retryAfterSec ?? null;

  // 1. 403 d'abord. Le statut prime toujours sur le code : une route qui
  //    repond 403 doit rester « acces refuse », jamais « session expiree ».
  if (res.status === 403 || code === "FORBIDDEN") {
    // Le repli du 403 est le refus, PAS le message generique d'echec de
    // chargement : « Erreur de chargement. » sur un refus de role serait faux
    // et renverrait vers le bouton « Reessayer », qui ne peut rien changer.
    const hasServerMessage =
      typeof res.error === "string" && res.error.length > 0;
    return {
      kind: "forbidden",
      message: hasServerMessage ? (res.error as string) : DEFAULT_FORBIDDEN_MESSAGE,
      retryAfterSec,
    };
  }

  // 2. 401 : plus de session admin. Seul cas de redirection.
  //    `UNAUTHORIZED` est le code historique de `AuthError` sur les routes
  //    non migrees ; `AUTH_REQUIRED` est la valeur par defaut depuis D24.
  if (
    res.status === 401 ||
    code === "AUTH_REQUIRED" ||
    code === "UNAUTHORIZED"
  ) {
    return { kind: "unauthorized", retryAfterSec };
  }

  // 3. 429 : quota. Le message conserve le Retry-After pour l'utilisateur.
  if (res.status === 429 || code === "RATE_LIMITED") {
    return {
      kind: "rateLimited",
      message: appendRetryAfter(serverMessage, retryAfterSec),
      retryAfterSec,
    };
  }

  if (res.status >= 200 && res.status < 300) {
    return { kind: "ok" };
  }

  return { kind: "error", message: serverMessage, retryAfterSec };
}
