import { redirect } from "next/navigation";
import AdminShell from "@/components/reboot/admin/AdminShell";
import { getAdminContextFromRequestHeaders } from "@/lib/admin-auth";
import { isPublicAdminPath } from "@/lib/admin-roles";

/**
 * Layout de l'espace admin — **server component** : porte la garde d'accès.
 *
 * `proxy-guard.ts` s'exécute en Edge runtime, où la base est inaccessible :
 * il ne peut vérifier que la présence d'un cookie (membre OU admin nominatif),
 * pas l'appartenance à la liste blanche admin. Un membre ordinaire connecté
 * via `/login` possède un cookie membre parfaitement valide et passerait donc
 * la porte du proxy.
 *
 * Cette garde ferme ce trou, côté runtime Node où `auth.api.getSession` est
 * disponible. Fail-closed : session illisible, en erreur, ou rôle absent de
 * `"operator"` / `"viewer"` ⇒ redirection vers la connexion admin, jamais un
 * rendu de l'espace admin.
 *
 * 2FA : OPTIONNELLE (choix produit — désactivée par défaut). Aucun forçage
 * ici : un admin qui a activé sa 2FA la verra demandée au login, un admin
 * qui ne l'a pas fait se connecte en email + mot de passe. L'enrôlement
 * volontaire se fait depuis `/admin/settings` (section Sécurité) ou
 * directement sur `/admin/setup-2fa`.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getAdminContextFromRequestHeaders();

  // Le proxy pose deux headers utiles ici (un layout n'a pas d'accès direct
  // au pathname en App Router) :
  //   x-hc-admin-pathname — chemin demandé, hors préfixe de locale ;
  //   x-hc-admin-public   — présent sur les pages publiques SANS cookie
  //                         (évite la boucle /admin/login → /admin/login).
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const isPublicPageNoSession = headerList.get("x-hc-admin-public") === "1";

  // Pages publiques : pas de garde quand personne n'est connecté.
  if (!admin && isPublicPageNoSession) {
    return <>{children}</>;
  }

  if (!admin) {
    redirect("/admin/login?next=%2Fadmin");
  }

  return <AdminShell>{children}</AdminShell>;
}
