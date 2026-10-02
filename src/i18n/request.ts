import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * T08 — Configuration de requête next-intl.
 *
 * Charge les messages de la locale demandée. Les fichiers complets
 * (extraction de tout le contenu FR/EN) sont l'objet de T09 ; ici on
 * charge le namespace minimal `common` + `notFound` déjà présent.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
