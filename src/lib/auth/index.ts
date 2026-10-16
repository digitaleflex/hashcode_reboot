import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import type { NextRequest } from "next/server";
import type { Member } from "@prisma/client";
import { db } from "@/lib/db";
import { isEmailBlacklisted } from "@/lib/blacklist";
import { sendMagicLinkEmail } from "@/lib/email/builders";

export async function requestSignInOtp(email: string): Promise<void> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    await auth.handler(
      new Request(`${base.replace(/\/$/, "")}/api/auth/email-otp/send-verification-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "sign-in" }),
      }),
    );
  } catch {
    /* best-effort */
  }
}

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: false,
    requireEmailVerification: false,
  },

  // ── OAuth Google (connexion 1-clic, alternative au code OTP) ──────────
  // Actif uniquement si les secrets sont posés (GOOGLE_CLIENT_ID/SECRET) :
  // sans eux, le provider est omis et le login OTP reste seul (dev local).
  // Redirect URI à déclarer côté Google Cloud Console :
  //   {NEXT_PUBLIC_SITE_URL}/api/auth/callback/google
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        },
      }
    : {}),

  // Relie un compte Google au User existant (créé par OTP) quand l'email
  // correspond — Google est trusted (email vérifié par Google). Sans cela,
  // un membre OTP qui clique "Continuer avec Google" obtiendrait un second
  // User orphelin au lieu de retrouver son Member.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60,
    },
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 60 * 60,
  },

  databaseHooks: {
    session: {
      create: {
        // Coupe-circuit connexion : aucun email blacklisté ne doit obtenir
        // de session, même si un OTP a fuité par un autre canal. Le hook ne
        // reçoit que `userId`, on résout l'email via la table User
        // (modèle `User`, champ `email`, cf. prisma/schema.prisma).
        // Fail-closed : aucune capture d'erreur ici — si la lecture DB
        // lève, l'exception remonte et la session n'est pas créée. Un
        // userId sans email connu refuse aussi la session (pas d'orpheline).
        // Retourner `false` bloque la création (doc better-auth).
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { email: true },
          });
          if (!user?.email) return false;
          if (await isEmailBlacklisted(user.email)) return false;
        },
      },
    },
  },

  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        const member = await db.member.findUnique({ where: { email } });
        if (!member) return;

        // Un email blacklisté ne reçoit jamais d'OTP. Sortie silencieuse
        // volontairement identique au cas « membre inconnu » ci-dessus :
        // même traitement observable, aucun message ni log distinctif, pour
        // ne pas casser l'anti-énumération existante.
        if (await isEmailBlacklisted(email)) return;

        const base = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
        // Pas de code dans l'URL : le code est envoyé dans le corps du mail,
        // l'utilisateur le saisit manuellement sur /verify-otp (fail-safe).
        const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/dashboard")}`;

        await sendMagicLinkEmail({
          to: email,
          firstName: member.firstName || "toi",
          code: otp,
          url,
        });
      },
    }),
  ],

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
  },

  trustedOrigins: [process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"],
});

/**
 * Common helper: resolve the `Member` for the current Better Auth session
 * carried by `req` (cookie `better-auth.session_token`).
 *
 * Single source of truth for the session → email → member lookup previously
 * duplicated in `account-auth.ts` and `admin-auth.ts`.
 * Fail-closed: any error (session lookup, DB) yields `null`, never throws.
 */
export async function getMemberFromRequest(req: NextRequest): Promise<Member | null> {
  try {
    const session = await auth.api.getSession({
      headers: Object.fromEntries(req.headers.entries()) as any,
    });
    if (!session?.user?.email) return null;
    return await db.member.findUnique({ where: { email: session.user.email } });
  } catch {
    return null;
  }
}

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;