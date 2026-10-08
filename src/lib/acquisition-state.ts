/**
 * HASHCODE REBOOT — Machine à états session d'acquisition (#158).
 *
 * Module PUR, zéro I/O : dérive l'état d'acquisition d'un parcours depuis
 * les preuves déjà écrites (statuts Member, ProfilingDraft, Qualification,
 * Consent, AnalyticsEvent) et expose la garde de transition branchée sur
 * les écritures de statuts. Même pattern que `src/lib/acquisition.ts`.
 *
 * Les statuts Member restent la SOURCE D'ÉCRITURE (aucune table créée,
 * aucune migration) : ce module ne fait que lire (deriveState) et valider
 * (canTransition). Routes gardées : PATCH /api/members/[id] et
 * POST /api/members/bulk (transitions de profileStatus uniquement).
 *
 * HORS MACHINE (documenté, rien codé dessus) :
 * - BOUNCED est écrit par le webhook Brevo (hard bounce → invitationStatus
 *   "BOUNCED", cf. src/app/api/webhooks/brevo/route.ts) : la machine le LIT
 *   comme état terminal, ne l'écrit jamais. canTransition l'accepte comme
 *   cible depuis tout état non terminal (le webhook écrit sans consulter
 *   la garde) mais n'en laisse rien sortir.
 * - invitationStatus ACCEPTED / REFUSED et les colonnes acceptedAt /
 *   refusedAt sont MORTS (aucun écrivain) : deriveState les ignore, aucun
 *   état dédié, aucune transition.
 * - POST /api/invite/refuse est délibérément inerte (anti-énumération) :
 *   hors machine.
 * - invitationStatus INVITED seul (sans profileStatus APPROVED) n'est pas
 *   un état : seules la capture (LEAD_CAPTURED), la validation (CONVERSION),
 *   l'expiration (HANDOFF_FAILED), la jonction (HANDOFF) et le bounce
 *   (BOUNCED) discriminent côté statuts.
 */

/** États du funnel d'acquisition (ordre nominal, hors branches). */
export type AcquisitionState =
  | "VISITOR"
  | "SESSION_STARTED"
  | "DIAGNOSTIC"
  | "LEAD_CAPTURED"
  | "QUALIFIED"
  | "DISQUALIFIED"
  | "INSUFFICIENT_DATA"
  | "CONVERSION"
  | "HANDOFF"
  | "HANDOFF_FAILED"
  | "BOUNCED";

/** Tous les états, dans l'ordre nominal du funnel (BOUNCED terminal en fin). */
export const ACQUISITION_STATES: readonly AcquisitionState[] = [
  "VISITOR",
  "SESSION_STARTED",
  "DIAGNOSTIC",
  "LEAD_CAPTURED",
  "QUALIFIED",
  "DISQUALIFIED",
  "INSUFFICIENT_DATA",
  "CONVERSION",
  "HANDOFF",
  "HANDOFF_FAILED",
  "BOUNCED",
];

/** États terminaux : rien n'en sort (BOUNCED = webhook, HANDOFF = jonction). */
export const TERMINAL_STATES: readonly AcquisitionState[] = [
  "BOUNCED",
  "HANDOFF",
];

/** Arêtes avant explicites (hors boucles idempotentes et cible BOUNCED). */
const EDGES: Record<AcquisitionState, readonly AcquisitionState[]> = {
  VISITOR: ["SESSION_STARTED"],
  SESSION_STARTED: ["DIAGNOSTIC"],
  DIAGNOSTIC: ["LEAD_CAPTURED"],
  // Sortie de capture : snapshot de qualification, ou fast-track admin
  // (une validation humaine ne nécessite pas de snapshot préalable).
  LEAD_CAPTURED: [
    "QUALIFIED",
    "DISQUALIFIED",
    "INSUFFICIENT_DATA",
    "CONVERSION",
  ],
  QUALIFIED: ["CONVERSION", "DISQUALIFIED"],
  // Override humain : un rejeté peut être repêché en validation.
  DISQUALIFIED: ["CONVERSION"],
  INSUFFICIENT_DATA: ["QUALIFIED", "DISQUALIFIED", "CONVERSION"],
  // CONVERSION → LEAD_CAPTURED = retour en revue (dé-validation admin) ;
  // CONVERSION → DISQUALIFIED = exclusion post-hoc (spam découvert tard).
  CONVERSION: ["HANDOFF", "HANDOFF_FAILED", "DISQUALIFIED", "LEAD_CAPTURED"],
  HANDOFF: [],
  // Expiration d'invitation : nouvelle invitation (CONVERSION) ou jonction
  // tardive (HANDOFF).
  HANDOFF_FAILED: ["CONVERSION", "HANDOFF"],
  BOUNCED: [],
};

/**
 * Garde de transition : true si le passage from → to est légal.
 * - Même état → true (idempotence : rejouable sans doublon).
 * - Cible BOUNCED → true depuis tout état non terminal (le webhook écrit
 *   sans consulter la garde ; un email peut bouncer avant la jonction).
 * - États terminaux (BOUNCED, HANDOFF) → rien d'autre que soi-même.
 */
export function canTransition(
  from: AcquisitionState,
  to: AcquisitionState,
): boolean {
  if (from === to) return true;
  if (to === "BOUNCED") return from !== "BOUNCED" && from !== "HANDOFF";
  return EDGES[from].includes(to);
}

// ── Preuves d'entrée (formes minimales, sans dépendance Prisma) ───────────

/** Sous-ensemble Member lu par deriveState (statuts uniquement). */
export interface MemberEvidence {
  profileStatus?: string | null;
  communityStatus?: string | null;
  invitationStatus?: string | null;
}

/**
 * Sous-ensemble ProfilingDraft lu par deriveState. completedAt discrimine
 * (flow complété → LEAD_CAPTURED) ; relanceSentAt confirme l'abandon
 * (reste DIAGNOSTIC, ne fait jamais remonter au-delà).
 */
export interface DraftEvidence {
  completedAt?: Date | string | null;
  relanceSentAt?: Date | string | null;
}

/**
 * Dernière Qualification D'ACQUISITION (lignes ruleVersion "acq-*").
 * Les lignes orientation (status NULL) sont ignorées naturellement.
 * Statuts : QUALIFIED | DISQUALIFIED | INSUFFICIENT_DATA (#211).
 */
export interface QualificationEvidence {
  status?: string | null;
}

/** Dernier Consent (présence = une session a exprimé un choix). */
export interface ConsentEvidence {
  choice?: string | null;
}

/** Événement analytics minimal (seul `type` discrimine). */
export interface AnalyticsEvidence {
  type: string;
}

export interface AcquisitionEvidence {
  member?: MemberEvidence | null;
  draft?: DraftEvidence | null;
  qualification?: QualificationEvidence | null;
  consent?: ConsentEvidence | null;
  analytics?: ReadonlyArray<AnalyticsEvidence> | null;
}

/** Preuves d'un flow complété (Member créé ou snapshot `profil_generated`). */
const LEAD_ANALYTICS = new Set([
  "profil_generated",
  "profile_completed_by_member",
]);

/** Preuves d'un diagnostic en cours (questions / orientation évaluée). */
const DIAGNOSTIC_ANALYTICS = new Set([
  "profiling_started",
  "profiling_question_answered",
  "profiling_question_timed",
  "profiling_back",
  "profiling_resumed",
  "profiling_abandoned",
  "orientation_evaluated",
]);

const QUALIFICATION_STATUSES: readonly string[] = [
  "QUALIFIED",
  "DISQUALIFIED",
  "INSUFFICIENT_DATA",
];

/**
 * Dérive l'état d'acquisition depuis les preuves existantes. Pur, total :
 * entrée vide → VISITOR, jamais d'exception. Précédence : statuts Member
 * (décisions humaines/webhook d'abord), puis snapshot de qualification,
 * puis brouillon, puis signaux session (analytics/consent).
 */
export function deriveState(evidence: AcquisitionEvidence): AcquisitionState {
  const member = evidence.member ?? null;
  if (member?.invitationStatus === "BOUNCED") return "BOUNCED";
  if (member?.communityStatus === "JOINED") return "HANDOFF";
  if (member?.invitationStatus === "EXPIRED") return "HANDOFF_FAILED";
  if (member?.profileStatus === "APPROVED") return "CONVERSION";
  if (member?.profileStatus === "REJECTED") return "DISQUALIFIED";

  // WAITLIST / PENDING (et invitationStatus INVITED / ACCEPTED / REFUSED,
  // morts ou non discriminants) : tombent plus bas, vers la capture.
  const qStatus = evidence.qualification?.status ?? null;
  if (qStatus && QUALIFICATION_STATUSES.includes(qStatus)) {
    return qStatus as AcquisitionState;
  }

  const types = evidence.analytics ?? [];
  const hasLeadSignal =
    (evidence.draft?.completedAt ?? null) != null ||
    member != null ||
    types.some((e) => LEAD_ANALYTICS.has(e.type));
  if (hasLeadSignal) return "LEAD_CAPTURED";

  const hasDiagnosticSignal =
    evidence.draft != null ||
    types.some((e) => DIAGNOSTIC_ANALYTICS.has(e.type));
  if (hasDiagnosticSignal) return "DIAGNOSTIC";

  if (types.length > 0 || evidence.consent != null) return "SESSION_STARTED";
  return "VISITOR";
}

/**
 * Projette un profileStatus cible vers l'état correspondant (garde des
 * routes admin). PENDING / WAITLIST = capture sans validation ;
 * valeur inconnue → LEAD_CAPTURED (repli sûr, les routes valident avant).
 */
export function profileStatusToState(status: string): AcquisitionState {
  if (status === "APPROVED") return "CONVERSION";
  if (status === "REJECTED") return "DISQUALIFIED";
  return "LEAD_CAPTURED";
}
