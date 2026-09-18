// Shell d'email partagé — extrait TEL QUEL de src/lib/mail.ts (Phase 1
// templates). Les corps de fonctions sont byte-identiques à l'original pour
// garantir un rendu inchangé ; seule la visibilité passe de privée à exportée.
//
// Consommé par :
//  - src/lib/mail.ts (envoi réel)
//  - src/lib/email-templates/render.ts (aperçu admin, Phase 2 : envoi)
// Source unique : toute modification du shell impacte les deux.

/* ------------------------------------------------------------------ */
/* Charte HASHCODE REBOOT (déplacée depuis src/lib/mail.ts, Phase 1)    */
/* LIME #C5F441 (accent rare) · VOID #0A0A0A · SURFACE #141414          */
/* Texte #F8FAFC · Secondaire #94A3B8 · Police système (email-safe)     */
/* Mise en page en tableaux, CSS 100% inline, max 600px.                */
/* Header : wordmark 100% texte (aucune image externe, rend partout). */
/* ------------------------------------------------------------------ */

export const MAIL_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Coquille commune : fond VOID, carte SURFACE 600px, liseré lime,
 * header logo centré, footer sobre. `inner` = lignes <tr> du contenu.
 */
export function emailShell(preheader: string, inner: string): string {
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

export function monoLabel(label: string): string {
  return `<div style="font-family:${MAIL_FONT};font-size:11px;font-weight:700;letter-spacing:2px;color:#C5F441;margin:0 0 12px 0;">${label}</div>`;
}

