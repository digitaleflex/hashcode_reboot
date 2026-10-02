import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.mentions' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function MentionsLegalesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('legal.mentions');

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
            <h2 className="font-display font-semibold text-xl">{t('sections.editor.title')}</h2>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p><strong>{t('sections.editor.label')}:</strong> {t('sections.editor.value')}</p>
              <p><strong>{t('sections.editor.address')}:</strong> {t('sections.editor.addressValue')}</p>
              <p><strong>{t('sections.editor.email')}:</strong> <a href="mailto:contact@hashcode.reboot" className="text-lime hover:underline">contact@hashcode.reboot</a></p>
              <p><strong>{t('sections.editor.phone')}:</strong> {t('sections.editor.phoneValue')}</p>
              <p><strong>{t('sections.editor.siret')}:</strong> {t('sections.editor.siretValue')}</p>
              <p><strong>{t('sections.editor.rcs')}:</strong> {t('sections.editor.rcsValue')}</p>
              <p><strong>{t('sections.editor.tva')}:</strong> {t('sections.editor.tvaValue')}</p>
              <p><strong>{t('sections.editor.director')}:</strong> {t('sections.editor.directorValue')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.hosting.title')}</h2>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p><strong>{t('sections.hosting.label')}:</strong> {t('sections.hosting.value')}</p>
              <p><strong>{t('sections.hosting.address')}:</strong> {t('sections.hosting.addressValue')}</p>
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
            <h2 className="font-display font-semibold text-xl">{t('sections.limitation.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.limitation.content1')}</p>
              <p>{t('sections.limitation.content2')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.externalLinks.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.externalLinks.content')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.applicableLaw.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.applicableLaw.content')}</p>
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
            <li><Link href={`/${locale === 'fr' ? '' : locale}/confidentialite`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.privacy')}</Link></li>
            <li><Link href={`/${locale === 'fr' ? '' : locale}/cgu`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.terms')}</Link></li>
            <li><Link href={`/${locale === 'fr' ? '' : locale}/cookies`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.cookies')}</Link></li>
          </ul>
        </nav>
      </div>
    </main>
  );
}