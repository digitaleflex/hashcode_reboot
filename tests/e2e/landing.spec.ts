import { test, expect, type Page } from '@playwright/test';

/**
 * E2E — Landing (#214 gaps).
 *
 * Couvre :
 * 1. CTA hero → `profiling_started` (+ entrée dans le questionnaire)
 * 2. Ancres structurelles #axes / #faq (ne pas renommer)
 * 3. Sticky mobile CTA (visible après le hero, thumb-zone)
 * 4. Accordion FAQ + lien confidentialité (modale)
 * 5. CTA footer → `reboot_cta_clicked` ref `footer-join`
 * 6. Section activité : mocks /api/public/events?limit=3 (vide / erreur /
 *    3 items) + /api/community/count, états `role=status`
 * 7. Accessibilité native (sans @axe-core/playwright — non installé,
 *    axe-core n'est présent qu'en transitif via eslint-plugin-jsx-a11y) :
 *    landmarks, h1 unique, lang, noms accessibles des boutons,
 *    aria-labelledby résolues, images.
 *
 * ANTI-FLAKY i18n : next-intl redirige `/` vers `/en` quand le navigateur
 * préfère l'anglais (cf. locale-routing.spec.ts). On fixe `fr-FR` pour
 * tester l'identité « URL → contenu FR » de façon déterministe.
 */
test.describe('Landing (FR)', () => {
  test.use({ locale: 'fr-FR' });

  // `navigator.sendBeacon` envoie un Blob dont Playwright ne peut lire ni le
  // corps (`postData()` ni `postDataBuffer()`). On capture les payloads côté
  // page (wrapper sur `sendBeacon`) pour pouvoir les asserter ensuite.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Neutralise le bandeau cookies (localStorage = source de vérité) : sinon
      // il recouvre les CTA bas de page sur mobile et intercepte les clics.
      try {
        localStorage.setItem(
          'hashcode:reboot:consent',
          JSON.stringify({ choice: 'declined', ts: Date.now() }),
        );
      } catch {
        /* ignore */
      }

      const w = window as unknown as { __beacons?: string[] };
      w.__beacons = [];
      const original = navigator.sendBeacon?.bind(navigator);
      if (original) {
        navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
          try {
            if (data instanceof Blob) {
              void data.text().then((t) => w.__beacons!.push(t));
            } else if (typeof data === 'string') {
              w.__beacons!.push(data);
            }
          } catch {
            /* ignore */
          }
          return original(url, data);
        };
      }
    });
  });

  /** Ferme le bandeau cookies s'il recouvre les CTA (contexte frais = visible). */
  async function dismissCookies(page: Page) {
    const close = page.getByRole('button', { name: 'Fermer et refuser' });
    if ((await close.count()) > 0) {
      await close.first().click();
    }
  }

  /**
   * Attend qu'un événement analytics de type donné (et `ref` optionnel) ait été
   * capturé. L'écoute DOIT être armée avant l'action déclenchante.
   */
  async function waitForAnalytics(page: Page, type: string, ref?: string, timeout = 15000) {
    await page.waitForFunction(
      ({ type, ref }) => {
        const arr = (window as unknown as { __beacons?: string[] }).__beacons ?? [];
        return arr.some((raw) => {
          try {
            const b = JSON.parse(raw) as { type?: string; ref?: string };
            return b.type === type && (ref === undefined || b.ref === ref);
          } catch {
            return false;
          }
        });
      },
      { type, ref },
      { timeout },
    );
  }

  test('CTA hero → profiling_started + entrée questionnaire', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    const hero = page.locator('section[aria-labelledby="hero-title"]');
    // Le `h1` porte la promesse ; la marque est dans l'eyebrow (puce) et le header.
    await expect(hero.locator('h1')).toContainText('Progresse en tech', {
      timeout: 15000,
    });
    await expect(
      hero.getByText('Communauté dev, cyber & IA', { exact: false }),
    ).toBeVisible();

    const heroCta = hero.getByRole('button', { name: 'Construire mon profil' });
    await Promise.all([
      waitForAnalytics(page, 'reboot_cta_clicked', 'hero'),
      waitForAnalytics(page, 'profiling_started'),
      heroCta.click(),
    ]);

    // Phase "profiling" : le shell affiche le compteur d'étapes.
    // Timeout large : la première compilation dev (dynamic framer-motion)
    // peut prendre plusieurs dizaines de secondes.
    await expect(page.getByText(/Question 1 sur/)).toBeVisible({ timeout: 45000 });
  });

  test('ancres structurelles #axes et #faq', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    const hero = page.locator('section[aria-labelledby="hero-title"]');
    await hero.getByRole('button', { name: 'Découvrir les axes' }).click();
    await expect(page.locator('#axes')).toBeInViewport({ timeout: 15000 });

    const faqLink = page.locator('footer').getByRole('button', { name: 'Questions fréquentes' });
    await faqLink.click();
    await expect(page.locator('#faq')).toBeInViewport({ timeout: 15000 });
  });

  test.describe('sticky mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('barre visible après le hero, CTA → profiling_started', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await dismissCookies(page);

      const stickyBar = page
        .locator('div[aria-hidden]')
        .filter({ hasText: '2 min · Gratuit' })
        .first();
      // Au chargement (haut de page) la barre est masquée : décalée hors
      // écran + `inert` + `aria-hidden` (traduite, elle garde une boîte
      // visible pour Playwright — d'où l'assertion sur l'état, pas la géométrie).
      await expect(stickyBar).toHaveAttribute('aria-hidden', 'true');

      // Défile à mi-page : passé 60 % du hero, #rejoindre non visible.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4));
      await expect(stickyBar).toHaveAttribute('aria-hidden', 'false', { timeout: 10000 });
      await expect(page.getByText('2 min · Gratuit', { exact: true })).toBeVisible();

      await Promise.all([
        waitForAnalytics(page, 'reboot_cta_clicked', 'sticky-mobile'),
        waitForAnalytics(page, 'profiling_started'),
        // Dernière occurrence dans le DOM : la barre sticky est rendue
        // après le footer dans <Landing />.
        page.getByRole('button', { name: 'Construire mon profil' }).last().click(),
      ]);
    });
  });

  test('accordion FAQ + lien confidentialité → modale', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    const faq = page.locator('#faq');
    await faq.scrollIntoViewIfNeeded();

    await faq.getByRole('button', { name: "C'est quoi le Reboot exactement ?" }).click();
    // `.last()` : l'innermost (contenu de l'accordéon), les ancêtres portent
    // le même texte et feraient échouer le mode strict.
    await expect(faq.getByText("Le point d'entrée de la communauté HASHCODE", { exact: false }).last()).toBeVisible();

    await faq.getByRole('button', { name: 'Mes données sont protégées ?' }).click();
    const privacyLink = faq.getByRole('button', { name: 'Voir la politique de confidentialité' });
    await expect(privacyLink).toBeVisible();
    await privacyLink.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
  });

  test('CTA footer → reboot_cta_clicked ref footer-join', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    const footerJoin = page.locator('footer').getByRole('button', { name: 'Construire mon profil' });
    await Promise.all([
      waitForAnalytics(page, 'reboot_cta_clicked', 'footer-join'),
      footerJoin.click(),
    ]);
  });

  test('CTA profil (section engine) → profiling_started', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    const cta = page
      .locator('#engine')
      .getByRole('button', { name: 'Construire mon profil' });
    await Promise.all([
      waitForAnalytics(page, 'reboot_cta_clicked', 'engine'),
      waitForAnalytics(page, 'profiling_started'),
      cta.click(),
    ]);
  });

  test('CTA communauté → profiling_started', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    const cta = page
      .locator('#community')
      .getByRole('button', { name: 'Construire mon profil' });
    await Promise.all([
      waitForAnalytics(page, 'reboot_cta_clicked', 'community'),
      waitForAnalytics(page, 'profiling_started'),
      cta.click(),
    ]);
  });

  test('CTA final → profiling_started', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    const cta = page
      .locator('#rejoindre')
      .getByRole('button', { name: 'Construire mon profil' });
    await Promise.all([
      waitForAnalytics(page, 'reboot_cta_clicked', 'final'),
      waitForAnalytics(page, 'profiling_started'),
      cta.click(),
    ]);
  });

  test('FAQ — accordéon pilotable au clavier + état ARIA', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    const faq = page.locator('#faq');
    const trigger = faq.getByRole('button', {
      name: "C'est quoi le Reboot exactement ?",
    });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(
      faq.getByText("Le point d'entrée de la communauté HASHCODE", { exact: false }).last(),
    ).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('Footer — logo cliquable + destinations légales', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const footer = page.locator('footer');
    await expect(
      footer.getByRole('link', { name: "HASHCODE REBOOT — retour à l'accueil" }),
    ).toHaveAttribute('href', '/');

    const legal = [
      ['Mentions légales', '/mentions-legales'],
      ['CGU', '/cgu'],
      ['Confidentialité', '/confidentialite'],
      ['Cookies', '/cookies'],
    ] as const;
    for (const [name, href] of legal) {
      await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
  });

  test('Skip link → #contenu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Aller au contenu principal' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#contenu$/);
    await expect(page.locator('#contenu')).toBeInViewport();
  });

  test.describe('activité temps réel (API mockées)', () => {
    const COUNT_URL = '**/api/community/count';

    async function mockCount(page: Page, count: number | null) {
      await page.route(COUNT_URL, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(count === null ? {} : { count }),
        });
      });
    }

    async function mockEvents(page: Page, mode: 'empty' | 'error' | 'three') {
      await page.route('**/api/public/events*', async (route) => {
        if (mode === 'error') {
          await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
          return;
        }
        const events =
          mode === 'empty'
            ? []
            : [
                {
                  id: 'e1',
                  title: 'Session Web Live',
                  startsAt: new Date(Date.now() + 86400000).toISOString(),
                  location: 'Cotonou',
                  url: null,
                  type: 'session',
                  level: 'beginner',
                  status: 'live',
                  goingCount: 5,
                  interestCount: 2,
                },
                {
                  id: 'e2',
                  title: 'Workshop Cyber',
                  startsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
                  location: null,
                  url: null,
                  type: 'workshop',
                  level: 'intermediate',
                  status: 'scheduled',
                  goingCount: 1,
                  interestCount: 0,
                },
                {
                  id: 'e3',
                  title: 'Meetup IA',
                  startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
                  location: 'En ligne',
                  url: null,
                  type: 'meetup',
                  level: null,
                  status: 'scheduled',
                  goingCount: 0,
                  interestCount: 3,
                },
              ];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, events }),
        });
      });
    }

    test('vide → role=status + compteur communauté', async ({ page }) => {
      await mockEvents(page, 'empty');
      await mockCount(page, 42);
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const activity = page.locator('#activite');
      // `role="status"` n'a pas de nom accessible dérivé de son contenu :
      // on cible le texte visible directement.
      await expect(
        activity.getByText('Aucune session programmée pour le moment.'),
      ).toBeVisible({ timeout: 15000 });

      const footer = page.locator('footer');
      await expect(footer.getByText('Profils déjà créés', { exact: true })).toBeVisible();
      await expect(footer.getByText('42', { exact: true })).toBeVisible();
    });

    test('erreur API → role=status', async ({ page }) => {
      await mockEvents(page, 'error');
      await mockCount(page, 7);
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const activity = page.locator('#activite');
      await expect(
        activity.getByText('Sessions indisponibles pour le moment.'),
      ).toBeVisible({ timeout: 15000 });
    });

    test('3 événements → 3 cartes, statuts réels', async ({ page }) => {
      await mockEvents(page, 'three');
      await mockCount(page, 7);
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const activity = page.locator('#activite');
      await expect(activity.locator('h3')).toHaveCount(3, { timeout: 15000 });
      await expect(activity.getByText('Session Web Live', { exact: true })).toBeVisible();
      await expect(activity.getByText('Workshop Cyber', { exact: true })).toBeVisible();
      await expect(activity.getByText('Meetup IA', { exact: true })).toBeVisible();
      // Badges de statut réel (live vs programmé), jamais simulés.
      await expect(activity.getByText('En direct', { exact: true })).toBeVisible();
    });
  });

  test.describe('accessibilité native (sans axe-core)', () => {
    test('landmarks + h1 unique + lang', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.locator('main#contenu')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible();
    });

    test('chaque bouton visible a un nom accessible', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await dismissCookies(page);

      const unnamed = await page.evaluate(() => {
        const bad: string[] = [];
        document.querySelectorAll('button').forEach((b, i) => {
          const el = b as HTMLElement;
          // Sous-arbre retiré de l'arbre d'accessibilité (ex. sticky masquée).
          if (el.closest('[inert]') || el.closest('[aria-hidden="true"]')) return;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;
          const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
          if (!name) bad.push(`button#${i}[class="${el.className}"]`);
        });
        return bad;
      });
      expect(unnamed).toEqual([]);
    });

    test('aria-labelledby / liens internes résolus', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const broken = await page.evaluate(() => {
        const bad: string[] = [];
        document.querySelectorAll('[aria-labelledby]').forEach((el) => {
          for (const id of (el.getAttribute('aria-labelledby') ?? '').split(/\s+/)) {
            if (id && !document.getElementById(id)) bad.push(id);
          }
        });
        return [...new Set(bad)];
      });
      expect(broken).toEqual([]);

      // Les ancres structurelles existent réellement dans le DOM.
      for (const id of ['axes', 'faq', 'rejoindre', 'activite']) {
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      }
    });

    test('images : alt ou décoratives', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const bad = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll('img').forEach((img, i) => {
          const el = img as HTMLImageElement;
          if (el.closest('[aria-hidden="true"]')) return;
          if (el.getAttribute('role') === 'presentation') return;
          if (el.hasAttribute('alt')) return;
          out.push(`img#${i}[src="${el.getAttribute('src') ?? ''}"]`);
        });
        return out;
      });
      expect(bad).toEqual([]);
    });
  });
});
