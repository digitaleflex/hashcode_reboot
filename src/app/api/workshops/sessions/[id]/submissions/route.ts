import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { checkCSRF } from "@/lib/admin-auth";
import { rateLimit, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { validateSubmission } from "@/lib/workshop-validation";
import { getSessionAccess, type SessionAccessCode } from "@/lib/workshop-server";
import { sendEmail } from "@/lib/mail";
import { submissionEmail } from "@/lib/workshop-emails";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const ACCESS_STATUS: Record<SessionAccessCode, number> = {
  NOT_FOUND: 404,
  NOT_ENROLLED: 403,
  SESSION_LOCKED: 403,
};

/**
 * POST /api/workshops/sessions/[id]/submissions — soumettre / resoumettre
 * le livrable de la séance.
 *
 * AUTH   : session membre (401) + CSRF (403) + enrollment actif (403) +
 *          séance débloquée (403).
 * INPUT  : { content } — validé selon le type du livrable (URL http(s)
 *          obligatoire pour les types URL, cf. workshop-validation).
 * OUTPUT : 201 { ok, submission } — append-only : chaque resoumission crée
 *          une NOUVELLE ligne (attempt n+1), l'historique est conservé
 *          (protocole §15).
 * ERRORS : 401, 403, 404 (séance ou livrable inexistant), 409 (soumission
 *          déjà PENDING/IN_REVIEW, ou livrable déjà APPROVED), 422
 *          (contenu invalide), 429.
 * GUARDS : blockIfTesting.
 * OWNERSHIP : la ligne créée porte memberId = session ; aucune route ne
 *          lit ni ne modifie la soumission d'un autre membre.
 *
 * Re-soumission autorisée après REVISION et REJECTED (protocole §15 : ne
 * pas limiter les corrections sans règle métier explicite) — mais pas
 * pendant qu'une soumission est PENDING/IN_REVIEW, ni sur un livrable
 * APPROVED (créerait du bruit en régression d'état).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }

  const rl = await rateLimit(`workshop-submit:${session.member.id}`, {
    capacity: 10,
    windowMs: 600_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de soumissions. Réessaie dans quelques minutes." },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const { id } = await params;
  const access = await getSessionAccess(session.member.id, id);
  if (!access.ok) {
    const messages: Record<SessionAccessCode, string> = {
      NOT_FOUND: "Ressource introuvable.",
      NOT_ENROLLED: "Inscris-toi à l'atelier pour accéder à cette séance.",
      SESSION_LOCKED: "Cette séance est encore verrouillée.",
    };
    return NextResponse.json(
      { error: messages[access.code], code: access.code },
      { status: ACCESS_STATUS[access.code] },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalide.", code: "INVALID_PAYLOAD" },
      { status: 400 },
    );
  }

  const ws = await db.workshopSession.findUnique({
    where: { id },
    select: {
      deliverable: {
        select: { id: true, type: true, isRequired: true },
      },
    },
  });
  if (!ws || !ws.deliverable) {
    return NextResponse.json(
      { error: "Cette séance n'a pas de livrable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }
  const deliverable = ws.deliverable;

  // États bloqués pour une nouvelle soumission :
  // - une soumission PENDING/IN_REVIEW est déjà en cours → 409
  // - un livrable APPROVED est acquis → 409 (pas de régression d'état)
  const existing = await db.workshopSubmission.findMany({
    where: { memberId: session.member.id, deliverableId: deliverable.id },
    orderBy: { attempt: "desc" },
    take: 1,
    select: { attempt: true, status: true },
  });
  const latest = existing[0] ?? null;
  if (latest && (latest.status === "PENDING" || latest.status === "IN_REVIEW")) {
    return NextResponse.json(
      { error: "Une soumission est déjà en attente de review.", code: "ALREADY_PENDING" },
      { status: 409 },
    );
  }
  if (latest && latest.status === "APPROVED") {
    return NextResponse.json(
      { error: "Ce livrable est déjà approuvé.", code: "ALREADY_APPROVED" },
      { status: 409 },
    );
  }

  const validated = validateSubmission(body, deliverable.type);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const submission = await db.workshopSubmission.create({
    data: {
      deliverableId: deliverable.id,
      memberId: session.member.id,
      attempt: (latest?.attempt ?? 0) + 1,
      content: validated.data.content,
      status: "PENDING",
      submittedAt: new Date(),
    },
    select: {
      id: true,
      attempt: true,
      content: true,
      status: true,
      submittedAt: true,
    },
  });

  // Envoi email de confirmation de soumission
  const [deliverableFull, sessionFull, member] = await Promise.all([
    db.workshopDeliverable.findUnique({
      where: { id: deliverable.id },
      select: { title: true },
    }),
    db.workshopSession.findUnique({
      where: { id },
      select: {
        week: {
          select: {
            workshop: { select: { id: true, title: true } },
          },
        },
      },
    }),
    db.member.findUnique({
      where: { id: session.member.id },
      select: { email: true, firstName: true },
    }),
  ]);

  if (deliverableFull && sessionFull?.week?.workshop && member?.email) {
    const workshop = sessionFull.week.workshop;
    const emailPayload = submissionEmail({
      memberName: member.firstName || "Membre",
      workshopTitle: workshop.title,
      deliverableTitle: deliverableFull.title,
      submissionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://hashcode.reboot.com"}/dashboard/ateliers/${workshop.id}`,
    });
    // Fire-and-forget : la réponse 201 ne doit pas attendre le SMTP.
    void sendEmail({
      to: member.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      category: "transactional",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, submission }, { status: 201 });
}
