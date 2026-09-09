"use client";

import * as React from "react";
import { Share2, Check, Copy } from "lucide-react";

/**
 * Bouton de partage du profil public /profile/[id].
 * Copie le lien + ouvre en nova onglet.
 */
export function ShareProfile({ memberId }: { memberId: string }) {
  const [copied, setCopied] = React.useState(false);
  const [url, setUrl] = React.useState(`/profile/${memberId}`);

  React.useEffect(() => {
    try {
      setUrl(`${window.location.origin}/profile/${memberId}`);
    } catch {
      /* SSR fallback */
    }
  }, [memberId]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible */
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <a
        href={`/profile/${memberId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-lime/90"
      >
        <Share2 className="size-4" />
        Voir mon profil public
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-border/60 bg-background/50 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-lime/40 hover:text-foreground cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="size-4 text-lime" />
            Copié !
          </>
        ) : (
          <>
            <Copy className="size-4" />
            Copier le lien
          </>
        )}
      </button>
    </div>
  );
}
