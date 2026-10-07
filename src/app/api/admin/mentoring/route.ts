import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { audit } from "@/lib/admin-audit";
import { suggestMentors, type MentorProfile } from "@/lib/matching";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  errorToResponse,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Budgets qui qualifient un lead mentorat haute valeur (cf. auto-controls). */
const HIGH_BUDGET_TIERS = ["20000-30000", ">30000"];

const assignSchema = z.object({
  action: z.literal("assign"),
  mentorId: z.string().min(1),
  menteeId: z.string().min(1),
  frequency: z.enum(["weekly", "biweekly", "monthly"]).default("monthly"),
});

const contactedSchema = z.object({
  action: z.literal("contacted"),
  memberId: z.string().min(1),
});

const endSchema = z.object({
  action: z.literal("end"),
  mentorshipId: z.string().min(1),
});

const postSchema = z.discriminatedUnion("action", [
  assignSchema,
  contactedSchema,
  endSchema,
]);

/**
 * GET /api/admin/mentoring?view=leads|mentors|match — lecture unifiée.
 *
 * - view=leads : leads mentorat prioritaires (mentoring=yes + budget élevé +
 *   lane pending). Inclut le mentor assigné (s'il existe) et la date de contact.
 * - view=mentors : mentors potentiels (membres validés intéressés par le
 *   mentorat, avec leur charge actuelle en mentorés actifs).
 * - view=match&menteeId=… : top 5 mentors suggérés (score 0-100 : domaine +30,
 *   spécialités +20, fréquence +20, pays +10, budget concret +20, avec
 *   équilibrage de charge — cf. matching.ts).
 *
 * AUTH : admin operator (403 sinon).
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view");

    if (view === "leads") {
      const rl = await rateLimit(`admin-mentoring-leads:${rateKey(req)}`, {
        capacity: 120,
        windowMs: 60_000,
      });
      if (!rl.ok) {
        throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
      }

      const leads = await db.member.findMany({
        where: {
          deletedAt: null,
          accessLane: "pending",
          mentoringInterest: "yes",
          budgetRange: { in: HIGH_BUDGET_TIERS },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          country: true,
          primaryDomain: true,
          profileArchetype: true,
          budgetRange: true,
          budgetWillingness: true,
          mentoringFrequency: true,
          mentoringTypes: true,
          createdAt: true,
          mentorContactedAt: true,
          mentorshipsAsMentee: {
            where: { status: { in: ["ACTIVE", "PAUSED"] } },
            select: {
              id: true,
              status: true,
              frequency: true,
              mentor: { select: { id: true, firstName: true, lastName: true } },
            },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return NextResponse.json({ leads, total: leads.length });
    }

    if (view === "mentors") {
      const rl = await rateLimit(`admin-mentoring-mentors:${rateKey(req)}`, {
        capacity: 120,
        windowMs: 60_000,
      });
      if (!rl.ok) {
        throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
      }

      const mentors = await db.member.findMany({
        where: {
          deletedAt: null,
          profileStatus: "APPROVED",
          mentoringInterest: "yes",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          country: true,
          primaryDomain: true,
          domainSpecialty: true,
          level: true,
          profileArchetype: true,
          mentoringFrequency: true,
          mentoringTypes: true,
          _count: {
            select: {
              mentorshipsAsMentor: { where: { status: "ACTIVE" } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return NextResponse.json({
        mentors: mentors.map((m) => ({
          ...m,
          activeMentees: m._count.mentorshipsAsMentor,
          _count: undefined,
        })),
        total: mentors.length,
      });
    }

    if (view === "match") {
      const rl = await rateLimit(`admin-mentoring-match:${rateKey(req)}`, {
        capacity: 60,
        windowMs: 60_000,
      });
      if (!rl.ok) {
        throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
      }

      const menteeId = searchParams.get("menteeId");
      if (!menteeId) {
        throw new ValidationError("menteeId requis.");
      }

      const mentee = await db.member.findUnique({
        where: { id: menteeId },
        select: {
          id: true,
          primaryDomain: true,
          domainSpecialty: true,
          mentoringFrequency: true,
          country: true,
          budgetRange: true,
          deletedAt: true,
        },
      });
      if (!mentee || mentee.deletedAt) {
        throw new NotFoundError("Mentoré introuvable.");
      }

      const mentors = await db.member.findMany({
        where: {
          deletedAt: null,
          profileStatus: "APPROVED",
          mentoringInterest: "yes",
          id: { not: menteeId },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          primaryDomain: true,
          domainSpecialty: true,
          mentoringFrequency: true,
          country: true,
          level: true,
          profileArchetype: true,
          _count: {
            select: { mentorshipsAsMentor: { where: { status: "ACTIVE" } } },
          },
        },
        take: 50,
      });

      const profiles: MentorProfile[] = mentors.map((m) => ({
        id: m.id,
        primaryDomain: m.primaryDomain,
        domainSpecialty: m.domainSpecialty,
        mentoringFrequency: m.mentoringFrequency,
        country: m.country,
        level: m.level,
        activeMentees: m._count.mentorshipsAsMentor,
      }));

      const suggestions = suggestMentors(
        {
          primaryDomain: mentee.primaryDomain,
          domainSpecialty: mentee.domainSpecialty,
          mentoringFrequency: mentee.mentoringFrequency,
          country: mentee.country,
          budgetRange: mentee.budgetRange,
        },
        profiles,
        5,
      );

      const byId = new Map(mentors.map((m) => [m.id, m]));
      return NextResponse.json({
        menteeId,
        suggestions: suggestions.map((s) => {
          const m = byId.get(s.mentorId);
          return {
            ...s,
            mentor: m
              ? {
                  id: m.id,
                  firstName: m.firstName,
                  lastName: m.lastName,
                  primaryDomain: m.primaryDomain,
                  level: m.level,
                  profileArchetype: m.profileArchetype,
                  activeMentees: m._count.mentorshipsAsMentor,
                }
              : null,
          };
        }),
      });
    }

    throw new ValidationError("view requis : leads | mentors | match.");
  } catch (err) {
    return errorToResponse(err);
  }
}

/**
 * POST /api/admin/mentoring — écritures unifiées (discriminées par `action`).
 *
 * - { action: "assign", mentorId, menteeId, frequency? } : crée un Mentorship
 *   ACTIVE (409 si la paire est déjà suivie ou si mentoré === mentor).
 *   404 si l'un des deux est introuvable/supprimé.
 * - { action: "contacted", memberId } : marque un lead comme contacté (pose
 *   mentorContactedAt, idempotent : réécrit la date).
 * - { action: "end", mentorshipId } : termine un suivi (ACTIVE/PAUSED → ENDED,
 *   idempotent : un suivi déjà ENDED est retourné tel quel).
 *
 * AUTH : admin operator. Garde TESTING active (écriture).
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const tooLarge = bodyLimit(req);
    if (tooLarge) return tooLarge;

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "action requise : assign | contacted | end (avec les champs correspondants).",
        parsed.error.flatten(),
      );
    }

    const action = parsed.data;

    if (action.action === "assign") {
      const rl = await rateLimit(`admin-mentoring-assign:${rateKey(req)}`, {
        capacity: 30,
        windowMs: 60_000,
      });
      if (!rl.ok) {
        throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
      }

      const { mentorId, menteeId, frequency } = action;

      if (mentorId === menteeId) {
        throw new ValidationError("Le mentor et le mentoré doivent être différents.");
      }

      const [mentor, mentee] = await Promise.all([
        db.member.findUnique({ where: { id: mentorId }, select: { id: true, deletedAt: true } }),
        db.member.findUnique({ where: { id: menteeId }, select: { id: true, deletedAt: true } }),
      ]);
      if (!mentor || mentor.deletedAt || !mentee || mentee.deletedAt) {
        throw new NotFoundError("Mentor ou mentoré introuvable.");
      }

      const existing = await db.mentorship.findFirst({
        where: { mentorId, menteeId, status: { in: ["ACTIVE", "PAUSED"] } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictError("Ce suivi existe déjà.");
      }

      const mentorship = await db.mentorship.create({
        data: { mentorId, menteeId, frequency, status: "ACTIVE" },
        select: { id: true, status: true, frequency: true, startedAt: true },
      });

      await audit("mentoring.assign", "mentorship", mentorship.id, { mentorId, menteeId, frequency });
      return NextResponse.json({ ok: true, mentorship }, { status: 201 });
    }

    if (action.action === "contacted") {
      const rl = await rateLimit(`admin-mentoring-contacted:${rateKey(req)}`, {
        capacity: 60,
        windowMs: 60_000,
      });
      if (!rl.ok) {
        throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
      }

      const member = await db.member.findUnique({
        where: { id: action.memberId },
        select: { id: true, deletedAt: true },
      });
      if (!member || member.deletedAt) {
        throw new NotFoundError("Membre introuvable.");
      }

      const updated = await db.member.update({
        where: { id: member.id },
        data: { mentorContactedAt: new Date() },
        select: { id: true, mentorContactedAt: true },
      });

      await audit("mentoring.contacted", "member", member.id, {});
      return NextResponse.json({ ok: true, member: updated });
    }

    // action === "end"
    const rl = await rateLimit(`admin-mentoring-end:${rateKey(req)}`, {
      capacity: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
    }

    const existing = await db.mentorship.findUnique({
      where: { id: action.mentorshipId },
      select: { id: true, status: true, endedAt: true },
    });
    if (!existing) {
      throw new NotFoundError("Suivi introuvable.");
    }
    if (existing.status === "ENDED") {
      return NextResponse.json({ ok: true, mentorship: existing });
    }

    const mentorship = await db.mentorship.update({
      where: { id: existing.id },
      data: { status: "ENDED", endedAt: new Date() },
      select: { id: true, status: true, endedAt: true },
    });

    await audit("mentoring.end", "mentorship", mentorship.id, {});
    return NextResponse.json({ ok: true, mentorship });
  } catch (err) {
    return errorToResponse(err);
  }
}
