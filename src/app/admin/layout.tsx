import type { Metadata } from "next";
import { adminMono, adminSans } from "./fonts";

export const metadata: Metadata = {
  title: "Admin — HASHCODE REBOOT",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${adminSans.variable} ${adminMono.variable} admin-scope min-h-screen flex flex-col`}
    >
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}
