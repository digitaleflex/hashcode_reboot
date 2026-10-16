/**
 * Segments d'acquisition (#104) — définitions whitelistées, jamais de SQL libre.
 *
 * Un segment est une VUE (filtres AND) : aucune règle de recommandation cachée.
 * Champs autorisés = dimensions d'acquisition réelles ; email/tél/nom et
 * champs internes (adminNote, adminRole) sont REFUSÉS (422).
 * Les supprimés (deletedAt) sont toujours exclus, sans exception.
 */
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const FIELD_OPS = ["eq", "neq", "in", "contains", "gte", "lte"] as const;
export type SegmentOp = (typeof FIELD_OPS)[number];

/** Dimension autorisée → ops permises + validation de valeur. */
const FIELDS = {
  source: { ops: ["eq", "neq", "in", "contains"], value: z.string().trim().min(1).max(120) },
  country: { ops: ["eq", "neq", "in"], value: z.string().trim().min(1).max(8) },
  domain: {
    ops: ["eq", "neq", "in"],
    value: z.enum(["web", "cybersecurity", "ai"]),
  },
  goal: {
    ops: ["eq", "neq", "in"],
    value: z.enum([
      "project",
      "employment",
      "freelance",
      "upskill",
      "business",
      "career",
      "other",
    ]),
  },
  level: {
    ops: ["eq", "neq", "in"],
    value: z.enum(["beginner", "practicing", "autonomous", "advanced"]),
  },
  profileStatus: {
    ops: ["eq", "neq", "in"],
    value: z.enum(["PENDING", "APPROVED", "REJECTED", "WAITLIST"]),
  },
  invitationStatus: {
    ops: ["eq", "neq", "in"],
    value: z.enum([
      "NOT_INVITED",
      "INVITED",
      "ACCEPTED",
      "REFUSED",
      "BOUNCED",
      "EXPIRED",
    ]),
  },
  communityStatus: {
    ops: ["eq", "neq", "in"],
    value: z.enum(["NOT_INVITED", "INVITED", "JOINED"]),
  },
  createdAfter: { ops: ["gte", "lte"], value: z.string().datetime() },
  createdBefore: { ops: ["gte", "lte"], value: z.string().datetime() },
} as const;

export type SegmentField = keyof typeof FIELDS;

/** Colonne Member réelle derrière chaque dimension publique. */
const FIELD_COLUMN: Record<SegmentField, string> = {
  source: "source",
  country: "country",
  domain: "primaryDomain",
  goal: "goal",
  level: "level",
  profileStatus: "profileStatus",
  invitationStatus: "invitationStatus",
  communityStatus: "communityStatus",
  createdAfter: "createdAt",
  createdBefore: "createdAt",
};

const filterSchema = z
  .object({
    field: z.string(),
    op: z.string(),
    value: z.unknown(),
  })
  .superRefine((f, ctx) => {
    const def: { ops: readonly string[]; value: z.ZodTypeAny } | undefined = (
      FIELDS as Record<string, { ops: readonly string[]; value: z.ZodTypeAny }>
    )[f.field];
    if (!def) {
      ctx.addIssue({ code: "custom", message: `Champ interdit ou inconnu : ${f.field}.` });
      return;
    }
    if (!def.ops.includes(f.op)) {
      ctx.addIssue({
        code: "custom",
        message: `Opérateur ${f.op} interdit pour ${f.field}.`,
      });
      return;
    }
    const check = (v: unknown) => def.value.safeParse(v).success;
    const values = f.op === "in" ? (Array.isArray(f.value) ? f.value : [f.value]) : [f.value];
    if (f.op === "in" && (!Array.isArray(f.value) || f.value.length === 0 || f.value.length > 50)) {
      ctx.addIssue({ code: "custom", message: "`in` exige 1 à 50 valeurs." });
      return;
    }
    if (!values.every(check)) {
      ctx.addIssue({ code: "custom", message: `Valeur invalide pour ${f.field}.` });
    }
  });

export const segmentDefinitionSchema = z.object({
  version: z.literal(1),
  all: z.array(filterSchema).min(1).max(20),
});

export type SegmentDefinition = z.infer<typeof segmentDefinitionSchema>;

/** Revalide une définition stockée (le schéma peut avoir évolué). */
export function parseSegmentDefinition(value: unknown) {
  return segmentDefinitionSchema.safeParse(value);
}

/** Compile une définition validée en `where` Prisma (AND + jamais supprimés). */
export function compileSegmentWhere(
  def: SegmentDefinition,
): Prisma.MemberWhereInput {
  const and: Prisma.MemberWhereInput[] = [{ deletedAt: null }];
  for (const f of def.all) {
    const column = FIELD_COLUMN[f.field as SegmentField];
    const values = f.op === "in" && Array.isArray(f.value) ? f.value : f.value;
    switch (f.op) {
      case "eq":
        and.push({ [column]: f.value } as Prisma.MemberWhereInput);
        break;
      case "neq":
        and.push({ NOT: { [column]: f.value } } as Prisma.MemberWhereInput);
        break;
      case "in":
        and.push({ [column]: { in: values } } as Prisma.MemberWhereInput);
        break;
      case "contains":
        and.push({ [column]: { contains: f.value as string } } as Prisma.MemberWhereInput);
        break;
      case "gte":
        and.push({ [column]: { gte: new Date(f.value as string) } } as Prisma.MemberWhereInput);
        break;
      case "lte":
        and.push({ [column]: { lte: new Date(f.value as string) } } as Prisma.MemberWhereInput);
        break;
    }
  }
  return { AND: and };
}
