// HASHCODE REBOOT — Better Auth ADMIN (compte nominatif + 2FA TOTP).
//
// Instance SÉPARÉE de l'auth membre (src/lib/auth/index.ts) :
//   - modèles dédiés (AdminUser/AdminSession/AdminAccount/AdminVerification,
//     cf. `modelName` ci-dessous) — aucune donnée partagée avec User/Session ;
//   - cookie dédié `hashcode-admin.session_token` (advanced.cookiePrefix) —
     //     un cookie membre ne peut donc PAS ouvrir l'espace admin ;
//   - méthodes : email + mot de passe (scrypt côté Better Auth) + 2FA TOTP
//     (obligatoire pour les operators, voir middleware.ts + setup-2fa).
//
// Invitation = seul chemin de création de compte : `databaseHooks.user.create`
// refuse toute inscription dont l'email n'a pas une AdminInvitation valide
// (fail-closed), et en profite pour vérifier l'email (l'invitation a été
// reçue à cette adresse) et poser le rôle invité.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, twoFactor } from "better-auth/plugins";
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendAdminPasswordResetEmail, sendAdminVerificationEmail } from "@/lib/email/builders";

/** Préfixe des cookies admin — ne JAMAIS croiser avec "better-auth" (membres). */
export const ADMIN_COOKIE_PREFIX = "hashcode-admin";
/** Nom du cookie de session admin (préfixe `__Secure-` en HTTPS). */
export const ADMIN_SESSION_COOKIE = `${ADMIN_COOKIE_PREFIX}.session_token`;

/** Rôles admin — union TS, source de vérité unique (fail-closed partout). */
export type AdminRole = "operator" | "viewer";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const adminAuth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  // ── Modèles dédiés (Prisma) + session stricte (espace admin) ───────────
  // camelCase = propriété du client Prisma généré (model AdminUser → prisma.adminUser).
  user: { modelName: "adminUser" },
  session: {
    modelName: "adminSession",
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // cache cookie 5 min
    expiresIn: 8 * 60 * 60, // 8 h max
    updateAge: 60 * 30, // rolling 30 min
    freshAge: 60 * 5, // re-auth sensible (password) au-delà de 5 min
  },
  account: { modelName: "adminAccount" },
  verification: { modelName: "adminVerification" },

  // ── Email + mot de passe ───────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    // L'invitation fait office de vérification (l'admin a reçu l'email à
    // cette adresse) : pas de second email de vérification à l'inscription.
    requireEmailVerification: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    // Connexion immédiate après le setup du mot de passe : l'opérateur qui
    // vient de créer son compte enchaîne sur la 2FA sans seconde saisie.
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAdminPasswordResetEmail({
        to: user.email,
        firstName: user.name || "Admin",
        resetUrl: url,
      });
    },
  },

  // Vérification d'email (changement d'adresse, renvoi manuel).
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendAdminVerificationEmail({
        to: user.email,
        firstName: user.name || "Admin",
        verifyUrl: url,
      });
    },
    autoSignInAfterVerification: true,
  },

  // ── Session : stricte (espace admin) ───────────────────────────────────
  // (modelName + durée : cf. bloc « Modèles dédiés » plus haut)

  // ── Plugins ────────────────────────────────────────────────────────────
  plugins: [
    // Rôles natifs : operator (accès complet) | viewer (lecture seule).
    // Impersonation désactivée (pas de bouton "devenir" un autre admin).
    admin({
      defaultRole: "viewer",
      adminRoles: ["operator", "viewer"],
      impersonationSessionDuration: 0,
    }),
    // 2FA TOTP — le secret est chiffré au repos (symétrique, clé = secret
    // d'app). `skipVerificationOnEnable: false` : la 2FA n'est active
    // qu'après validation d'un premier code (pas de fausse activation).
    twoFactor({
      issuer: "HASHCODE Admin",
      skipVerificationOnEnable: false,
    }),
  ],

  // ── Hooks de sécurité ──────────────────────────────────────────────────
  databaseHooks: {
    user: {
      create: {
        // Seuil de création de compte : invitation valide obligatoire.
        // Fail-closed : invitation absente / déjà consommée / expirée ⇒
        // refus (return false).
        before: async (user, _ctx) => {
          const email = String(user.email ?? "").trim().toLowerCase();
          const invitation = await db.adminInvitation.findUnique({ where: { email } });
          if (!invitation) return false;
          if (invitation.acceptedAt) return false;
          if (invitation.expiresAt.getTime() < Date.now()) return false;

          // L'invitation fait office de preuve d'email : on vérifie et on
          // consomme (un ancien jeton ne peut plus créer de second compte).
          await db.adminInvitation.update({
            where: { email },
            data: { acceptedAt: new Date() },
          });

          return {
            data: {
              ...user,
              email,
              name: user.name || invitation.name || undefined,
              emailVerified: true,
              // Le rôle invité prime sur le defaultRole du plugin admin.
              role: invitation.role === "operator" ? "operator" : "viewer",
              // Pas de memberEmail automatique (aucun lien Member implicite).
              memberEmail: null,
            },
          };
        },
      },
      update: {
        // Empêche l'auto-promotion depuis un formulaire : le changement de
        // rôle passe uniquement par l'API admin (PATCH /api/admin/admins).
        // Les routes du plugin admin (/admin/set-role) ne passent PAS par ce
        // hook générique — elles ont leur propre garde operator.
        before: async (user, ctx) => {
          const data = (ctx as { body?: Record<string, unknown> } | null)?.body;
          if (
            data &&
            typeof data === "object" &&
            "role" in data &&
            data.role !== user.role
          ) {
            return false;
          }
        },
      },
    },
  },

  // ── Rate limiting (protection brute-force sur /sign-in) ────────────────
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10, // 10 tentatives / minute / IP
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/two-factor/*": { window: 60, max: 5 },
    },
  },

  // ── Cookies dédiés ─────────────────────────────────────────────────────
  advanced: {
    cookiePrefix: ADMIN_COOKIE_PREFIX,
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: { enabled: false },
  },

  baseURL: DEFAULT_BASE_URL,
  trustedOrigins: [DEFAULT_BASE_URL],
});

/**
 * Résout la session admin courante depuis les headers (NextRequest ou
 * `next/headers`). Fail-closed : toute erreur (session illisible, DB en
 * panne, utilisateur banni) ⇒ `null`, jamais une exception.
 */
export async function getAdminSessionFromHeaders(headers: Record<string, string>) {
  try {
    const session = await adminAuth.api.getSession({ headers: headers as never });
    const user = session?.user as
      | {
          id: string;
          email: string;
          name?: string | null;
          role?: string;
          twoFactorEnabled?: boolean;
          banned?: boolean | null;
        }
      | undefined;
    if (!user?.email) return null;
    if (user.banned) return null;

    const role = String(user.role ?? "").trim().toLowerCase();
    if (role !== "operator" && role !== "viewer") return null;

    return {
      id: user.id,
      email: user.email.toLowerCase(),
      name: user.name ?? null,
      role: role as AdminRole,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
    };
  } catch {
    return null;
  }
}

/** Session admin depuis un NextRequest (routes API). */
export async function getAdminSessionFromRequest(req: NextRequest) {
  return getAdminSessionFromHeaders(
    Object.fromEntries(req.headers.entries()) as Record<string, string>,
  );
}

/** Session admin depuis les headers serveur (Server Components / layouts). */
export async function getAdminSession() {
  try {
    const { headers } = await import("next/headers");
    const headersObj = Object.fromEntries((await headers()).entries());
    return getAdminSessionFromHeaders(headersObj);
  } catch {
    return null;
  }
}

/** Exige un operator — pour les routes d'administration sensibles. */
export async function requireAdminOperator(req: NextRequest) {
  const admin = await getAdminSessionFromRequest(req);
  if (!admin || admin.role !== "operator") return null;
  return admin;
}

export type AdminSessionUser = NonNullable<Awaited<ReturnType<typeof getAdminSessionFromHeaders>>>;

/** Handler Next.js pour toutes les routes /api/auth/admin/* */
export const adminAuthHandler = toNextJsHandler(adminAuth.handler);
