import { Link } from "@/i18n/routing";

/** Footer minimal — py-6, empilé et centré sur mobile. */
export function EventsFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-3 px-5 py-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
        <p className="mono-label">HASHCODE · REBOOT — Édition 2026</p>
        <nav
          aria-label="Liens de pied de page"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1"
        >
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center text-[13px] text-muted-foreground transition-colors hover:text-lime focus-lime"
          >
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/#faq"
            className="inline-flex min-h-[44px] items-center text-[13px] text-muted-foreground transition-colors hover:text-lime focus-lime"
          >
            FAQ
          </Link>
        </nav>
      </div>
    </footer>
  );
}
