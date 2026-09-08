import * as React from "react";
import {
  MessageCircle,
  Pencil,
  ArrowRight,
} from "lucide-react";
import { WHATSAPP_URL } from "@/lib/profiling/auto-controls";

/**
 * Actions rapides — boutons pour les actions courantes.
 * Server component (liens statiques).
 */
export function QuickActions({
  communityStatus,
  profileStatus,
}: {
  communityStatus: string;
  profileStatus: string;
}) {
  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6">
      <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase mb-4">
        Actions rapides
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* WhatsApp */}
        {communityStatus === "JOINED" ? (
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border border-border/60 bg-background/50 p-4 hover:border-lime/40 hover:bg-lime/5 transition-colors group"
          >
            <MessageCircle className="size-5 text-lime shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Groupe WhatsApp</p>
              <p className="text-xs text-muted-foreground">Ouvre le groupe</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-lime transition-colors" />
          </a>
        ) : (
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border border-lime/30 bg-lime/5 p-4 hover:bg-lime/10 transition-colors group"
          >
            <MessageCircle className="size-5 text-lime shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Rejoindre WhatsApp</p>
              <p className="text-xs text-muted-foreground">Groupe officiel</p>
            </div>
            <ArrowRight className="size-4 text-lime/60 group-hover:text-lime transition-colors" />
          </a>
        )}

        {/* Éditer profil */}
        <a
          href="/account"
          className="flex items-center gap-3 rounded-md border border-border/60 bg-background/50 p-4 hover:border-lime/40 hover:bg-lime/5 transition-colors group"
        >
          <Pencil className="size-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Modifier mon profil</p>
            <p className="text-xs text-muted-foreground">Coordonnées & objectif</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-lime transition-colors" />
        </a>
      </div>
    </section>
  );
}
