/**
 * HASHCODE REBOOT — Templates d'emails transactionnels pour les Ateliers.
 *
 * Événements couverts :
 * - enrollment : inscription à un atelier
 * - submission : soumission d'un livrable
 * - review : résultat de la review
 * - quiz : résultat d'un quiz
 *
 * Chaque template est une fonction pure qui retourne un objet EmailPayload.
 * L'envoi réel est délégué à `sendEmail` depuis mail.ts, en fire-and-forget
 * (les routes ne doivent jamais attendre le SMTP avant de répondre).
 *
 * Sécurité : toutes les données interpolées sont échappées via `escapeHtml`
 * (noms, titres, feedback, URLs) — même règle que src/lib/mail.ts (fix F2).
 */

import { escapeHtml } from "@/lib/email-templates/shell";

export interface WorkshopEmailPayload {
  to: string;
  subject: string;
  html: string;
  category: "transactional";
}

export interface EnrollmentEmailData {
  memberName: string;
  workshopTitle: string;
  workshopUrl: string;
}

export interface SubmissionEmailData {
  memberName: string;
  workshopTitle: string;
  deliverableTitle: string;
  submissionUrl: string;
}

export interface ReviewEmailData {
  memberName: string;
  workshopTitle: string;
  deliverableTitle: string;
  decision: "APPROVED" | "REVISION" | "REJECTED";
  feedback: string;
  submissionUrl: string;
}

export interface QuizEmailData {
  memberName: string;
  workshopTitle: string;
  quizTitle: string;
  score: number;
  total: number;
  passed: boolean;
  attemptNumber: number;
}

/**
 * Template : Inscription à un atelier
 */
export function enrollmentEmail(data: EnrollmentEmailData): WorkshopEmailPayload {
  const safeName = escapeHtml(data.memberName);
  const safeTitle = escapeHtml(data.workshopTitle);
  const safeUrl = escapeHtml(data.workshopUrl);
  return {
    to: "",
    subject: `Vous êtes inscrit à "${safeTitle}" 🎉`,
    html: `
      <h1>Bienvenue dans l'atelier !</h1>
      <p>Bonjour ${safeName},</p>
      <p>Vous êtes maintenant inscrit à l'atelier <strong>${safeTitle}</strong>.</p>
      <p>Commencez dès maintenant :</p>
      <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;text-decoration:none;border-radius:6px;">Accéder à l'atelier</a>
      <p style="margin-top:24px;color:#666;font-size:12px;">Cet email a été envoyé automatiquement.</p>
    `,
    category: "transactional",
  };
}

/**
 * Template : Soumission d'un livrable
 */
export function submissionEmail(data: SubmissionEmailData): WorkshopEmailPayload {
  const safeName = escapeHtml(data.memberName);
  const safeWorkshop = escapeHtml(data.workshopTitle);
  const safeDeliverable = escapeHtml(data.deliverableTitle);
  const safeUrl = escapeHtml(data.submissionUrl);
  return {
    to: "",
    subject: `Livrable soumis : "${safeDeliverable}"`,
    html: `
      <h1>Livrable soumis</h1>
      <p>Bonjour ${safeName},</p>
      <p>Vous avez soumis le livrable <strong>${safeDeliverable}</strong> pour l'atelier <strong>${safeWorkshop}</strong>.</p>
      <p>Vous recevrez un email dès que la review sera terminée.</p>
      <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;text-decoration:none;border-radius:6px;">Voir la soumission</a>
      <p style="margin-top:24px;color:#666;font-size:12px;">Cet email a été envoyé automatiquement.</p>
    `,
    category: "transactional",
  };
}

/**
 * Template : Résultat de la review
 */
export function reviewEmail(data: ReviewEmailData): WorkshopEmailPayload {
  const decisionLabel =
    data.decision === "APPROVED"
      ? "✅ Approuvé"
      : data.decision === "REVISION"
        ? "🔄 Révision demandée"
        : "❌ Rejeté";

  const safeName = escapeHtml(data.memberName);
  const safeWorkshop = escapeHtml(data.workshopTitle);
  const safeDeliverable = escapeHtml(data.deliverableTitle);
  const safeFeedback = data.feedback ? escapeHtml(data.feedback) : "";
  const safeUrl = escapeHtml(data.submissionUrl);
  return {
    to: "",
    subject: `Review : ${decisionLabel} — "${safeDeliverable}"`,
    html: `
      <h1>${decisionLabel}</h1>
      <p>Bonjour ${safeName},</p>
      <p>Votre livrable <strong>${safeDeliverable}</strong> pour l'atelier <strong>${safeWorkshop}</strong> a été évalué.</p>
      ${safeFeedback ? `<p><strong>Feedback :</strong> ${safeFeedback}</p>` : ""}
      <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;text-decoration:none;border-radius:6px;">Voir la soumission</a>
      <p style="margin-top:24px;color:#666;font-size:12px;">Cet email a été envoyé automatiquement.</p>
    `,
    category: "transactional",
  };
}

/**
 * Template : Résultat d'un quiz
 */
export function quizEmail(data: QuizEmailData): WorkshopEmailPayload {
  const status = data.passed ? "✅ Réussi" : "❌ Échoué";

  const safeName = escapeHtml(data.memberName);
  const safeWorkshop = escapeHtml(data.workshopTitle);
  const safeQuiz = escapeHtml(data.quizTitle);
  return {
    to: "",
    subject: `Quiz : ${status} — "${safeQuiz}"`,
    html: `
      <h1>${status}</h1>
      <p>Bonjour ${safeName},</p>
      <p>Vous avez obtenu <strong>${data.score}/${data.total}</strong> au quiz <strong>${safeQuiz}</strong> de l'atelier <strong>${safeWorkshop}</strong>.</p>
      ${data.passed ? "<p>Félicitations ! Vous pouvez passer à la séance suivante.</p>" : "<p>Vous pouvez retenter le quiz.</p>"}
      <p style="margin-top:24px;color:#666;font-size:12px;">Cet email a été envoyé automatiquement.</p>
    `,
    category: "transactional",
  };
}
