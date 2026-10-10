import { redirect } from "next/navigation";
import AdminShell from "@/components/reboot/admin/AdminShell";
import {
  getAdminContextFromRequestHeaders,
  type AdminRole,
} from "@/lib/admin-auth";
import { getAdminSession } from "@/lib/auth/admin";

/**
 * Pages publiques de l'espace admin (login nominatif, activation
 * d'invitation, enrôlement 2FA). Marqueur posé par `proxy.ts`
 * (`x-hc-admin-public`) : présent uniquement quand AUCUN cookie de session
 * n'existe et que la page est dans cette liste — sinon la garde
 * redirigerait /admin/login vers lui-même en boucle.
 */
const PUBLIC_ADMIN_PAGES = new Set(["/admin/login", "/admin/setup", "/admin/setup-2fa"]);

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
 * `/admin/setup-2fa` (enrôlement forcé) — obligatoire pour les operators
 * (cf. src/lib/auth/admin.ts). Les viewers y sont invités, pas forcés.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getAdminContextFromRequestHeaders();

  // Pages publiques : pas de garde quand personne n'est connecté. Le
  // marqueur vient du proxy (seule source fiable du chemin demandé ici).
  if (!admin) {
    const { headers } = await import("next/headers");
    const isPublicPage = (await headers()).get("x-hc-admin-public") === "1";
    if (isPublicPage) return <>{children}</>;
    // Une session membre valide mais non-admin atterrit ici : on renvoie vers
    // la connexion admin. `next` permet à l'admin légitime de revenir où il allait.
    redirect("/admin/login?next=%2Fadmin");
  }

  // Forçage 2FA operator (nouveau compte ou 2FA désactivée entre-temps).
  // Les pages publiques restent atteignables même en tant qu'operator sans
  // 2FA : la page setup-2fa EST la destination du forcing.
  if (admin.role === "operator" && admin.twoFactorEnabled === false) {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const isPublicPage = headerList.get("x-hc-admin-public") === "1";
    const pathname = headerList.get("x-hc-admin-pathname") ?? "";
    if (!isPublicPage && pathname !== "/admin/setup-2fa") {
      redirect("/admin/setup-2fa");
    }
  }
  return <AdminShell>{children}</AdminShell>;
}
