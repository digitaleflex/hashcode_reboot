import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function CGUPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('legal.terms');

  const userObligationsItems = t.raw('sections.userObligations.items') as string[];

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
            <h2 className="font-display font-semibold text-xl">{t('sections.acceptance.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.acceptance.content1')}</p>
              <p>{t('sections.acceptance.content2')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.description.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.description.content1')}</p>
              <p>{t('sections.description.content2')}</p>
              <p>{t('sections.description.content3')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.access.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.access.content1')}</p>
              <p>{t('sections.access.content2')}</p>
              <p>{t('sections.access.content3')}</p>
              <p>{t('sections.access.content4')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.account.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.account.content1')}</p>
              <p>{t('sections.account.content2')}</p>
              <p>{t('sections.account.content3')}</p>
              <p>{t('sections.account.content4')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.userObligations.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.userObligations.content1')}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {userObligationsItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.content.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.content.content1')}</p>
              <p>{t('sections.content.content2')}</p>
              <p>{t('sections.content.content3')}</p>
              <p>{t('sections.content.content4')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.intellectualProperty.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.intellectualProperty.content1')}</p>
              <p>{t('sections.intellectualProperty.content2')}</p>
              <p>{t('sections.intellectualProperty.content3')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.suspension.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.suspension.content1')}</p>
              <p>{t('sections.suspension.content2')}</p>
              <p>{t('sections.suspension.content3')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.liability.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.liability.content1')}</p>
              <p>{t('sections.liability.content2')}</p>
              <p>{t('sections.liability.content3')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.modifications.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.modifications.content')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.termination.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.termination.content1')}</p>
              <p>{t('sections.termination.content2')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.law.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.law.content')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.contact.title')}</h2>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p>{t('sections.contact.content')}</p>
              <p>
                <a href="mailto:contact@hashcode.reboot" className="text-lime hover:underline">
                  contact@hashcode.reboot
                </a>
              </p>
            </div>
          </section>
        </article>

        <nav className="mt-12 pt-8 border-t border-border" aria-label={t('navAria')}>
          <ul className="flex flex-wrap gap-4 text-sm">
            <li><Link href={`/${locale === 'fr' ? '' : locale}/mentions-legales`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.mentions')}</Link></li>
            <li><Link href={`/${locale === 'fr' ? '' : locale}/confidentialite`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.privacy')}</Link></li>
            <li><Link href={`/${locale === 'fr' ? '' : locale}/cookies`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.cookies')}</Link></li>
          </ul>
        </nav>
      </div>
    </main>
  );
}