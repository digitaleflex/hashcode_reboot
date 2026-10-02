import { Inter, JetBrains_Mono } from "next/font/google";

export const adminSans = Inter({
  subsets: ["latin"],
  variable: "--font-admin-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const adminMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-admin-mono",
  weight: ["400", "500"],
  display: "swap",
});
