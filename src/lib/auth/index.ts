import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { db } from "@/lib/db";
import { isEmailBlacklisted } from "@/lib/blacklist";
import { sendMagicLinkEmail } from "@/lib/mail";

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
        const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(email)}&code=${encodeURIComponent(otp)}&next=${encodeURIComponent("/dashboard")}`;

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

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;