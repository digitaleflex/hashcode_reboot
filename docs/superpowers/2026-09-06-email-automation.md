# Email Automation — Séquences onboarding + engagement

> **Goal:** Implémenter des séquences d'emails automatisées pour l'onboarding et l'engagement des membres.

**Architecture:** API routes qui envoient les emails aux moments clés du parcours membre. Séquences basées sur le statut du membre (waitlist → approved → invited → active).

**Prérequis:** Système Resend déjà configuré (`src/lib/mail.ts`), templates HTML existants.

---

## Séquences à implémenter

### Sequence 1: Waitlist Welcome
- **Trigger:** Inscription (nouveau membre waitlist)
- **Email:** "Merci pour ton inscription" avec attente validation

### Sequence 2: Approval Notification
- **Trigger:** Admin approuve le profil
- **Email:** "Ton profil est validé" + instructions next steps

### Sequence 3: Invitation
- **Trigger:** Admin invite vers WhatsApp
- **Email:** "Rejoins la communauté" + lien WhatsApp

### Sequence 4: Engagement (optionnel)
- **Trigger:** 7 jours après invitation, pas d'activité
- **Email:** "On t'attend" + rappel

---

## Fichiers à créer/modifier

| Action | Fichier | Responsabilité |
|--------|---------|---------------|
| Create | `src/lib/emails/waitlist.ts` | Template waitlist |
| Create | `src/lib/emails/engagement.ts` | Template engagement |
| Create | `src/app/api/emails/waitlist/route.ts` | Envoi welcome |
| Create | `src/app/api/emails/engagement/route.ts` | Envoi engagement |
| Modify | `src/app/api/members/[id]/route.ts` | Trigger email sur approval |
| Modify | `src/app/api/members/[id]/invite/route.ts` | Trigger email sur invite |
| Add | `src/lib/cron/scheduler.ts` | Scheduler (optionnel) |

---

## Étape 1: Template Waitlist

**File:** `src/lib/emails/waitlist.ts`

```typescript
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

  const inner = [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("INSCRIPTION RECUE"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">Merci ${safeName}, ton inscription est confirmée.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Ton profil est en cours de validation par notre équipe. Nous-reviewons chaque candidature pour garantir la qualité de la communauté.</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;background-color:#0A0A0A;border:1px solid #262626;border-radius:8px;">`,
    `<tr><td style="padding:14px 16px;">`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;font-weight:700;color:#F8FAFC;margin:0 0 4px 0;">Ce qui t'attend</div>`,
    `<div style="font-family:${MAIL_FONT};font-size:13px;line-height:1.6;color:#94A3B8;margin:0;">• Une communauté de passionnés Web, Cyber et AI<br/>• Sessions pratiques et networking<br/>• Accès à des ressources exclusives</div>`,
    `</td></tr></table>`,
    `<p style="margin:20px 0 0 0;font-family:${MAIL_FONT};font-size:14px;line-height:1.6;color:#F8FAFC;">Tu recevras un email dès que ton profil sera validé.<br/><span style="color:#94A3B8;">L'équipe HASHCODE</span></p>`,
    `</td></tr>`,
  ].join("");

  const html = emailShell(
    "Ton inscription est confirmée — on reviendra vers toi bientôt.",
    inner,
  );

  return sendEmail({ to, subject, html, text: [...] });
}
```

---

## Étape 2: Template Engagement

**File:** `src/lib/emails/engagement.ts`

```typescript
export interface EngagementEmailInput {
  to: string;
  firstName: string;
  daysSinceInvite: number;
}

export async function sendEngagementEmail({
  to,
  firstName,
  daysSinceInvite,
}: EngagementEmailInput): Promise<SendEmailResult> {
  const name = firstName.trim() || "member";
  const safeName = escapeHtml(name);
  const subject = "On t'attend sur HASHCODE — rejoins le groupe";

  const inner = [
    `<tr><td style="padding:24px 32px 28px 32px;background-color:#141414;">`,
    monoLabel("TU N'AS PAS ENCORE REJOINT"),
    `<h1 style="margin:0 0 12px 0;font-family:${MAIL_FONT};font-size:24px;line-height:1.25;font-weight:800;color:#F8FAFC;">On t'attend ${safeName}, la communauté est prête.</h1>`,
    `<p style="margin:0 0 16px 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.65;color:#F8FAFC;">Il y a ${daysSinceInvite} jours, tu as reçu ton invitation pour rejoindre le groupe WhatsApp officiel de HASHCODE. Tu l'as peut-être manquée ?</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;">`,
    `<tr><td align="center" style="padding:0;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">`,
    `<tr><td align="center" bgcolor="#C5F441" style="background-color:#C5F441;border-radius:8px;padding:14px 32px;">`,
    `<a href="${WHATSAPP_URL}" target="_blank" rel="noopener" style="font-family:${MAIL_FONT};font-size:16px;font-weight:800;color:#0A0A0A;text-decoration:none;display:inline-block;">Rejoindre maintenant</a>`,
    `</td></tr></table>`,
    `</td></tr></table>`,
    `<p style="margin:0;font-family:${MAIL_FONT};font-size:13px;line-height:1.6;color:#94A3B8;text-align:center;">La communauté avance sans toi — retrouve les derniers membres et partage ton objectif.</p>`,
    `<p style="margin:20px 0 0 0;font-family:${MAIL_FONT};font-size:14px;line-height:1.6;color:#F8FAFC;"><br/><span style="color:#94A3B8;">L'équipe HASHCODE</span></p>`,
    `</td></tr>`,
  ].join("");

  const html = emailShell(
    "On t'attend — rejoins le groupe WhatsApp officiel.",
    inner,
  );

  return sendEmail({ to, subject, html, text: [...] });
}
```

---

## Étape 3: API Routes

**File:** `src/app/api/emails/waitlist/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendWaitlistEmail } from "@/lib/emails/waitlist";

export async function POST(req: NextRequest) {
  const { memberId } = await req.json();

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { email: true, firstName: true },
  });

  if (!member?.email) {
    return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
  }

  await sendWaitlistEmail({
    to: member.email,
    firstName: member.firstName ?? "",
  });

  return NextResponse.json({ ok: true });
}
```

---

## Étape 4: Intégration dans le flux admin

Dans `src/app/api/members/[id]/route.ts` (POST - approval):

```typescript
// Après approval du profil
await sendWelcomeEmail({
  to: member.email,
  firstName: member.firstName ?? "",
  archetype: member.profileArchetype ?? "Membre HASHCODE",
});
```

Dans `src/app/api/members/[id]/invite/route.ts`:

```typescript
// Après invitation WhatsApp
await sendInvitationEmail({
  to: member.email,
  firstName: member.firstName ?? "",
  whatsappUrl: WHATSAPP_URL,
});
```

---

## Étape 5: Cron job pour engagement (optionnel)

**File:** `src/app/api/cron/engagement/route.ts`

```typescript
// Vérifie les membres invited il y a 7+ jours sans activité
// Envoie un email de rappel

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const inactiveMembers = await db.member.findMany({
    where: {
      communityStatus: "INVITED",
      updatedAt: { lt: sevenDaysAgo },
    },
    select: { id: true, email: true, firstName: true },
  });

  for (const member of inactiveMembers) {
    await sendEngagementEmail({
      to: member.email,
      firstName: member.firstName ?? "",
      daysSinceInvite: 7,
    });
  }

  return NextResponse.json({ sent: inactiveMembers.length });
}
```
