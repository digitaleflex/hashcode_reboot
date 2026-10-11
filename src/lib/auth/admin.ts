// HASHCODE REBOOT — Better Auth ADMIN (compte nominatif + 2FA TOTP).
//
// Instance SÉPARÉE de l'auth membre (src/lib/auth/index.ts) :
//   - modèles dédiés (AdminUser/AdminSession/AdminAccount/AdminVerification,
//     cf. `modelName` ci-dessous) — aucune donnée partagée avec User/Session ;
//   - cookie dédié `hashcode-admin.session_token` (advanced.cookiePrefix) :
//     un cookie membre ne peut donc PAS ouvrir l'espace admin ;
//   - méthodes : email + mot de passe (scrypt côté Better Auth) + 2FA TOTP
//     OPTIONNELLE (désactivée par défaut — l'admin l'active volontairement
//     depuis /admin/settings ou /admin/setup-2fa).
//
// Invitation = seul chemin de création de compte : `databaseHooks.user.create`
// refuse toute inscription dont l'email n'a pas une AdminInvitation valide
// (fail-closed), et en profite pour vérifier l'email (l'invitation a été
// reçue à cette adresse) et poser le rôle invité.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, twoFactor, createAccessControl } from "better-auth/plugins";
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

// Contrôle d'accès du plugin admin. Statements alignées sur ses routes
// internes (list-users, ban, set-role, revoke-session…). L'impersonation est
// volontairement absente des deux rôles : aucun admin ne peut prendre la
// place d'un autre.
const adminAc = createAccessControl({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
} as const);

const operatorRole = adminAc.newRole({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
});

const viewerRole = adminAc.newRole({
  user: ["list", "get"],
  session: ["list"],
});

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

  // ── Plugins ────────────────────────────────────────────────────────────
  // Rôles natifs : operator (accès complet) | viewer (lecture seule).
  // `roles` DOIT être fourni avec des adminRoles personnalisés, sinon le
  // plugin rejette la config au démarrage (rôles inconnus de son AC par
  // défaut). Impersonation désactivée (aucun bouton "devenir" un admin).
  plugins: [
    admin({
      defaultRole: "viewer",
      adminRoles: ["operator", "viewer"],
      roles: {
        operator: operatorRole,
        viewer: viewerRole,
      },
    }),
    // 2FA TOTP — le secret est chiffré au repos (symétrique, clé = secret
    // d'app). `skipVerificationOnEnable: false` : la 2FA n'est active
    // qu'après validation d'un premier code (pas de fausse activation).
    twoFactor({
      issuer: "HASHCODE Admin",
      skipVerificationOnEnable: false,
    }),
  ],

  // ── Hook de création de compte : invitation obligatoire ────────────────
  // Seuil unique de création (fail-closed) : invitation absente, déjà
  // consommée ou expirée ⇒ refus. L'invitation fait office de preuve
  // d'email (reçue à cette adresse) et porte le rôle attribué.
  //
  // Pas de hook `user.update` : `role` est en `input: false` dans le schéma
  // du plugin admin (parseUserInput le retire des corps `/update-user`), et
  // le changement de rôle passe par PATCH /api/admin/admins qui écrit en
  // Prisma direct. Moins de surface, pas de blocage des routes internes.
  databaseHooks: {
    user: {
      create: {
        before: async (user, _ctx) => {
          const email = String(user.email ?? "").trim().toLowerCase();
          const invitation = await db.adminInvitation.findUnique({ where: { email } });
          if (!invitation) return false;
          if (invitation.acceptedAt) return false;
          if (invitation.expiresAt.getTime() < Date.now()) return false;

          // Consommation : un jeton ne crée qu'un seul compte.
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
              // Le rôle invité prime sur le defaultRole du plugin.
              role: invitation.role === "operator" ? "operator" : "viewer",
            },
          };
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
  // basePath DÉDIÉ (`/api/admin-auth`) et non `/api/auth/admin` : ce dernier
  // est intercepté par le catch-all de l'auth MEMRE (`/api/auth/[...betterAuth]`)
  // qui répond 404 avant d'atteindre la route admin — deux catch-alls sous le
  // même préfixe ne coexistent pas en App Router.
  basePath: "/api/admin-auth",
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
  const adminUser = await getAdminSessionFromRequest(req);
  if (!adminUser || adminUser.role !== "operator") return null;
  return adminUser;
}

export type AdminSessionUser = NonNullable<Awaited<ReturnType<typeof getAdminSessionFromHeaders>>>;

/** Handler Next.js pour toutes les routes /api/admin-auth/* */
export const adminAuthHandler = toNextJsHandler(adminAuth.handler);
