import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { HashSymbol } from "@/components/brand/logo";

/**
 * 404 pour toutes les routes sous `[locale]`.
 *
 * Sans ce fichier, une URL inconnue rend la 404 par défaut dans le layout
 * racine — lequel ne porte plus `<html>`/`<body>` (déplacés dans ce même
 * layout `[locale]`). Ce composant garantit une page 404 complète et
 * localisée, à l'intérieur du document HTML.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
      <HashSymbol className="h-12 w-12 text-lime" />
      <p className="mono-label text-lime text-xs font-bold tracking-[0.3em]">404</p>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
        {t("title")}
      </h1>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-lime px-5 py-2.5 font-medium text-black transition-colors hover:bg-lime/90"
      >
        {t("backHome")}
      </Link>
    </main>
  );
}
