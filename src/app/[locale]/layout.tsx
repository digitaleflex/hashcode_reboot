import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/toaster";
import { routing } from "@/i18n/routing";
import { Providers } from "../providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const SITE_URL = "https://reboot.joinhashcode.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "HASHCODE REBOOT",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
};

/**
 * T08 — Layout [locale] (next-intl).
 *
 * FR-only temporaire 2026-10-07 (réversible) : `generateStaticParams`
 * ne pré-génère que `fr`, `canonical` vaut `"/"` sans `languages.en` ni
 * `x-default`, `openGraph.locale` vaut `fr_FR` uniquement. Le garde
 * `hasLocale` est conservé (toute locale non-fr → 404).
 *
 * Porte désormais `<html>`/`<body>` afin que `lang` reflète la locale servie.
 * Les métadonnées et le `viewport` y ont été déplacés pour pouvoir être
 * localisés.
 *
 * Valide la locale (404 sinon) et fournit les messages au client.
 */
export function generateStaticParams() {
  return [{ locale: "fr" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "landing.meta" });
  // FR-only temporaire 2026-10-07 : chemin canonique unique, pas d'alternates EN.
  const path = "/";

  return {
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
    keywords: [
      "HASHCODE",
      "Reboot",
      "communauté tech",
      "communauté développeurs",
      "Web Development",
      "Cybersecurity",
      "Applied AI",
      "apprendre à coder",
    ],
    authors: [{ name: "HASHCODE" }],
    alternates: {
      canonical: path,
      languages: {
        fr: "/",
      },
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      siteName: "HASHCODE REBOOT",
      type: "website",
      locale: "fr_FR",
      url: path,
      images: [
        {
          url: "/og-cover.png",
          width: 1200,
          height: 630,
          alt: t("ogTitle"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: ["/og-cover.png"],
    },
    icons: {
      icon: [
        {
          url:
            "data:image/svg+xml," +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0A0A0A"/><g transform="skewX(-14) translate(2 0)"><rect x="7" y="7" width="4" height="18" fill="#C5F441"/><rect x="21" y="7" width="4" height="18" fill="#C5F441"/><rect x="7" y="14" width="18" height="4" fill="#C5F441"/></g></svg>`,
            ),
        },
      ],
    },
    robots: { index: true, follow: true },
  };
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
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} font-sans antialiased bg-background text-foreground`}
      >
        {/* Barre de progression des navigations (charte lime, sans spinner) */}
        <NextTopLoader
          color="#C5F441"
          height={3}
          showSpinner={false}
          zIndex={100}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <Providers>
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
          <Toaster />
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
