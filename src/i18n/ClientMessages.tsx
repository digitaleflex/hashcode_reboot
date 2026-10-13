import * as React from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pickMessages } from "./client-messages";

/**
 * Fournit au sous-arbre client uniquement les namespaces listés.
 *
 * Server component : `getMessages` lit les messages complets côté serveur,
 * puis `pickMessages` n'en sélectionne que le strict nécessaire avant de les
 * sérialiser dans le payload RSC/HTML. `NextIntlClientProvider` remplaçant le
 * contexte parent, chaque frontière doit fournir explicitement ce dont son
 * sous-arbre a besoin.
 *
 * À utiliser dans les layouts/pages server des routes qui ne peuvent pas se
 * contenter du jeu minimal du layout racine (`ROOT_CLIENT_NAMESPACES`).
 */
export async function ClientMessages({
  locale,
  namespaces,
  children,
}: {
  locale: string;
  namespaces: readonly string[];
  children: React.ReactNode;
}) {
  const messages = pickMessages(await getMessages({ locale }), namespaces);
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
