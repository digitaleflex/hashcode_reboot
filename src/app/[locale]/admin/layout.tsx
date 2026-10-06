import { redirect } from "next/navigation";
import { getAdminRoleFromRequestHeaders } from "@/lib/admin-auth";
import AdminShell from "@/components/reboot/admin/AdminShell";

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
 *
 * ⚠️ Cette garde est la porte d'accès côté page. Ne la remplace pas par
 * `proxy.ts` : le proxy ne peut pas lire la base. Elle est distincte des
 * gardes de routes API (`requireAdmin` dans `src/lib/admin-auth.ts`, D24),
 * qui répondent 401 ou 403 et ne redirigent pas.
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