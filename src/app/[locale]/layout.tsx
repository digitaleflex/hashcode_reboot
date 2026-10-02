import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

/**
 * T08 — Layout [locale] (next-intl).
 *
 * - Valide la locale (404 sinon) et l'annonce pour le rendu statique.
 * - Fournit les messages au client. Le <html lang> reste dans le layout
 *   racine (contenu 100 % FR aujourd'hui) ; T10 le rendra dynamique
 *   quand le contenu EN existera réellement.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
