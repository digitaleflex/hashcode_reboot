/**
 * HASHCODE REBOOT — Contrat handoff Reboot-only (#212).
 *
 * Module PUR, zero I/O : aucune lecture DB, aucun fetch, aucun Date.now,
 * aucun random. Il definit l'enveloppe versionnee exportee vers
 * l'ecosysteme (JoinHashCode lit, Reboot n'y rejoue jamais le parcours)
 * et les helpers deterministes qui l'entourent (cle d'idempotence,
 * parsing UTM, garde consentement, retry tardif).
 *
 * Version initiale : HANDOFF_CONTRACT_VERSION = "1.0.0".
 *
 * MAPPING CHAMP PAR CHAMP (entree Reboot -> payload) :
 * | payload                    | source Reboot                              | note                                             |
 * |----------------------------|----------------------------------------------|-----------------------------------------------|
 * | contractVersion            | HANDOFF_CONTRACT_VERSION                     | litteral "1.0.0", casse tout changement        |
 * | memberRef                  | Member.id                                    | opaque, JAMAIS email/tel/nom (zéro PII)         |
 * | source.raw                 | draftSourceUTM sinon Member.source           | valeur retenue, tronquee 120                    |
 * | source.source/medium/campaign | parseSourceUTM(raw)                       | "a/b?c" -> {a,b,c} ; "direct" -> {direct,"",""} |
 * | intention                  | Member.mentoringInterest                     | no | maybe | yes | null                       |
 * | interets                   | secondaryDomains + domainSpecialty +         | JSON ou tableau, minuscules, dedup, max 20x40   |
 * |                            | mentoringTypes                               |                                                 |
 * | objectif.{goal,threeMonthGoal} | Member.goal + Member.threeMonthGoal        | enums profilage, goal 3 mois max 280            |
 * | niveau                     | Member.level                                 | beginner|practicing|autonomous|advanced       |
 * | disponibilite              | Member.availability + availabilityTimes      | enum + texte libre max 80                       |
 * | domaine.{principal,secondaires} | Member.primaryDomain + secondaryDomains   | segmentation acquisition (additif au spec)      |
 * | qualification              | Qualification courante (ligne "acq-*")       | score 0..100, status, ruleVersion /^acq-/, mots  |
 * | consent                    | Consent courant purpose "handoff"            | choice granted EXIGE, sinon pas de payload      |
 * | metadata.invitedAt/joinedAt/approvedAt | Member.timestamps                  | ISO ou null, jamais generes ici                 |
 * | metadata.events            | ["admin_invite","whatsapp_join_clicked"]     | defaut, sans PII (types, pas de contenu)        |
 * | metadata.idempotencyKey    | handoffIdempotencyKey(memberId, approvedAt)  | "handoff:<id>:<ISO|sans-validation>"            |
 *
 * INTERDICTIONS (boundary) : aucune table Conversion / LeadSource /
 * AcquisitionSession, aucune migration, aucun import JoinHashCode, aucun
 * appel reseau. normalizeSource existant INCHANGE (le parsing UTM est
 * une projection d'export, pas une seconde normalisation).
 */

import { z } from "zod";
import { canTransition, type AcquisitionState } from "./acquisition-state";

/** Version du contrat handoff (litteral fige, casse tout changement). */
export const HANDOFF_CONTRACT_VERSION = "1.0.0" as const;

/** Finalite de consentement exigee pour exporter un payload. */
export const HANDOFF_CONSENT_PURPOSE = "handoff" as const;

/** Evenements journalises avec le handoff (types existants, sans PII). */
export const HANDOFF_JOURNAL_EVENTS = [
  "admin_invite",
  "whatsapp_join_clicked",
] as const;

/** ISO-8601 ou null (les timestamps d'entree sont convertis, jamais crees). */
const isoDateOrNull = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date ISO invalide.")
  .nullable();

const handoffSourceSchema = z.object({
  raw: z.string().max(120),
  source: z.string().max(120),
  medium: z.string().max(120),
  campaign: z.string().max(120),
});

const handoffQualificationSchema = z.object({
  score: z.number().min(0).max(100),
  status: z.enum(["QUALIFIED", "DISQUALIFIED", "INSUFFICIENT_DATA"]),
  ruleVersion: z.string().regex(/^acq-/, "ruleVersion acquisition attendue (prefixe acq-).").max(60),
  reasons: z.array(z.string().max(80)).max(20),
});

const handoffConsentSchema = z.object({
  purpose: z.literal(HANDOFF_CONSENT_PURPOSE),
  choice: z.enum(["granted", "withdrawn"]),
  textVersion: z.string().trim().min(1).max(60),
  createdAt: isoDateOrNull,
});

/**
 * Enveloppe handoff versionnee. contractVersion fige le lecteur :
 * tout champ ajoute plus tard reste optionnel sous "1.0.0".
 */
export const handoffPayloadSchema = z.object({
  contractVersion: z.literal(HANDOFF_CONTRACT_VERSION),
  memberRef: z.string().trim().min(1).max(40),
  source: handoffSourceSchema,
  intention: z.enum(["no", "maybe", "yes"]).nullable(),
  interets: z.array(z.string().max(40)).max(20),
  objectif: z.object({
    goal: z.enum([
      "project",
      "employment",
      "freelance",
      "upskill",
      "business",
      "career",
      "other",
    ]),
    threeMonthGoal: z.string().max(280).nullable(),
  }),
  niveau: z.enum(["beginner", "practicing", "autonomous", "advanced"]),
  disponibilite: z.object({
    availability: z.enum(["<2h", "2-5h", "5-10h", "10-15h", "15h+"]),
    availabilityTimes: z.string().max(80).nullable(),
  }),
  domaine: z.object({
    principal: z.enum(["web", "cybersecurity", "ai"]),
    secondaires: z.array(z.string().max(40)).max(3),
  }),
  qualification: handoffQualificationSchema,
  consent: handoffConsentSchema,
  metadata: z.object({
    invitedAt: isoDateOrNull,
    joinedAt: isoDateOrNull,
    approvedAt: isoDateOrNull,
    events: z.array(z.string().max(60)).max(20),
    idempotencyKey: z.string().min(1).max(120),
  }),
});

export type HandoffPayload = z.infer<typeof handoffPayloadSchema>;

// ── Entrees (vues minimales, sans dependance Prisma) ────────────────────

/** Sous-ensemble Member lu par buildHandoffPayload (jamais email/tel/nom). */
export interface HandoffMemberView {
  id: string;
  primaryDomain: string;
  secondaryDomains?: unknown;
  domainSpecialty?: unknown;
  mentoringTypes?: unknown;
  mentoringInterest?: string | null;
  goal?: string | null;
  threeMonthGoal?: string | null;
  level?: string | null;
  availability?: string | null;
  availabilityTimes?: string | null;
  source?: string | null;
  invitedAt?: Date | string | null;
  joinedAt?: Date | string | null;
  approvedAt?: Date | string | null;
}

/** Ligne Qualification d'acquisition courante (filtre ruleVersion "acq-*"). */
export interface HandoffQualificationView {
  score: number;
  status: string;
  ruleVersion: string;
  reasons: unknown;
}

/** Ligne Consent courante pour (email, "handoff"). */
export interface HandoffConsentView {
  purpose: string;
  choice: string;
  textVersion: string;
  createdAt: Date | string | null;
}

export interface HandoffInput {
  member: HandoffMemberView;
  qualification: HandoffQualificationView;
  consent: HandoffConsentView;
  /** ProfilingDraft.sourceUTM brut, prioritaire sur Member.source quand present. */
  draftSourceUTM?: unknown;
  /** Defaut : HANDOFF_JOURNAL_EVENTS. */
  events?: unknown;
}

// ── Helpers purs ─────────────────────────────────────────────────────────

/** Date|string|null -> ISO string | null (entree invalide -> null). */
export function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || Number.isNaN(Date.parse(t))) return null;
  return new Date(t).toISOString();
}

/** "source/medium?campaign" (format getOrCreateSource) -> structure. */
export function parseSourceUTM(raw: unknown): {
  source: string;
  medium: string;
  campaign: string;
} {
  const v = typeof raw === "string" ? raw.trim().slice(0, 120) : "";
  if (!v || v.toLowerCase() === "direct") {
    return { source: "direct", medium: "", campaign: "" };
  }
  const q = v.indexOf("?");
  const path = (q === -1 ? v : v.slice(0, q)).trim();
  const campaign = (q === -1 ? "" : v.slice(q + 1)).trim().slice(0, 120);
  const slash = path.indexOf("/");
  const source = (slash === -1 ? path : path.slice(0, slash)).trim().slice(0, 120);
  const medium = (slash === -1 ? "" : path.slice(slash + 1)).trim().slice(0, 120);
  return {
    source: (source || "direct").toLowerCase(),
    medium: medium.toLowerCase(),
    campaign,
  };
}

/** Tableau de chaines JSON ou brut -> liste normalisee (dedup, bornee). */
function parseStringList(v: unknown): string[] {
  let arr: unknown = v;
  if (typeof v === "string") {
    try {
      arr = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const t = item.trim().toLowerCase().slice(0, 40);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

/**
 * Cle d'idempotence deterministe : meme (memberId, approvedAt) = meme cle.
 * approvedAt null (jamais valide) -> suffixe "sans-validation".
 * Sans PII : memberId opaque + timestamp, jamais email/tel/nom.
 */
export function handoffIdempotencyKey(
  memberId: string,
  approvedAt: Date | string | null | undefined,
): string {
  const id = memberId.trim().slice(0, 40);
  const iso = toIsoOrNull(approvedAt) ?? "sans-validation";
  return `handoff:${id}:${iso}`;
}

/**
 * Retry tardif : rejouable si l'etat courant peut aller vers HANDOFF.
 * Nominal : CONVERSION -> HANDOFF. Expiration : HANDOFF_FAILED -> HANDOFF
 * (transition machine acquisition-state, rien d'autre n'est touche).
 */
export function canRetryHandoff(from: AcquisitionState): boolean {
  return canTransition(from, "HANDOFF");
}

/** Consentement handoff accorde ? (tout le reste = refus, pas de payload). */
export function isHandoffConsentGranted(choice: unknown): boolean {
  return choice === "granted";
}

/** Recu d'audit sans PII (seule trace persistee cote Reboot avec la cle). */
export function buildHandoffReceipt(payload: HandoffPayload): {
  contractVersion: typeof HANDOFF_CONTRACT_VERSION;
  memberRef: string;
  idempotencyKey: string;
  events: string[];
} {
  return {
    contractVersion: payload.contractVersion,
    memberRef: payload.memberRef,
    idempotencyKey: payload.metadata.idempotencyKey,
    events: [...payload.metadata.events],
  };
}

function normalizeEvents(v: unknown): string[] {
  if (!Array.isArray(v)) return [...HANDOFF_JOURNAL_EVENTS];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.trim().slice(0, 60);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 20) break;
  }
  return out.length > 0 ? out : [...HANDOFF_JOURNAL_EVENTS];
}

function optText(v: string | null | undefined, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

/**
 * Construit l'enveloppe handoff. Pur : leve (jamais de payload partiel)
 * si le consentement n'est pas accorde ou si un champ ne valide pas.
 * Refus = pas de payload : l'appelant route convertit en ForbiddenError
 * (src/lib/errors.ts) et ne trace que le recu sans PII.
 */
export function buildHandoffPayload(input: HandoffInput): HandoffPayload {
  if (!isHandoffConsentGranted(input.consent.choice)) {
    throw new Error("Handoff refuse : consentement handoff non accorde.");
  }
  const m = input.member;
  const rawSource =
    typeof input.draftSourceUTM === "string" && input.draftSourceUTM.trim()
      ? input.draftSourceUTM.trim().slice(0, 120)
      : (typeof m.source === "string" ? m.source.trim().slice(0, 120) : "") || "direct";
  const parsed = parseSourceUTM(rawSource);
  const candidate = {
    contractVersion: HANDOFF_CONTRACT_VERSION,
    memberRef: m.id.trim().slice(0, 40),
    source: { raw: rawSource, ...parsed },
    intention: m.mentoringInterest ?? null,
    interets: [
      ...parseStringList(m.secondaryDomains),
      ...parseStringList(m.domainSpecialty),
      ...parseStringList(m.mentoringTypes),
    ].slice(0, 20),
    objectif: {
      goal: m.goal ?? null,
      threeMonthGoal: optText(m.threeMonthGoal ?? null, 280),
    },
    niveau: m.level ?? null,
    disponibilite: {
      availability: m.availability ?? null,
      availabilityTimes: optText(m.availabilityTimes ?? null, 80),
    },
    domaine: {
      principal: m.primaryDomain,
      secondaires: parseStringList(m.secondaryDomains).slice(0, 3),
    },
    qualification: {
      score: input.qualification.score,
      status: input.qualification.status,
      ruleVersion: input.qualification.ruleVersion,
      reasons: parseStringList(input.qualification.reasons).slice(0, 20),
    },
    consent: {
      purpose: input.consent.purpose,
      choice: input.consent.choice,
      textVersion: input.consent.textVersion,
      createdAt: toIsoOrNull(input.consent.createdAt),
    },
    metadata: {
      invitedAt: toIsoOrNull(m.invitedAt ?? null),
      joinedAt: toIsoOrNull(m.joinedAt ?? null),
      approvedAt: toIsoOrNull(m.approvedAt ?? null),
      events: normalizeEvents(input.events),
      idempotencyKey: handoffIdempotencyKey(m.id, m.approvedAt ?? null),
    },
  };
  return handoffPayloadSchema.parse(candidate);
}
