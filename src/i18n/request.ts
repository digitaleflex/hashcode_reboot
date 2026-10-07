import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * T08 — Configuration de requête next-intl.
 *
 * FR-only temporaire 2026-10-07 (réversible) : locale `fr` seule.
 * `messages/en.json` est archivé, tout `requestLocale` non-`fr` retombe sur
 * `fr` (fallback inchangé via `hasLocale` + `defaultLocale`).
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
