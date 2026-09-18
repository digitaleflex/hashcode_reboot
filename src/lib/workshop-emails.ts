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
 * L'envoi réel est délégué à `sendEmail` depuis mail.ts.
 */

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
  return {
    to: "",
    subject: `Vous êtes inscrit à "${data.workshopTitle}" 🎉`,
    html: `
      <h1>Bienvenue dans l'atelier !</h1>
      <p>Bonjour ${data.memberName},</p>
      <p>Vous êtes maintenant inscrit à l'atelier <strong>${data.workshopTitle}</strong>.</p>
      <p>Commencez dès maintenant :</p>
      <a href="${data.workshopUrl}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;text-decoration:none;border-radius:6px;">Accéder à l'atelier</a>
      <p style="margin-top:24px;color:#666;font-size:12px;">Cet email a été envoyé automatiquement.</p>
    `,
    category: "transactional",
  };
}

/**
 * Template : Soumission d'un livrable
 */
export function submissionEmail(data: SubmissionEmailData): WorkshopEmailPayload {
  return {
    to: "",
    subject: `Livrable soumis : "${data.deliverableTitle}"`,
    html: `
      <h1>Livrable soumis</h1>
      <p>Bonjour ${data.memberName},</p>
      <p>Vous avez soumis le livrable <strong>${data.deliverableTitle}</strong> pour l'atelier <strong>${data.workshopTitle}</strong>.</p>
      <p>Vous recevrez un email dès que la review sera terminée.</p>
      <a href="${data.submissionUrl}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;text-decoration:none;border-radius:6px;">Voir la soumission</a>
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

  return {
    to: "",
    subject: `Review : ${decisionLabel} — "${data.deliverableTitle}"`,
    html: `
      <h1>${decisionLabel}</h1>
      <p>Bonjour ${data.memberName},</p>
      <p>Votre livrable <strong>${data.deliverableTitle}</strong> pour l'atelier <strong>${data.workshopTitle}</strong> a été évalué.</p>
      ${data.feedback ? `<p><strong>Feedback :</strong> ${data.feedback}</p>` : ""}
      <a href="${data.submissionUrl}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;text-decoration:none;border-radius:6px;">Voir la soumission</a>
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

  return {
    to: "",
    subject: `Quiz : ${status} — "${data.quizTitle}"`,
    html: `
      <h1>${status}</h1>
      <p>Bonjour ${data.memberName},</p>
      <p>Vous avez obtenu <strong>${data.score}/${data.total}</strong> au quiz <strong>${data.quizTitle}</strong> de l'atelier <strong>${data.workshopTitle}</strong>.</p>
      ${data.passed ? "<p>Félicitations ! Vous pouvez passer à la séance suivante.</p>" : "<p>Vous pouvez retenter le quiz.</p>"}
      <p style="margin-top:24px;color:#666;font-size:12px;">Cet email a été envoyé automatiquement.</p>
    `,
    category: "transactional",
  };
}
