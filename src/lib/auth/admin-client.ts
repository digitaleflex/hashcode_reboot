// Client Better Auth ADMIN — répond sur /api/auth/admin/* (basePath dédié).
// L'action `onTwoFactorRedirect` intercepte la réponse de connexion quand la
// 2FA est active : la page de login bascule alors sur l'étape du code TOTP.

import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";

/** Callback global déclenché quand Better Auth signale une 2FA requise. */
type TwoFactorRedirectHandler = (methods: string[]) => void;

let onTwoFactorRedirect: TwoFactorRedirectHandler | null = null;

/** Enregistre le handler (appelé par la page de login admin). */
export function setTwoFactorRedirectHandler(handler: TwoFactorRedirectHandler | null) {
  onTwoFactorRedirect = handler;
}

export const adminAuthClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  basePath: "/api/auth/admin",
  plugins: [
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect: ({ twoFactorMethods }) => {
        onTwoFactorRedirect?.(twoFactorMethods);
      },
    }),
  ],
});

/** Raccourcis typés pour le flux 2FA (utilisés par la page de login). */
export const adminTwoFactor = adminAuthClient.twoFactor;
