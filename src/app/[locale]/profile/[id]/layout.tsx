import { ClientMessages } from "@/i18n/ClientMessages";
import { PROFILE_CLIENT_NAMESPACES } from "@/i18n/client-messages";

/** Réinjecte `profile` (retiré du payload public du layout racine). */
export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <ClientMessages locale={locale} namespaces={PROFILE_CLIENT_NAMESPACES}>
      {children}
    </ClientMessages>
  );
}
