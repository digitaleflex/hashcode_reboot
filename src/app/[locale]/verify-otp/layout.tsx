import { ClientMessages } from "@/i18n/ClientMessages";
import { AUTH_CLIENT_NAMESPACES } from "@/i18n/client-messages";

/** Réinjecte `auth` (retiré du payload public du layout racine). */
export default async function VerifyOtpLayout({
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
