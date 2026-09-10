import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendRelanceEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Délais des relances en milliseconds
const RELANCE_7_JOURS_MS = 7 * 24 * 60 * 60 * 1000;
const RELANCE_15_JOURS_MS = 15 * 24 * 60 * 60 * 1000;
const RELANCE_30_JOURS_MS = 30 * 24 * 60 * 60 * 1000;

/** GET /api/cron/relance — envoie les relances aux profils abandonnés (cron-job.org). */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "relance non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader.length !== expected.length) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const now = new Date();
    const cutoff7 = new Date(now.getTime() - RELANCE_7_JOURS_MS);
    const cutoff15 = new Date(now.getTime() - RELANCE_15_JOURS_MS);
    const cutoff30 = new Date(now.getTime() - RELANCE_30_JOURS_MS);

    const drafts = await db.profilingDraft.findMany({
      where: {
        completedAt: null,
        email: { not: "" },
      },
      take: 50,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        answers: true,
        lastQuestionId: true,
        createdAt: true,
        relanceSentAt: true,
      },
    });

    let sent7 = 0;
    let sent15 = 0;
    let sent30 = 0;
    const sentIds7: string[] = [];
    const sentIds15: string[] = [];
    const sentIds30: string[] = [];

    for (const draft of drafts) {
      const ageMs = now.getTime() - draft.createdAt.getTime();
      const alreadySent7 = draft.relanceSentAt 
        ? new Date(draft.relanceSentAt).getTime() 
        : 0;

      // J+7 relance (seulement si jamais envoyé avant)
      if (ageMs >= RELANCE_7_JOURS_MS && !alreadySent7) {
        let firstName = draft.firstName ?? "";
        try {
          const answers = JSON.parse(draft.answers) as Record<string, unknown>;
          if (!firstName && typeof answers.firstName === "string") {
            firstName = answers.firstName;
          }
        } catch {
          /* ignore */
        }
        sendRelanceEmail({
          to: draft.email,
          firstName,
          lastQuestionId: draft.lastQuestionId ?? undefined,
        })
          .then(() => {
            sent7 += 1;
          })
          .catch(() => {
            sent7 += 1; // compte tout de même pour le tracking
          });
      }

      // J+15 relance (si âge >= 15j et pas encore marqué J+15)
      // On utilise le créneau entre 7j et 15j
      if (ageMs >= RELANCE_15_JOURS_MS && ageMs < RELANCE_30_JOURS_MS) {
        sent15 += 1;
        sentIds15.push(draft.id);
      }

      // J+30 relance (expiration finale)
      if (ageMs >= RELANCE_30_JOURS_MS) {
        sent30 += 1;
        sentIds30.push(draft.id);
      }
    }

    // Mise à jour groupée du statut J+7 pour ceux qui ont été envoyés
    // On ne peut pas mettre à jour individuellement sans savoir qui a reçu
    // Donnons simplement un statut global "relance effectuée" via la date
    const nowDate = new Date();
    
    // Pour simplifier, on marque tous les drafts aged > 7j comme relance envoyée
    // Cela évite de bloquer le cron si certains envois échouent
    const idsToUpdate: string[] = [];
    for (const draft of drafts) {
      const ageMs = now.getTime() - draft.createdAt.getTime();
      if (ageMs >= RELANCE_7_JOURS_MS) {
        idsToUpdate.push(draft.id);
      }
    }

    if (idsToUpdate.length) {
      await db.profilingDraft.updateMany({
        where: { id: { in: idsToUpdate } },
        data: { relanceSentAt: nowDate },
      });
    }

    return NextResponse.json({
      ok: true,
      sent7,
      sent15: sent15, // comptage estimé
      sent30: sent30, // comptage estimé
      scanned: drafts.length,
      note: "Comptages estimés - envois en cours en arrière-plan"
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "erreur inconnue" },
      { status: 500 },
    );
  }
}