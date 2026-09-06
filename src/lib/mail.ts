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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
