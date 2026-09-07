// HASHCODE REBOOT — envoi réel d'emails via Resend (primary) + Brevo (fallback).
// Ne journalise ni ne retourne JAMAIS de secret (RESEND_API_KEY / BREVO_API_KEY).

import { db } from "@/lib/db";

const RESEND_URL = "https://api.resend.com/emails";
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
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
  provider?: "resend" | "brevo";
}

/** Échappement HTML minimal pour les valeurs interpolées. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Track email.sent in EmailEvent table (fire-and-forget). */
function categorizeEmail(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("bienvenue") || s.includes("invitation")) return "welcome";
  if (s.includes("inscription") || s.includes("merci")) return "waitlist";
  if (s.includes("t'attend") || s.includes("rejoins")) return "engagement";
  if (s.includes("reprend") || s.includes("termin")) return "relance";
  if (
    s.includes("validé") ||
    s.includes("liste d'attente") ||
    s.includes("non retenu")
  )
    return "status_change";
  return "other";
}

async function trackEmailSent(to: string, subject: string): Promise<void> {
  try {
    const member = await db.member.findUnique({
      where: { email: to },
      select: { id: true },
    });
    await db.emailEvent.create({
      data: {
        email: to,
        memberId: member?.id ?? null,
        type: "email.sent",
        category: categorizeEmail(subject),
      },
    });
  } catch {
    // silent — email tracking is best-effort
  }
}

/**
 * POST https://api.resend.com/emails avec `Authorization: Bearer <RESEND_API_KEY>`.
 * Retourne { ok: false } en cas d'erreur.
 */
async function sendViaResend({
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
      return { ok: false, provider: "resend" };
    }
    try {
      const payload = (await res.json()) as { id?: unknown };
      const id = typeof payload.id === "string" ? payload.id : undefined;
      trackEmailSent(to, subject).catch(() => {});
      return id ? { ok: true, id, provider: "resend" } : { ok: true, provider: "resend" };
    } catch {
      trackEmailSent(to, subject).catch(() => {});
      return { ok: true, provider: "resend" };
    }
  } catch {
    return { ok: false, provider: "resend" };
  }
}

/**
 * POST https://api.brevo.com/v3/smtp/email avec `api-key: <BREVO_API_KEY>`.
 * Retourne { ok: false } en cas d'erreur.
 */
async function sendViaBrevo({
  to,
  subject,
  html,
  text,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false };
  }
  // Extraire l'email du format "Nom <email@domaine>"
  const emailMatch = from.match(/<([^>]+)>/);
  const fromEmail = emailMatch ? emailMatch[1] : from;
  const fromName = from.replace(/<[^>]+>/, "").trim() || "HASHCODE REBOOT";
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, provider: "brevo" };
    }
    try {
      const payload = (await res.json()) as { messageId?: unknown };
      const id = typeof payload.messageId === "string" ? payload.messageId : undefined;
      trackEmailSent(to, subject).catch(() => {});
      return id ? { ok: true, id, provider: "brevo" } : { ok: true, provider: "brevo" };
    } catch {
      trackEmailSent(to, subject).catch(() => {});
      return { ok: true, provider: "brevo" };
    }
  } catch {
    return { ok: false, provider: "brevo" };
  }
}

/**
 * Envoi d'email avec stratégie : Resend (primary) → Brevo (fallback si quota).
 * Ne lève jamais : toute erreur retourne { ok: false } silencieusement.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailInput): Promise<SendEmailResult> {
  // 1. Essayer Resend (primary)
  const resendResult = await sendViaResend({ to, subject, html, text });

  // Si Resend réussit, retourner le résultat
  if (resendResult.ok) {
    return resendResult;
  }

  // 2. Vérifier si on doit basculer vers Brevo (fallback)
  const fallbackOn429 = process.env.BREVO_FALLBACK_ON_429 === "true";

  if (fallbackOn429) {
    // Essayer Brevo comme fallback
    const brevoResult = await sendViaBrevo({ to, subject, html, text });

    // Logger le basculement (en dev seulement)
    if (process.env.NODE_ENV !== "production") {
      console.info("[Brevo Fallback] Basculement Resend → Brevo pour", to);
    }

    return brevoResult;
  }

  // 3. Sinon retourner l'erreur Resend (pas de fallback)
  return resendResult;
}

/* ------------------------------------------------------------------ */
/* Templates — charte HASHCODE REBOOT                                  */
/* LIME #C5F441 (accent rare) · VOID #0A0A0A · SURFACE #141414          */
/* Texte #F8FAFC · Secondaire #94A3B8 · Police système (email-safe)     */
/* Mise en page en tableaux, CSS 100% inline, max 600px.                */
/* Header : wordmark 100% texte (aucune image externe, rend partout). */
/* ------------------------------------------------------------------ */

const MAIL_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Coquille commune : fond VOID, carte SURFACE 600px, liseré lime,
 * header logo centré, footer sobre. `inner` = lignes <tr> du contenu.
 */
function emailShell(preheader: string, inner: string): string {
  return [
    `<!doctype html>`,
    `<html lang="fr">`,
    `<body style="margin:0;padding:0;background-color:#0A0A0A;">`,
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">${preheader}</div>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background-color:#0A0A0A;">`,
    `<tr><td align="center" style="padding:32px 16px;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden;">`,
    // Liseré lime — accent rare, signature visuelle.
    `<tr><td style="background-color:#C5F441;font-size:0;line-height:0;height:3px;">&nbsp;</td></tr>`,
    // Header wordmark 100% texte — aucun asset externe.
    `<tr><td align="center" style="padding:28px 32px 0 32px;background-color:#141414;">`,
    `<div style="font-family:${MAIL_FONT};font-size:24px;font-weight:800;font-style:italic;color:#F8FAFC;letter-spacing:0.5px;line-height:1;text-align:center;">HASHCODE</div>`,
    `<div style="font-family:${MAIL_FONT};font-size:12px;font-weight:700;letter-spacing:4px;color:#C5F441;line-height:1;text-align:center;margin:6px 0 0 0;padding-left:4px;">REBOOT</div>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:12px auto 0 auto;">`,
    `<tr><td width="48" height="2" bgcolor="#C5F441" style="width:48px;height:2px;background-color:#C5F441;font-size:0;line-height:0;">&nbsp;</td></tr>`,
    `</table>`,
    `</td></tr>`,
    inner,
    // Footer sobre, dans la carte.
    `<tr><td style="padding:0 32px 28px 32px;background-color:#141414;">`,
    `<div style="border-top:1px solid #262626;padding-top:16px;">`,
    `<p style="margin:0;font-family:${MAIL_FONT};font-size:12px;line-height:1.6;color:#94A3B8;text-align:center;">HASHCODE · REBOOT — Une nouvelle génération de la communauté commence.</p>`,
    `<p style="margin:8px 0 0 0;font-family:${MAIL_FONT};font-size:11px;line-height:1.6;color:#64748B;text-align:center;">Tu reçois cet e-mail car tu t&apos;es inscrit sur reboot.joinhashcode.com.</p>`,
    `</div>`,
    `</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</body>`,
    `</html>`,
  ].join("");
}

function monoLabel(label: string): string {
  return `<div style="font-family:${MAIL_FONT};font-size:11px;font-weight:700;letter-spacing:2px;color:#C5F441;margin:0 0 12px 0;">${label}</div>`;
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
    "",
    `Ton profil : ${archetype.trim() || "Membre HASHCODE"}.`,
    "",
    "Ce qui t'attend : des sessions pratiques, des rencontres avec des passionnés de Web Development, Cybersecurity et Applied AI, et une communauté qui avance ensemble.",
    "",
    "Prochaine étape : surveille ta boîte mail. Tu vas recevoir ton invitation personnelle pour rejoindre le groupe WhatsApp officiel.",
    "",
    "À très vite,",
    "L'équipe HASHCODE",
    "",
    "HASHCODE · REBOOT — Une nouvelle génération de la communauté commence.",
  ].join("\n");
  const inner = [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("PROFIL VALIDÉ"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Bienvenue dans le Reboot, ${safeName}.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Ton profil est validé. Tu fais officiellement partie de la communauté — on est ravis de te compter parmi nous.</p>`,
    // Carte profil / archétype.
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;background-color:#0A0A0A;border:1px solid #333B1E;border-radius:8px;">`,
    `<tr><td style="padding:14px 16px;">`,
    `<div style="font-family:${MAIL_FONT};font-size:11px;font-weight:700;letter-spacing:2px;color:#94A3B8;margin:0 0 4px 0;">TON PROFIL</div>`,
    `<div style="font-family:${MAIL_FONT};font-size:16px;font-weight:700;color:#C5F441;margin:0;">${safeArchetype}</div>`,
    `</td></tr>`,
    `</table>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:14px;line-height:1.65;color:#94A3B8;">Ce qui t&apos;attend : des sessions pratiques, des rencontres avec des passionnés de Web Development, Cybersecurity et Applied AI, et une communauté qui avance ensemble.</p>`,
    // Encadré prochaine étape.
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;background-color:#0A0A0A;border:1px solid #262626;border-radius:8px;">`,
    `<tr><td style="padding:14px 16px;">`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;font-weight:700;color:#F8FAFC;margin:0 0 4px 0;">Prochaine étape</div>`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;line-height:1.6;color:#94A3B8;margin:0;">Surveille ta boîte mail : tu vas recevoir ton invitation personnelle pour rejoindre le groupe WhatsApp officiel.</div>`,
    `</td></tr>`,
    `</table>`,
    `<p style="margin:20px 0 0 0;font-family:${MAIL_FONT};font-size:14px;line-height:1.6;color:#F8FAFC;">À très vite,<br /><span style="color:#94A3B8;">L&apos;équipe HASHCODE</span></p>`,
    `</td></tr>`,
  ].join("");
  const html = emailShell(
    "Ton profil est validé — bienvenue dans HASHCODE REBOOT.",
    inner,
  );
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
    "Bonne nouvelle : ton invitation est prête. Rejoins la communauté officielle HASHCODE sur WhatsApp :",
    whatsappUrl,
    "",
    "En arrivant, présente-toi brièvement et partage ton objectif des 3 prochains mois. C'est comme ça que les premiers échanges commencent.",
    "",
    "Si le lien ne s'ouvre pas, copie-le dans ton navigateur.",
    "",
    "À tout de suite dans le groupe,",
    "L'équipe HASHCODE",
    "",
    "HASHCODE · REBOOT — Une nouvelle génération de la communauté commence.",
  ].join("\n");
  const inner = [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("INVITATION PRÊTE"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Rejoins la communauté officielle, ${safeName}.</h1>`,
    `<p style="margin:0 0 20px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Bonne nouvelle : ton invitation est prête. Il ne te reste qu&apos;un pas — rejoindre le groupe WhatsApp officiel.</p>`,
    // Bouton lime, centré, bulletproof (table + padding sur td pour Outlook).
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;">`,
    `<tr><td align="center" style="padding:0;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">`,
    `<tr><td align="center" bgcolor="#C5F441" style="background-color:#C5F441;border-radius:8px;padding:14px 32px;">`,
    `<a href="${safeUrl}" target="_blank" rel="noopener" style="font-family:${MAIL_FONT};font-size:16px;font-weight:800;color:#0A0A0A;text-decoration:none;display:inline-block;">Rejoindre le groupe WhatsApp</a>`,
    `</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:12px;line-height:1.6;color:#94A3B8;text-align:center;word-break:break-all;">Si le bouton ne fonctionne pas, copie ce lien :<br /><a href="${safeUrl}" target="_blank" rel="noopener" style="color:#C5F441;text-decoration:underline;">${safeUrl}</a></p>`,
    // Conseil d'arrivée.
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;background-color:#0A0A0A;border:1px solid #262626;border-radius:8px;">`,
    `<tr><td style="padding:14px 16px;">`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;font-weight:700;color:#F8FAFC;margin:0 0 4px 0;">En arrivant dans le groupe</div>`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;line-height:1.6;color:#94A3B8;margin:0;">Présente-toi brièvement et partage ton objectif des 3 prochains mois. C&apos;est comme ça que les premiers échanges commencent.</div>`,
    `</td></tr>`,
    `</table>`,
    `<p style="margin:20px 0 0 0;font-family:${MAIL_FONT};font-size:14px;line-height:1.6;color:#F8FAFC;">À tout de suite dans le groupe,<br /><span style="color:#94A3B8;">L&apos;équipe HASHCODE</span></p>`,
    `</td></tr>`,
  ].join("");
  const html = emailShell(
    "Ton invitation est prête — rejoins le groupe WhatsApp officiel.",
    inner,
  );
  return sendEmail({ to, subject, html, text });
}

/* ── Waitlist Email ─────────────────────────────────────────────────────── */

export interface WaitlistEmailInput {
  to: string;
  firstName: string;
}

export async function sendWaitlistEmail({
  to,
  firstName,
}: WaitlistEmailInput): Promise<SendEmailResult> {
  const name = firstName.trim() || "bienvenue";
  const safeName = escapeHtml(name);
  const subject = "Merci pour ton inscription — HASHCODE REBOOT";
  const text = [
    `Bonjour ${name},`,
    "",
    "Merci pour ton inscription à HASHCODE REBOOT. Ton profil est en cours de validation par notre équipe.",
    "",
    "Nous-reviewons chaque candidature pour garantir la qualité de la communauté. Tu recevras un email dès que ton profil sera validé.",
    "",
    "Ce qui t'attend :",
    "- Une communauté de passionnés Web, Cyber et AI",
    "- Des sessions pratiques et du networking",
    "- Des ressources exclusives",
    "",
    "À très vite,",
    "L'équipe HASHCODE",
  ].join("\n");
  const inner = [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("INSCRIPTION REÇUE"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Merci ${safeName}, ton inscription est confirmée.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Ton profil est en cours de validation par notre équipe. Nous-reviewons chaque candidature pour garantir la qualité de la communauté.</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;background-color:#0A0A0A;border:1px solid #262626;border-radius:8px;">`,
    `<tr><td style="padding:14px 16px;">`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;font-weight:700;color:#F8FAFC;margin:0 0 4px 0;">Ce qui t'attend</div>`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;line-height:1.6;color:#94A3B8;margin:0;">• Une communauté de passionnés Web, Cyber et AI<br/>• Des sessions pratiques et du networking<br/>• Des ressources exclusives</div>`,
    `</td></tr></table>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;background-color:#0A0A0A;border:1px solid #333B1E;border-radius:8px;">`,
    `<tr><td style="padding:14px 16px;">`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;font-weight:700;color:#C5F441;margin:0 0 4px 0;">Prochaine étape</div>`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;line-height:1.6;color:#94A3B8;margin:0;">Tu recevras un email dès que ton profil sera validé. Reste connecté.</div>`,
    `</td></tr></table>`,
    `<p style="margin:20px 0 0 0;font-family:${MAIL_FONT};font-size:14px;line-height:1.6;color:#F8FAFC;">À très vite,<br /><span style="color:#94A3B8;">L'équipe HASHCODE</span></p>`,
    `</td></tr>`,
  ].join("");
  const html = emailShell(
    "Ton inscription est confirmée — ton profil est en cours de validation.",
    inner,
  );
  return sendEmail({ to, subject, html, text });
}

/* ── Engagement Email ───────────────────────────────────────────────────── */

export interface EngagementEmailInput {
  to: string;
  firstName: string;
}

export async function sendEngagementEmail({
  to,
  firstName,
}: EngagementEmailInput): Promise<SendEmailResult> {
  const name = firstName.trim() || "member";
  const safeName = escapeHtml(name);
  const subject = "On t'attend sur HASHCODE — rejoins le groupe";
  const text = [
    `Bonjour ${name},`,
    "",
    "Il y a quelques jours, tu as reçu ton invitation pour rejoindre le groupe WhatsApp officiel de HASHCODE.",
    "",
    "Tu l'as peut-être manquée ? La communauté est active et on t'attend pour les prochaines sessions.",
    "",
    "Rejoins le groupe ici :",
    process.env.WHATSAPP_URL ?? "https://chat.whatsapp.com/join",
    "",
    "À tout de suite dans le groupe,",
    "L'équipe HASHCODE",
  ].join("\n");
  const inner = [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("TU N'AS PAS ENCORE REJOINT"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">On t'attend ${safeName}, la communauté est prête.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Il y a quelques jours, tu as reçu ton invitation pour rejoindre le groupe WhatsApp officiel de HASHCODE. Tu l'as peut-être manquée ? La communauté est active et on t'attend pour les prochaines sessions.</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;">`,
    `<tr><td align="center" style="padding:0;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">`,
    `<tr><td align="center" bgcolor="#C5F441" style="background-color:#C5F441;border-radius:8px;padding:14px 32px;">`,
    `<a href="${escapeHtml(process.env.WHATSAPP_URL ?? "https://chat.whatsapp.com/join")}" target="_blank" rel="noopener" style="font-family:${MAIL_FONT};font-size:16px;font-weight:800;color:#0A0A0A;text-decoration:none;display:inline-block;">Rejoindre maintenant</a>`,
    `</td></tr></table>`,
    `</td></tr></table>`,
    `<p style="margin:0;font-family:${MAIL_FONT};font-size:13px;line-height:1.6;color:#94A3B8;text-align:center;">La communauté avance sans toi — retrouve les derniers membres et partage ton objectif.</p>`,
    `<p style="margin:20px 0 0 0;font-family:${MAIL_FONT};font-size:14px;line-height:1.6;color:#F8FAFC;">À tout de suite,<br /><span style="color:#94A3B8;">L'équipe HASHCODE</span></p>`,
    `</td></tr>`,
  ].join("");
  const html = emailShell(
    "On t'attend — rejoins le groupe WhatsApp officiel.",
    inner,
  );
  return sendEmail({ to, subject, html, text });
}

/* ── Vérification Email (code OTP) ───────────────────────────────────────── */

export interface VerificationEmailInput {
  to: string;
  firstName: string;
  code: string;
}

/** Mail avec le code de vérification à 6 chiffres (valide 10 minutes). */
export async function sendVerificationEmail({
  to,
  firstName,
  code,
}: VerificationEmailInput): Promise<SendEmailResult> {
  const name = firstName.trim() || "toi";
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code.trim());
  const subject = "Ton code de vérification HASHCODE";
  const text = [
    `Bonjour ${name},`,
    "",
    `Ton code de vérification : ${code.trim()}`,
    "",
    "Saisis ce code dans le formulaire pour confirmer ton adresse email. Il est valide 10 minutes.",
    "",
    "Si tu n'as pas demandé ce code, ignore cet e-mail.",
    "",
    "L'équipe HASHCODE",
  ].join("\n");
  const inner = [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("VÉRIFIE TON EMAIL"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Ton code, ${safeName}.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Saisis ce code dans le formulaire pour confirmer ton adresse email. Il expire dans 10 minutes.</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;background-color:#0A0A0A;border:1px solid #333B1E;border-radius:8px;">`,
    `<tr><td align="center" style="padding:20px 16px;">`,
    `<div style="font-family:${MAIL_FONT};font-size:32px;font-weight:800;letter-spacing:8px;color:#C5F441;margin:0;">${safeCode}</div>`,
    `</td></tr></table>`,
    `<p style="margin:0;font-family:${MAIL_FONT};font-size:12px;line-height:1.6;color:#94A3B8;text-align:center;">Si tu n&apos;as pas demandé ce code, ignore cet e-mail.</p>`,
    `</td></tr>`,
  ].join("");
  const html = emailShell(
    "Ton code de vérification HASHCODE — valide 10 minutes.",
    inner,
  );
  return sendEmail({ to, subject, html, text });
}

/* ── Relance Email (profil abandonné) ────────────────────────────────────── */

export interface RelanceEmailInput {
  to: string;
  firstName: string;
  lastQuestionId?: string;
}

export async function sendRelanceEmail({
  to,
  firstName,
  lastQuestionId,
}: RelanceEmailInput): Promise<SendEmailResult> {
  const name = firstName.trim() || "toi";
  const safeName = escapeHtml(name);
  const subject = "Ton profil HASHCODE t'attend encore — finis-le en 1 min";
  const landingUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reboot.joinhashcode.com";
  const resumeUrl = `${landingUrl}/?resume=1${lastQuestionId ? `&q=${encodeURIComponent(lastQuestionId)}` : ""}`;
  const text = [
    `Bonjour ${name},`,
    "",
    "Il y a un jour, tu commençais ton profil HASHCODE mais tu es parti avant de le finir.",
    "",
    "Ton profil est presque prêt. Reprends là où tu t'étais arrêté :",
    resumeUrl,
    "",
    "Ça ne prend même pas une minute.",
    "",
    "À très vite,",
    "L'équipe HASHCODE",
  ].join("\n");
  const inner = [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("TON PROFIL T'ATTEND"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Tu es à quelques clics de ton accès ${safeName}.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Il y a un jour, tu commençais ton profil HASHCODE mais tu es parti avant de le finir. Tes réponses sont enregistrées — tu reprends exactement où tu t'es arrêté.</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;">`,
    `<tr><td align="center" style="padding:0;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">`,
    `<tr><td align="center" bgcolor="#C5F441" style="background-color:#C5F441;border-radius:8px;padding:14px 32px;">`,
    `<a href="${escapeHtml(resumeUrl)}" target="_blank" rel="noopener" style="font-family:${MAIL_FONT};font-size:16px;font-weight:800;color:#0A0A0A;text-decoration:none;display:inline-block;">Finir mon profil</a>`,
    `</td></tr></table>`,
    `</td></tr></table>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;background-color:#0A0A0A;border:1px solid #333B1E;border-radius:8px;">`,
    `<tr><td style="padding:14px 16px;">`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;font-weight:700;color:#C5F441;margin:0 0 4px 0;">Ce qui t'attend</div>`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;line-height:1.6;color:#94A3B8;margin:0;">• Un profil qui te positionne dans la communauté<br/>• Une invitation à rejoindre le groupe officiel<br/>• Des sessions pratiques dès ta validation</div>`,
    `</td></tr></table>`,
    `<p style="margin:20px 0 0 0;font-family:${MAIL_FONT};font-size:14px;line-height:1.6;color:#F8FAFC;">À très vite,<br /><span style="color:#94A3B8;">L'équipe HASHCODE</span></p>`,
    `</td></tr>`,
  ].join("");
  const html = emailShell(
    "Ton profil HASHCODE t'attend encore — finis-le en 1 min.",
    inner,
  );
  return sendEmail({ to, subject, html, text });
}

/* ── Magic Link / Login OTP ────────────────────────────────────────────────── */

export interface MagicLinkEmailInput {
  to: string;
  firstName: string;
  code: string;
}

export async function sendMagicLinkEmail({
  to,
  firstName,
  code,
}: MagicLinkEmailInput): Promise<SendEmailResult> {
  const name = firstName.trim() || "toi";
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code.trim());
  const subject = "Ton code de connexion HASHCODE";
  const text = [
    `Bonjour ${name},`,
    "",
    `Voici ton code de connexion : ${code.trim()}`,
    "",
    "Saisis-le sur la page de connexion pour accéder à ton compte. Il expire dans 15 minutes.",
    "",
    "Si tu n'as pas demandé ce code, ignore cet e-mail — ton compte reste sécurisé.",
    "",
    "L'équipe HASHCODE",
  ].join("\n");
  const inner = [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("CONNEXION SÉCURISÉE"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Ton code, ${safeName}.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Saisis ce code sur la page de connexion pour accéder à ton compte HASHCODE. Il expire dans 15 minutes.</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;background-color:#0A0A0A;border:1px solid #333B1E;border-radius:8px;">`,
    `<tr><td align="center" style="padding:20px 16px;">`,
    `<div style="font-family:${MAIL_FONT};font-size:32px;font-weight:800;letter-spacing:8px;color:#C5F441;margin:0;">${safeCode}</div>`,
    `</td></tr></table>`,
    `<p style="margin:0;font-family:${MAIL_FONT};font-size:12px;line-height:1.6;color:#94A3B8;text-align:center;">Si tu n&apos;as pas demandé ce code, ignore cet e-mail — ton compte reste sécurisé.</p>`,
    `</td></tr>`,
  ].join("");
  const html = emailShell(
    "Ton code de connexion HASHCODE — valide 15 minutes.",
    inner,
  );
  return sendEmail({ to, subject, html, text });
}

/* ── Status change notification (PENDING → APPROVED / WAITLIST / REJECTED) ── */

export type StatusChangeType = "APPROVED" | "WAITLIST" | "REJECTED";

export interface StatusChangeEmailInput {
  to: string;
  firstName: string;
  newStatus: StatusChangeType;
  archetypeLabel?: string | null;
}

const STATUS_LABEL: Record<StatusChangeType, string> = {
  APPROVED: "Validé",
  WAITLIST: "Liste d'attente",
  REJECTED: "Profil non retenu",
};

// Helpers d'URL pour les emails (toujours absolu, jamais localhost)
function getWhatsAppUrlForEmail(): string {
  return process.env.WHATSAPP_URL || process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://chat.whatsapp.com/JwJGgoQpS46I9r81QPrCs4";
}
function getAccountUrlForEmail(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
  return `${base}/account`;
}

/**
 * Envoie un email au membre quand son statut change.
 * Catégorise l'email comme "status_change" pour les analytics.
 */
export async function sendStatusChangeEmail({
  to,
  firstName,
  newStatus,
  archetypeLabel,
}: StatusChangeEmailInput): Promise<SendEmailResult> {
  const name = firstName.trim() || "toi";
  const safeName = escapeHtml(name);
  const label = STATUS_LABEL[newStatus];

  const subjectByStatus: Record<StatusChangeType, string> = {
    APPROVED: "Tu es validé dans HASHCODE",
    WAITLIST: "Tu es sur la liste d'attente HASHCODE",
    REJECTED: "Ton profil HASHCODE n'a pas été retenu",
  };

  const subject = subjectByStatus[newStatus];
  let text: string;
  let inner: string;

  if (newStatus === "APPROVED") {
    const archLine = archetypeLabel
      ? `Profil confirmé : ${archetypeLabel}.`
      : "Ton profil a été examiné et confirmé.";
    text = [
      `Bonjour ${name},`,
      "",
      `${archLine} Bienvenue dans la communauté.`,
      "",
      "Voici ton lien direct pour rejoindre le groupe WhatsApp officiel :",
      getWhatsAppUrlForEmail(),
      "",
      "Tu y retrouveras :",
      "• Les sessions pratiques de la communauté",
      "• Les annonces et événements",
      "• Les autres membres qui avancent comme toi",
      "",
      "On a hâte de te compter parmi nous.",
      "",
      "L'équipe HASHCODE",
    ].join("\n");
    inner = approvedHtml(safeName, archetypeLabel);
  } else if (newStatus === "WAITLIST") {
    text = [
      `Bonjour ${name},`,
      "",
      "On a examiné ton profil avec attention. Les places de cette vague sont",
      "limitées, et tu es sur liste d'attente pour la prochaine ouverture.",
      "",
      "Pas besoin de recréer un profil — on te contactera par email dès qu'une",
      "place se libère. D'ici là, tu peux continuer à faire évoluer ton objectif",
      "à 3 mois dans ton espace /account.",
      "",
      "L'équipe HASHCODE",
    ].join("\n");
    inner = waitlistHtml(safeName);
  } else {
    // REJECTED
    text = [
      `Bonjour ${name},`,
      "",
      "Merci pour l'intérêt que tu portes à HASHCODE. Après examen, ton profil",
      "n'a pas été retenu pour cette vague. On relit les dossiers chaque semaine.",
      "",
      "Tu peux mettre à jour tes informations (objectif à 3 mois, WhatsApp, etc.)",
      "dans ton espace /account et repasser la validation à tout moment.",
      "",
      "L'équipe HASHCODE",
    ].join("\n");
    inner = rejectedHtml(safeName);
  }

  return sendEmail({ to, subject, html: emailShell(subject, inner), text });
}

function approvedHtml(safeName: string, archetype: string | null | undefined) {
  const archLine = archetype
    ? `Profil confirmé : <strong style="color:#C5F441;">${escapeHtml(archetype)}</strong>.`
    : "Ton profil a été examiné et confirmé.";
  return [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("VALIDÉ"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Bienvenue, ${safeName}.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">${archLine} Voici ton lien direct pour rejoindre le groupe WhatsApp officiel :</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;background-color:#0A0A0A;border:1px solid #333B1E;border-radius:8px;">`,
    `<tr><td align="center" style="padding:16px 12px;">`,
    `<a href="${escapeHtml(getWhatsAppUrlForEmail())}" style="display:inline-block;padding:12px 24px;background-color:#C5F441;color:#0A0A0A;text-decoration:none;font-family:${MAIL_FONT};font-size:14px;font-weight:700;border-radius:6px;">Rejoindre le groupe WhatsApp</a>`,
    `</td></tr></table>`,
    `<p style="margin:0;font-family:${MAIL_FONT};font-size:12px;line-height:1.6;color:#94A3B8;">Tu peux aussi gérer ton profil sur <a href="${escapeHtml(getAccountUrlForEmail())}" style="color:#C5F441;">ton espace HASHCODE</a>.</p>`,
    `</td></tr>`,
  ].join("");
}

function waitlistHtml(safeName: string) {
  return [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("LISTE D'ATTENTE"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Tu es sur la liste, ${safeName}.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">On a examiné ton profil. Les places de cette vague sont limitées, et tu es sur liste d'attente pour la prochaine ouverture.</p>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Pas besoin de recréer un profil — on te contactera par email dès qu'une place se libère. D'ici là, continue à faire évoluer ton objectif à 3 mois dans <a href="${escapeHtml(getAccountUrlForEmail())}" style="color:#C5F441;">ton espace HASHCODE</a>.</p>`,
    `</td></tr>`,
  ].join("");
}

function rejectedHtml(safeName: string) {
  return [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("NON RETENU"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">${safeName}, ton profil n'a pas été retenu.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Merci pour l'intérêt que tu portes à HASHCODE. On relit les dossiers chaque semaine.</p>`,
    `<p style="margin:0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Tu peux mettre à jour tes informations et repasser la validation à tout moment depuis <a href="${escapeHtml(getAccountUrlForEmail())}" style="color:#C5F441;">ton espace HASHCODE</a>.</p>`,
    `</td></tr>`,
  ].join("");
}
