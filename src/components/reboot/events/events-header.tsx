"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/routing";
import { CtaArrow, RebootButton } from "@/components/reboot/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEM =
  "inline-flex min-h-[44px] items-center rounded-md px-3 text-[15px] transition-colors focus-lime";

export interface EventsHeaderProps {
  isAuthed: boolean;
  /** Même contrat que le CTA de la landing : redirection vers la home. */
  onJoin: () => void;
}

/**
 * Header de la page publique /evenements.
 *
 * Desktop : logo + nav (Événements actif en lime) + compte + CTA lime.
 * Mobile (<768) : logo + CTA lime « Rejoindre » VISIBLE + hamburger.
 * Le menu mobile est un `Sheet` shadcn (bottom) : Escape, clic extérieur et
 * aria-expanded / aria-controls sont gérés par Radix.
 */
export function EventsHeader({ isAuthed, onJoin }: EventsHeaderProps) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-3 px-5 sm:px-6">
        <Link href="/" className="shrink-0 rounded-md focus-lime" aria-label="HASHCODE — accueil">
          <Logo variant="full" size="sm" />
        </Link>

        {/* ── Desktop ─────────────────────────────────────────────────── */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          <Link
            href="/evenements"
            aria-current="page"
            className={cn(NAV_ITEM, "text-lime")}
          >
            Événements
          </Link>
          <Link
            href="/#axes"
            className={cn(NAV_ITEM, "text-muted-foreground hover:text-foreground")}
          >
            Axes
          </Link>
          <Link
            href="/#faq"
            className={cn(NAV_ITEM, "text-muted-foreground hover:text-foreground")}
          >
            FAQ
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={isAuthed ? "/dashboard" : "/login"}
            className={cn(
              NAV_ITEM,
              "text-muted-foreground hover:text-foreground",
              "px-0 text-sm",
            )}
          >
            {isAuthed ? "Mon espace" : "Se connecter"}
          </Link>
          <RebootButton size="sm" onClick={onJoin} className="group">
            Rejoindre
            <CtaArrow />
          </RebootButton>
        </div>

        {/* ── Mobile ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 md:hidden">
          {!isAuthed && (
            <RebootButton size="sm" onClick={onJoin} className="shrink-0">
              Rejoindre
            </RebootButton>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
                className={cn(
                  "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border",
                  "text-foreground transition-colors hover:border-lime/50 focus-lime cursor-pointer",
                  open && "border-lime/60 text-lime",
                )}
              >
                <Menu className="size-5" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[80vh] gap-0 rounded-t-xl border-border bg-background px-5 pb-6 pt-5 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
            >
              <SheetHeader className="p-0">
                <SheetTitle className="font-display text-lg font-semibold tracking-tight">
                  Navigation
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col" aria-label="Navigation mobile">
                <Link
                  href="/evenements"
                  aria-current="page"
                  onClick={close}
                  className={cn(
                    NAV_ITEM,
                    "text-lime border-b border-border/60 font-medium",
                  )}
                >
                  Événements
                </Link>
                <Link
                  href="/#axes"
                  onClick={close}
                  className={cn(
                    NAV_ITEM,
                    "border-b border-border/60 text-muted-foreground",
                  )}
                >
                  Axes
                </Link>
                <Link
                  href="/#faq"
                  onClick={close}
                  className={cn(
                    NAV_ITEM,
                    "border-b border-border/60 text-muted-foreground",
                  )}
                >
                  FAQ
                </Link>
                <Link
                  href={isAuthed ? "/dashboard" : "/login"}
                  onClick={close}
                  className={cn(NAV_ITEM, "text-foreground font-medium")}
                >
                  {isAuthed ? "Mon espace" : "Se connecter"}
                </Link>
                {!isAuthed && (
                  <RebootButton
                    size="lg"
                    onClick={() => {
                      close();
                      onJoin();
                    }}
                    className="group mt-4 w-full"
                  >
                    Rejoindre HASHCODE
                    <CtaArrow />
                  </RebootButton>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
