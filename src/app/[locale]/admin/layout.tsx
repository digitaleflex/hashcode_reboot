import { redirect } from "next/navigation";
import AdminShell from "@/components/reboot/admin/AdminShell";
import { getAdminRoleFromRequestHeaders } from "@/lib/admin-auth";

/**
 * Layout de l'espace admin — **server component** : porte la garde d'accès.
 *
 * `proxy.ts` s'exécute en Edge runtime, où la base est inaccessible : il ne
 * peut vérifier que la présence du cookie Better Auth, pas l'appartenance à la
 * liste blanche admin. Un membre ordinaire connecté via `/login` possède un
 * cookie parfaitement valide et passait donc la porte du proxy.
 *
 * Cette garde ferme ce trou, côté runtime Node où `auth.api.getSession` est
 * disponible. Fail-closed : session illisible, en erreur, ou email absent de
 * `ADMIN_OPERATORS` / `ADMIN_VIEWERS` ⇒ redirection vers le parcours de
 * connexion, jamais un rendu de l'espace admin.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getAdminRoleFromRequestHeaders();

  if (!admin) {
    // Une session membre valide mais non-admin atterrit ici : on renvoie vers
    // la connexion. `next` permet à l'admin légitime de revenir où il allait.
    redirect("/login?next=%2Fadmin");
  }

  return <AdminShell>{children}</AdminShell>;
}