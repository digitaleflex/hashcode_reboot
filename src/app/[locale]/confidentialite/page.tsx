import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function ConfidentialitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('legal.privacy');
  
  // Type-safe raw accessors for arrays/objects
  const dataCollectedProfileItems = t.raw('sections.dataCollected.profile.items') as string[];
  const dataCollectedTechnicalItems = t.raw('sections.dataCollected.technical.items') as string[];
  const dataCollectedUsageItems = t.raw('sections.dataCollected.usage.items') as string[];
  const purposesItems = t.raw('sections.purposes.items') as Array<{ label: string; desc: string }>;
  const legalBasisItems = t.raw('sections.legalBasis.items') as Array<{ purpose: string; basis: string }>;
  const recipientsCategories = t.raw('sections.recipients.categories') as string[];
  const retentionItems = t.raw('sections.retention.items') as Array<{ category: string; duration: string }>;
  const rightsList = t.raw('sections.rights.list') as string[];
  const cookiesCategories = t.raw('sections.categories.list') as Array<{ name: string; desc: string; cookies: string[] }>;
  const consentBrowsers = t.raw('sections.manage.browsers') as string[];
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
            <h2 className="font-display font-semibold text-xl">{t('sections.introduction.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.introduction.content1')}</p>
              <p>{t('sections.introduction.content2')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.controller.title')}</h2>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p>{t('sections.controller.content')}</p>
              <p><strong>{t('sections.controller.contact')}:</strong> <a href="mailto:dpo@hashcode.reboot" className="text-lime hover:underline">dpo@hashcode.reboot</a></p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.dataCollected.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <h3 className="font-semibold">{t('sections.dataCollected.profile.title')}</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {dataCollectedProfileItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <h3 className="font-semibold">{t('sections.dataCollected.technical.title')}</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {dataCollectedTechnicalItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <h3 className="font-semibold">{t('sections.dataCollected.usage.title')}</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {dataCollectedUsageItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.purposes.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              {purposesItems.map((item, i) => (
                <p key={i}><strong>{item.label}:</strong> {item.desc}</p>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.legalBasis.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              {legalBasisItems.map((item, i) => (
                <p key={i}><strong>{item.purpose}:</strong> {item.basis}</p>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.recipients.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.recipients.content1')}</p>
              <p>{t('sections.recipients.content2')}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {recipientsCategories.map((cat, i) => (
                  <li key={i}>{cat}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.transfers.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.transfers.content')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.retention.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              {retentionItems.map((item, i) => (
                <p key={i}><strong>{item.category}:</strong> {item.duration}</p>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.rights.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.rights.content')}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {rightsList.map((right, i) => (
                  <li key={i}>{right}</li>
                ))}
              </ul>
              <p>{t('sections.rights.exercise', { email: 'dpo@hashcode.reboot' })}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.security.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.security.content')}</p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.cookies.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.cookies.content')}</p>
              <p>
                <Link href={`/${locale === 'fr' ? '' : locale}/cookies`} className="text-lime hover:underline">
                  {t('sections.cookies.link')}
                </Link>
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display font-semibold text-xl">{t('sections.changes.title')}</h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>{t('sections.changes.content')}</p>
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
            <li><Link href={`/${locale === 'fr' ? '' : locale}/cgu`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.terms')}</Link></li>
            <li><Link href={`/${locale === 'fr' ? '' : locale}/cookies`} className="text-muted-foreground hover:text-lime transition-colors">{t('nav.cookies')}</Link></li>
          </ul>
        </nav>
      </div>
    </main>
  );
}