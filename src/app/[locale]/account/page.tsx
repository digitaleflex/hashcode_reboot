import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

/**
 * Page /account — redirige vers l'espace canonique /dashboard/settings.
 *
 * Tout son contenu vit désormais dans le dashboard : statut (StatusCard),
 * prochaines étapes (NextSteps), coordonnées (ContactForm) et déconnexion.
 * Conservée comme redirect (au lieu d'être supprimée) pour les anciens
 * liens/bookmarks et les emails qui pointent encore vers /account.
 */
export default async function AccountPage() {
  const t = await getTranslations("account.header");
  redirect(t("redirectPath", { defaultValue: "/dashboard/settings" }));
}