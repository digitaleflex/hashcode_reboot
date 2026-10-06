"use client";

/**
 * `adminQuery()` — D25. Point unique de décision du client admin.
 *
 * AVANT, chaque écran refaisait le meme bloc a la main :
 *
 *   const { res, data, error, code, retryAfterSec } = await fetchJson(url, init);
 *   if (res.status === 401 || code === "UNAUTHORIZED") { onSessionExpired(); return; }
 *   if (!res.ok) throw new Error(
 *     res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(...) : ...);
 *
 * Mesure réelle avant refactor (côté `components/reboot/admin/**` +
 * `app/[locale]/{admin,dashboard}/**`) : **31 sites `status === 401`** dans
 * 20 fichiers, **16 sites `status === 429`** dans 12 fichiers, et 11
 * `handleSessionExpired` redefinis vers `/?admin=1` avec 3 strategies
 * divergentes (`router.push`, `window.location.href`, `window.location.assign`).
 *
 * APRES, un seul appel. Le bloc n'existe plus dans les composants.
 *
 * LE POINT QUI CHANGE TOUT (contrat D24)
 *
 *   401 = pas de session admin   -> redirection vers la connexion
 *   403 = session valide, role insuffisant -> AUCUNE redirection
 *
 * Le 403 était traité comme une session expirée : on renvoyait un admin dont la
 * session est parfaitement valide vers la page de connexion, sans raison.
 * Ici le 403 remonte en `error`/`forbidden` avec le message du serveur, et
 * l'écran affiche « Accès refusé. » tel quel. Voir `tests/admin-client-d25.test.cjs`.
 *
 * L'export `useAdminQuery` encapsule en plus `useQuery` : c'est le point
 * d'entrée de D32.
 */

import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { fetchJson } from "./fetchJson";
import {
  classifyAdminResponse,
  type AdminVerdict,
  type AdminVerdictKind,
} from "@/lib/admin-client";

/**
 * Destination unique en cas de 401.
 *
 * Une seule strategie : rechargement complet vers la page de connexion. Le
 * `router.push` etait le pire des trois — navigation cliente alors que la
 * session serveur vient justement d'etre invalidee, donc le rendu pouvait
 * survivre quelques instants avec des donnees admin en memoire. Le rechargement
 * complet repasse par la garde serveur de `admin/layout.tsx`.
 */
export const ADMIN_SIGNIN_URL = "/login?next=%2Fadmin";

/** Redirige vers la connexion. Seul appelant : le verdict 401. */
export function redirectToAdminSignIn(url: string = ADMIN_SIGNIN_URL): void {
  if (typeof window === "undefined") return;
  window.location.href = url;
}

/**
 * Erreur admin porteuse du verdict.
 *
 * Le `kind` permet a l'appelant de distinguer un refus (403) d'une panne, sans
 * reanalyser le status. `kind` vaut toujours `forbidden`, `rateLimited` ou
 * `error` : `unauthorized` est emis AVANT le throw (la redirection part), et
 * `ok` ne leve jamais.
 */
export class AdminRequestError extends Error {
  readonly kind: Exclude<AdminVerdictKind, "ok" | "unauthorized">;
  readonly status: number;
  readonly retryAfterSec: number | null;

  constructor(verdict: AdminVerdict, status: number) {
    super(verdict.message ?? "Erreur admin.");
    this.name = "AdminRequestError";
    this.kind = verdict.kind as Exclude<AdminVerdictKind, "ok" | "unauthorized">;
    this.status = status;
    this.retryAfterSec = verdict.retryAfterSec ?? null;
  }
}

/** true si l'erreur est un refus 403 — session valide, role insuffisant. */
export function isForbiddenError(e: unknown): boolean {
  return e instanceof AdminRequestError && e.kind === "forbidden";
}

/** true si l'erreur est un 429 — quota epuise. */
export function isRateLimitedError(e: unknown): boolean {
  return e instanceof AdminRequestError && e.kind === "rateLimited";
}

/** Message affichable d'une erreur admin, quel que soit son type. */
export function adminErrorMessage(e: unknown, fallback = "Erreur de chargement."): string {
  if (e instanceof AdminRequestError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export interface AdminRequestOptions {
  /**
   * Message de repli quand le serveur n'en fournit pas.
   * Defaut : `DEFAULT_ADMIN_ERROR`.
   */
  fallbackMessage?: string;
  /**
   * Destination de la redirection 401. Defaut : `ADMIN_SIGNIN_URL`.
   * Surcharge possible pour un test, ou pour un embarquement hors admin.
   */
  signinUrl?: string;
  /**
   * Desactive la redirection 401 et leve une erreur a la place.
   *
   * Reserve aux cas ou une redirection serait fausse — typiquement une lecture
   * « silencieuse » dont l'echec doit rester affiche. Un 403 n'est JAMAIS
   * concerne : il ne redirige pas, quel que soit ce drapeau.
   */
  noRedirectOnUnauthorized?: boolean;
}

/**
 * Verdict d'une reponse, avec redirection 401 dechainee.
 *
 * Utilise par `adminRequest` (et donc par `useAdminQuery`/`useAdminMutation`).
 * Expose pour les rares appels sequentiels qui reutilisent `fetchJson` et ont
 * besoin de la meme decision.
 */
export function resolveAdminVerdict(
  res: { status: number; code?: string | null; error?: string | null; retryAfterSec?: number | null },
  options: AdminRequestOptions = {},
): AdminVerdict {
  const verdict = classifyAdminResponse(
    { status: res.status, code: res.code, error: res.error, retryAfterSec: res.retryAfterSec },
    options.fallbackMessage,
  );

  // 401 : seul cas de redirection. Le 403 est traite plus haut dans la cascade
  // et n'arrive jamais ici — c'est tout l'objet du test de non-regression D25.
  if (verdict.kind === "unauthorized" && !options.noRedirectOnUnauthorized) {
    redirectToAdminSignIn(options.signinUrl);
  }
  return verdict;
}

/**
 * Lancer une requete admin en transportant deja la decision 401/403/429.
 *
 * Levée : `AdminRequestError` pour 403 / 429 / autre echec. Le 401 redirige et
 * leve aussitot — impossible de rendre une donnee périmée apres invalidation
 * de session.
 *
 * @param init `RequestInit` complet. Le `signal` est fourni par React Query
 *   (via `queryFn`) : c'est ce qui rend l'annulation automatique en D32.
 */
export async function adminRequest<T = unknown>(
  url: string,
  init?: RequestInit,
  options: AdminRequestOptions = {},
): Promise<T> {
  const { res, data, error, code, retryAfterSec } = await fetchJson(url, init);
  const verdict = resolveAdminVerdict(
    { status: res.status, code, error, retryAfterSec },
    options,
  );
  if (verdict.kind === "ok") return data as T;
  if (verdict.kind === "unauthorized") {
    // Redirection déjà partie dans `resolveAdminVerdict`. Si l'appelant a
    // neutralise la redirection, on lui rend une erreur exploitable plutôt que
    // de lui laisser croire que la requête a réussi.
    throw new AdminRequestError(
      { kind: "error", message: "Session admin introuvable.", retryAfterSec: null },
      res.status,
    );
  }
  throw new AdminRequestError(verdict, res.status);
}

/** Options de `useAdminQuery` : les options React Query, plus le message. */
export type AdminQueryOptions<T> = Omit<UseQueryOptions<T, AdminRequestError>, "queryFn" | "queryKey"> & {
  queryKey: readonly unknown[];
  /**
   * URL à interroger. `null` désactive la query — c'est le remplacement direct
   * d'un ancien `if (!id) return` en tête de `useEffect`.
   *
   * Facultative uniquement quand `queryFn` est fourni : une query composée
   * interroge alors plusieurs endpoints et n'a pas d'URL unique.
   */
  url?: string | null;
  /** Message de repli si le serveur n'en fournit pas. */
  fallbackMessage?: string;
  /** Destination 401. Voir `AdminRequestOptions`. */
  signinUrl?: string;
  /** `fetch` additionnel (method, body, headers…). */
  init?: RequestInit;
  /** Transformation de la charge utile avant retour. */
  selectData?: (data: unknown) => T;
  /**
   * Requête composée, pour les écrans qui agrègent PLUSIEURS endpoints dans un
   * seul état (`admin/stats`, `admin/dashboard`).
   *
   * Le `signal` est fourni et doit être transmis à chaque `adminRequest` de la
   * composition, sinon l'annulation automatique ne s'applique qu'à une partie.
   * L'appelant garde la décision 401/403 : chaque appel utilise `adminRequest`.
   */
  queryFn?: (context: { signal: AbortSignal }) => Promise<T>;
};

/**
 * `useQuery` admin : annulation, cache et états de chargement gérés.
 *
 * Remplace le triplet `useEffect` + `fetch` + `AbortController`. Le `signal`
 * est lu depuis le contexte de la query et transmis au `fetch` — l'annulation
 * au demontage ou au changement de clé est donc automatique, sans `ctrl.abort()`
 * à écrire.
 */
export function useAdminQuery<T = unknown>({
  queryKey,
  url,
  fallbackMessage,
  signinUrl,
  init,
  selectData,
  queryFn,
  enabled,
  ...options
}: AdminQueryOptions<T>): UseQueryResult<T, AdminRequestError> {
  return useQuery<T, AdminRequestError>({
    ...options,
    queryKey,
    // `enabled` explicite l'emporte ; sinon la query part dès que l'URL existe.
    enabled: enabled ?? (queryFn !== undefined || url !== null),
    queryFn: async ({ signal }) => {
      if (queryFn) return queryFn({ signal });
      if (url === null || url === undefined) {
        throw new AdminRequestError(
          { kind: "error", message: "URL de requête absente.", retryAfterSec: null },
          0,
        );
      }
      const data = await adminRequest<unknown>(
        url,
        { ...init, signal },
        { fallbackMessage, signinUrl },
      );
      return selectData ? selectData(data) : (data as T);
    },
  });
}

/** Variables d'une mutation admin : l'URL porte les paramètres de l'appel. */
export interface AdminMutationVariables {
  url: string;
  init?: RequestInit;
}

/** Options de `useAdminMutation` : les options React Query, plus le message. */
export type AdminMutationOptions<TData> = Omit<
  UseMutationOptions<TData, AdminRequestError, AdminMutationVariables>,
  "mutationFn"
> & {
  /** Message de repli si le serveur n'en fournit pas. */
  fallbackMessage?: string;
  /** Destination 401. Voir `AdminRequestOptions`. */
  signinUrl?: string;
  /** Transformation de la charge utile avant retour. */
  selectData?: (data: unknown) => TData;
};

/**
 * `useMutation` admin : même decision 401/403/429 sur les écritures.
 *
 * Couvre les anciens blocs `POST`/`PATCH`/`DELETE` qui testaient
 * `res.status === 401` à la main (AnnouncePanel, RelancePanel, TestEmailPanel,
 * ImportInvitePanel, `members/page.tsx`…). L'URL et le `init` sont porté par les
 * variables de la mutation : l'appelant n'a plus qu'une ligne à écrire.
 */
export function useAdminMutation<TData = unknown>({
  fallbackMessage,
  signinUrl,
  selectData,
  ...options
}: AdminMutationOptions<TData>): UseMutationResult<TData, AdminRequestError, AdminMutationVariables> {
  return useMutation<TData, AdminRequestError, AdminMutationVariables>({
    ...options,
    mutationFn: async ({ url, init }: AdminMutationVariables) => {
      const data = await adminRequest<unknown>(url, init, {
        fallbackMessage,
        signinUrl,
      });
      return selectData ? selectData(data) : (data as TData);
    },
  });
}
