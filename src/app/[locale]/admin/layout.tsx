import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { selectMessages } from "@/i18n/client-messages";
import AdminShell from "@/components/reboot/admin/AdminShell";
import { getAdminContextFromRequestHeaders } from "@/lib/admin-auth";
import { isPublicAdminPath } from "@/lib/admin-roles";

/**
 * Layout de l'espace admin — **server component** : porte la garde d'accès.
 *
 * Source unique : session membre + `Member.adminRole` (operator/viewer).
 * Le login nominatif séparé /admin/login est déprécié et redirige vers
 * /login — fail-closed : pas de rôle admin ⇒ redirect /login, jamais un
 * rendu de l'espace admin.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getAdminContextFromRequestHeaders();

  // Le layout racine exclut `admin` du payload public : on le réinjecte ici.
  const locale = await getLocale();
  const messages = selectMessages(await getMessages({ locale }), ["dashboard"]);

  // /admin/login est un redirecteur public (pas de garde, sinon boucle).
  const { headers } = await import("next/headers");
  const pathname = (await headers()).get("x-hc-admin-pathname") ?? "";
  if (!admin && isPublicAdminPath(pathname)) {
    return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
  }

  if (!admin) {
    redirect("/login?next=%2Fadmin");
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <AdminShell>{children}</AdminShell>
    </NextIntlClientProvider>
  );
}
