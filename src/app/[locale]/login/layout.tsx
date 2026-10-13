import { ClientMessages } from "@/i18n/ClientMessages";
import { AUTH_CLIENT_NAMESPACES } from "@/i18n/client-messages";

/**
 * Le layout racine ne fournit plus `auth` (payload landing minimal) :
 * on le réinjecte ici, pour `/login` et son sous-arbre.
 */
export default async function LoginLayout({
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
