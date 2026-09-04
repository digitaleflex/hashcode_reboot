// HASHCODE REBOOT — envoi réel d'emails via Resend (API HTTP directe, sans SDK).
// Ne journalise ni ne retourne JAMAIS de secret (RESEND_API_KEY / EMAIL_FROM).

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8000;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
}

/** Enveloppe Resend minimale (l'API renvoie { id } en cas de succès). */
interface ResendResponse {
  id?: unknown;
}

/** Échappement HTML minimal pour les valeurs interpolées. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * POST https://api.resend.com/emails avec `Authorization: Bearer <RESEND_API_KEY>`.
 * Ne lève jamais : toute erreur (config absente, réseau, timeout, 4xx/5xx)
 * retourne { ok: false } silencieusement.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false };
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false };
    }
    try {
      const payload = (await res.json()) as ResendResponse;
      const id = typeof payload.id === "string" ? payload.id : undefined;
      return id ? { ok: true, id } : { ok: true };
    } catch {
      return { ok: true };
    }
  } catch {
    return { ok: false };
  }
}

export interface WelcomeEmailInput {
  to: string;
  firstName: string;
  archetype: string;
}

/** Mail de bienvenue (profil validé). */
export async function sendWelcomeEmail({
  to,
  firstName,
  archetype,
}: WelcomeEmailInput): Promise<SendEmailResult> {
  const name = firstName.trim() || "bienvenue";
  const safeName = escapeHtml(name);
  const safeArchetype = escapeHtml(archetype.trim() || "Membre HASHCODE");
  const subject = "Bienvenue dans HASHCODE REBOOT";
  const text = [
    `Bonjour ${name},`,
    "",
    "Bienvenue dans HASHCODE REBOOT. Ton profil est validé, tu fais officiellement partie de la communauté.",
    `Ton profil : ${archetype.trim() || "Membre HASHCODE"}.`,
    "",
    "Prochaine étape : surveille ta boîte mail, tu vas recevoir ton invitation pour rejoindre le groupe WhatsApp.",
    "",
    "L'équipe HASHCODE",
  ].join("\n");
  const html = [
    `<div style="max-width:560px;margin:0 auto;font-family:Arial,sans-serif;color:#111;line-height:1.6;">`,
    `<h1 style="font-size:20px;margin:0 0 12px;">Bienvenue dans HASHCODE REBOOT, ${safeName}</h1>`,
    `<p>Ton profil est validé, tu fais officiellement partie de la communauté.</p>`,
    `<p>Ton profil : <strong>${safeArchetype}</strong>.</p>`,
    `<p>Prochaine étape : surveille ta boîte mail, tu vas recevoir ton invitation pour rejoindre le groupe WhatsApp.</p>`,
    `<p style="margin-top:24px;">L'équipe HASHCODE</p>`,
    `</div>`,
  ].join("");
  return sendEmail({ to, subject, html, text });
}

export interface InvitationEmailInput {
  to: string;
  firstName: string;
  whatsappUrl: string;
}

/** Mail d'invitation avec le lien WhatsApp en bouton cliquable. */
export async function sendInvitationEmail({
  to,
  firstName,
  whatsappUrl,
}: InvitationEmailInput): Promise<SendEmailResult> {
  const name = firstName.trim() || "bienvenue";
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(whatsappUrl);
  const subject = "Ton invitation — rejoins la communauté HASHCODE";
  const text = [
    `Bonjour ${name},`,
    "",
    "Ton invitation est prête : rejoins la communauté HASHCODE sur WhatsApp via ce lien :",
    whatsappUrl,
    "",
    "Présente-toi dans le groupe et partage ton objectif des 3 prochains mois.",
    "",
    "L'équipe HASHCODE",
  ].join("\n");
  const html = [
    `<div style="max-width:560px;margin:0 auto;font-family:Arial,sans-serif;color:#111;line-height:1.6;">`,
    `<h1 style="font-size:20px;margin:0 0 12px;">Ton invitation est prête, ${safeName}</h1>`,
    `<p>Rejoins la communauté HASHCODE sur WhatsApp :</p>`,
    `<p><a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background-color:#111;color:#fff;text-decoration:none;border-radius:8px;">Rejoindre le groupe WhatsApp</a></p>`,
    `<p>Si le bouton ne fonctionne pas, copie ce lien : <a href="${safeUrl}">${safeUrl}</a></p>`,
    `<p>Présente-toi dans le groupe et partage ton objectif des 3 prochains mois.</p>`,
    `<p style="margin-top:24px;">L'équipe HASHCODE</p>`,
    `</div>`,
  ].join("");
  return sendEmail({ to, subject, html, text });
}
