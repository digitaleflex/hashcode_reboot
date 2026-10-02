import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/mail";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: false,
  },

  emailOTP: {
    enabled: true,
    sendVerificationOTP: async ({ email, otp }) => {
      const member = await db.member.findUnique({ where: { email } });
      if (!member) return;

      const base = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
      const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(email)}&code=${encodeURIComponent(otp)}&next=${encodeURIComponent("/dashboard")}`;

      await sendMagicLinkEmail({
        to: email,
        firstName: member.firstName || "toi",
        code: otp,
        url,
      });
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