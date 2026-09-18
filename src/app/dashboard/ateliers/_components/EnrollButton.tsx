"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inscription à un atelier — POST /api/workshops/[slug]/enroll, puis
 * router.refresh() : l'état est recalculé côté serveur, le client ne
 * modifie jamais la progression lui-même.
 */
export function EnrollButton({ slug, className }: { slug: string; className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function enroll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workshops/${slug}/enroll`, { method: "POST" });
      if (!res.ok) {
        // L'UI ne ment jamais : on affiche l'erreur réelle du serveur.
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Impossible de rejoindre l'atelier.");
        setLoading(false);
        return;
      }
      // Succès : le serveur re-render avec l'enrollment actif.
      router.refresh();
    } catch {
      setError("Connexion interrompue — réessaie.");
      setLoading(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <button
        onClick={enroll}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-2 rounded-md bg-lime px-5 py-2.5 text-sm font-medium text-background transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2",
          loading && "opacity-60 cursor-not-allowed",
        )}
        aria-label="Rejoindre cet atelier"
      >
        {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
        {loading ? "Inscription…" : "Rejoindre cet atelier"}
      </button>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
