import { redirect } from "next/navigation";

/**
 * Page /account — redirige vers l'espace canonique /dashboard/settings.
 *
 * Tout son contenu vit désormais dans le dashboard : statut (StatusCard),
 * prochaines étapes (NextSteps), coordonnées (ContactForm) et déconnexion.
 * Conservée comme redirect (au lieu d'être supprimée) pour les anciens
 * liens/bookmarks et les emails qui pointent encore vers /account.
 */
export default function AccountPage() {
  redirect("/dashboard/settings");
}
