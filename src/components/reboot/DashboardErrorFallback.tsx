import { AlertCircle, RefreshCw } from "lucide-react";

export function DashboardErrorFallback({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-3" role="alert">
      <AlertCircle className="size-8 text-destructive mx-auto" aria-hidden />
      <h3 className="font-display font-semibold text-foreground">Une erreur s'est produite</h3>
      <p className="text-sm text-muted-foreground">{message ?? "Le chargement a échoué. Veuillez réessayer."}</p>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
          <RefreshCw className="size-3.5" /> Réessayer
        </button>
      )}
    </div>
  );
}
