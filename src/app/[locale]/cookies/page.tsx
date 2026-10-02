import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.cookies' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('legal.cookies');

  // Type-safe raw accessors for arrays/objects
  const categoriesList = t.raw('sections.categories.list') as Array<{ name: string; desc: string; cookies: string[] }>;
  const manageBrowsers = t.raw('sections.manage.browsers') as string[];
  const thirdPartyServices = t.raw('sections.thirdParty.services') as string[];
  const retentionDurations = t.raw('sections.retention.durations') as string[];
  const yourRightsList = t.raw('sections.yourRights.list') as string[];

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href={`/${locale === 'fr' ? '' : locale}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-4" />
          {t('backHome')}
        </Link>

        <header className="mb-12">
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">{t('title')}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('lastUpdated', { date: new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) })}
          </p>
        </header>

        <article className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.whatAreCookies.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.whatAreCookies.content')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.categories.title')}</h2>
            <div className="mt-3 space-y-6 text-muted-foreground">
              {categoriesList.map((cat, i) => (
                <div key={i} className="border-l-2 border-lime pl-4">
                  <h3 className="font-semibold text-foreground">{cat.name}</h3>
                  <p className="mt-1">{cat.desc}</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                    {cat.cookies.map((cookie: string, j: number) => (
                      <li key={j}>{cookie}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.consent.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.consent.content1')}</p>
              <p>{t('sections.consent.content2')}</p>
              <p>{t('sections.consent.content3')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.manage.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.manage.content1')}</p>
              <p>{t('sections.manage.content2')}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {manageBrowsers.map((browser, i) => (
                  <li key={i}>{browser}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.thirdParty.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.thirdParty.content1')}</p>
              <p>{t('sections.thirdParty.content2')}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {thirdPartyServices.map((service, i) => (
                  <li key={i}>{service}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.retention.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.retention.content')}</p>
              <p><strong>{t('sections.retention.details')}:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {retentionDurations.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.yourRights.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.yourRights.content')}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {yourRightsList.map((right, i) => (
                  <li key={i}>{right}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.contact.title')}</h2>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p>{t('sections.contact.content')}</p>
              <p>
                <a href="mailto:dpo@hashcode.reboot" className="text-lime hover:underline">
                  dpo@hashcode.reboot
                </a>
              </p>
            </div>
          </section>
        </article>

        <nav className="mt-12 pt-8 border-t border-border" aria-label={t('navAria')}>
          <ul className="flex flex-wrap gap-4 text-sm">
            <li><Link href={`/${locale === 'fr' ? '' : locale}/mentions-legales`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.mentions')}</Link></li>
            <li><Link href={`/${locale === 'fr' ? '' : locale}/confidentialite`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.privacy')}</Link></li>
            <li><Link href={`/${locale === 'fr' ? '' : locale}/cgu`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.terms')}</Link></li>
          </ul>
        </nav>
      </div>
    </main>
  );
}