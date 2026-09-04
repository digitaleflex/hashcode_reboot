import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://reboot.joinhashcode.com"),
  alternates: { canonical: "/" },
  title: "HASHCODE REBOOT — Rejoins la nouvelle génération HASHCODE",
  description:
    "Rejoins HASHCODE, une communauté orientée Web Development, Cybersecurity et Applied AI. Apprendre, construire, pratiquer et progresser ensemble.",
  keywords: [
    "HASHCODE",
    "Reboot",
    "communauté tech",
    "Web Development",
    "Cybersecurity",
    "Applied AI",
    "Bénin",
    "développeur",
  ],
  authors: [{ name: "HASHCODE" }],
  openGraph: {
    title: "HASHCODE REBOOT",
    description:
      "Une nouvelle génération de la communauté commence. Web Development · Cybersecurity · Applied AI.",
    siteName: "HASHCODE REBOOT",
    type: "website",
    locale: "fr_FR",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 400,
        alt: "HASHCODE REBOOT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HASHCODE REBOOT",
    description:
      "Une nouvelle génération de la communauté commence. Web Development · Cybersecurity · Applied AI.",
    images: ["/logo.png"],
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

const SITE_URL = "https://reboot.joinhashcode.com";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "HASHCODE REBOOT",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} font-sans antialiased bg-background text-foreground`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
