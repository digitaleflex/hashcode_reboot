import { ClientMessages } from "@/i18n/ClientMessages";
import { AUTH_CLIENT_NAMESPACES } from "@/i18n/client-messages";

/**
 * Le layout racine ne fournit pas `auth` (payload landing minimal) : on le
 * réinjecte ici pour `/auth/*` — aujourd'hui le callback OAuth, qui rend
 * `AuthLayout` et lit donc `auth.common` côté client.
 *
 * Sans ce layout, `useTranslations("auth.common")` échoue avec MISSING_MESSAGE
 * : `NextIntlClientProvider` REMPLACE les messages du parent au lieu de les
 * fusionner (cf. src/i18n/client-messages.ts).
 */
export default async function AuthCallbackLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <ClientMessages locale={locale} namespaces={AUTH_CLIENT_NAMESPACES}>
      {children}
    </ClientMessages>
  );
}
