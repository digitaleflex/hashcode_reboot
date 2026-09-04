import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "./providers";
import { SpeedInsights } from "@vercel/speed-insights/next";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://reboot.joinhashcode.com"),
  alternates: { canonical: "/" },
  title: "HASHCODE REBOOT — Rejoins la communauté dev, cyber & IA",
  description:
    "Où que tu sois. Crée ton profil en 2 min, reçois ton accès WhatsApp et commence avec ton premier challenge cette semaine.",
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
  openGraph: {
    title: "HASHCODE REBOOT — Dev, cyber & IA. Où que tu sois.",
    description:
      "Crée ton profil en 2 min, reçois ton accès WhatsApp et commence avec ton premier challenge cette semaine.",
    siteName: "HASHCODE REBOOT",
    type: "website",
    locale: "fr_FR",
    images: [
      {
        url: "/og-cover.png",
        width: 1200,
        height: 630,
        alt: "HASHCODE REBOOT — Rejoins la communauté dev, cyber & IA, où que tu sois",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HASHCODE REBOOT — Dev, cyber & IA. Où que tu sois.",
    description:
      "Crée ton profil en 2 min, reçois ton accès WhatsApp et commence avec ton premier challenge cette semaine.",
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
        <Providers>
          {children}
          <Toaster />
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
