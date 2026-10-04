import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";

/**
 * The four legal documents served under `/cgu`, `/confidentialite`,
 * `/mentions-legales` and `/cookies`.
 */
export type LegalDocument = "terms" | "privacy" | "mentions" | "cookies";

/** Same order as the cross-navigation each page used to render. */
const NAV: Record<LegalDocument, LegalDocument[]> = {
  terms: ["mentions", "privacy", "cookies"],
  privacy: ["mentions", "terms", "cookies"],
  mentions: ["privacy", "terms", "cookies"],
  cookies: ["mentions", "privacy", "terms"],
};

const SLUG: Record<LegalDocument, string> = {
  terms: "/cgu",
  privacy: "/confidentialite",
  mentions: "/mentions-legales",
  cookies: "/cookies",
};

export const CONTACT_EMAIL = "contact@hashcode.reboot";

/**
 * Placeholder for a legal document whose text does not exist yet.
 *
 * These routes used to read `legal.terms` / `legal.privacy` / `legal.mentions` /
 * `legal.cookies` — namespaces that were never added to `messages/*.json`. At
 * runtime that threw `MISSING_MESSAGE`, the following `t.raw(...)` calls then
 * failed on a non-array (`TypeError: h.map is not a function`), and because the
 * pages are statically generated the whole production build aborted on
 * `/fr/cgu`.
 *
 * This component keeps the routes alive without inventing legal text: it states
 * plainly that no document is published, and points to a contact address. When
 * the real copy lands, add the `legal.*` namespaces and restore the four pages
 * — this file is the only thing standing in their way.
 */
export async function PendingLegalDocument({ doc }: { doc: LegalDocument }) {
  const t = await getTranslations("legalPending");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mb-8 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("backHome")}
        </Link>

        <header className="mb-10">
          <span className="mono-label inline-flex items-center gap-2 rounded-sm border border-lime/40 bg-lime/5 px-2 py-0.5 text-lime">
            <span className="size-1 rounded-full bg-lime" aria-hidden />
            {t("badge")}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t(`docs.${doc}.title`)}
          </h1>
        </header>

        <section
          aria-labelledby="legal-pending-heading"
          className="rounded-lg border border-border bg-card p-6 sm:p-8"
        >
          <h2
            id="legal-pending-heading"
            className="font-display text-xl font-semibold tracking-tight"
          >
            {t("heading")}
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {t("body")}
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {t("contactLead")}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-lime underline underline-offset-4 hover:no-underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <nav
          aria-label={t("navAria")}
          className="mt-12 border-t border-border pt-8"
        >
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {NAV[doc].map((target) => (
              <li key={target}>
                <Link
                  href={SLUG[target] as never}
                  className="inline-flex min-h-[44px] items-center text-muted-foreground transition-colors hover:text-lime"
                >
                  {t(`nav.${target}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}