import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback du segment /dashboard (pages serveur : accueil, agenda,
 * profil, paramètres). Miroir de la mise en page réelle pour éviter
 * les sauts visuels (CLS) pendant le chargement.
 */
export default function DashboardLoading() {
  return (
    <div
      className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-6"
      role="status"
      aria-label="Chargement du dashboard"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-36 rounded-md" />
        <Skeleton className="h-36 rounded-md" />
      </div>
      <Skeleton className="h-24 rounded-md" />
      <Skeleton className="h-48 rounded-md" />
    </div>
  );
}
