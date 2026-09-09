import { HashSymbol } from "@/components/brand/logo";

/**
 * Fallback global de navigation (segments sans loading.tsx dédié).
 * Léger : logo + pulse lime, pas de spinner externe.
 */
export default function Loading() {
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center gap-4"
      role="status"
      aria-label="Chargement en cours"
    >
      <HashSymbol className="text-lime animate-pulse" size={44} />
      <p className="mono-label text-muted-foreground animate-pulse">
        Chargement…
      </p>
    </div>
  );
}
