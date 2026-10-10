import { redirect } from "next/navigation";
import AdminShell from "@/components/reboot/admin/AdminShell";
import {
  getAdminContextFromRequestHeaders,
  type AdminRole,
} from "@/lib/admin-auth";
import { getAdminSession } from "@/lib/auth/admin";

/**
 * Layout de l'espace admin — **server component** : porte la garde d'accès.
 *
 * `proxy.ts` s'exécute en Edge runtime, où la base est inaccessible : il ne
 * peut vérifier que la présence d'un cookie (membre OU admin nominatif), pas
 * l'appartenance à la liste blanche admin. Un membre ordinaire connecté via
 * `/login` possède un cookie membre parfaitement valide et passerait donc la
 * porte du proxy.
 *
 * Cette garde ferme ce trou, côté runtime Node où `auth.api.getSession` est
 * disponible. Fail-closed : session illisible, en erreur, ou rôle absent de
 * `"operator"` / `"viewer"` ⇒ redirection vers la connexion admin, jamais un
 * rendu de l'espace admin.
 *
 * Contrôle 2FA : un operator sans 2FA activée est redirigé vers
 * `/admin/setup-2fa` (enrôlement forcé) — la 2FA est obligatoire pour les
 * operators (cf. src/lib/auth/admin.ts). Les viewers y sont invités, pas
 * forcés.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getAdminContextFromRequestHeaders();

  if (!admin) {
    // Une session membre valide mais non-admin atterrit ici : on renvoie vers
    // la connexion admin. `next` permet à l'admin légitime de revenir où il allait.
    redirect("/admin/login?next=%2Fadmin");
  }

  // Forçage 2FA operator (nouveau compte ou 2FA désactivée entre-temps).
  if (admin.role === "operator") {
    const adminSession = await getAdminSession();
    if (adminSession && !adminSession.twoFactorEnabled) {
      redirect("/admin/setup-2fa");
    }
  }

  return <AdminShell>{children}</AdminShell>;
}
