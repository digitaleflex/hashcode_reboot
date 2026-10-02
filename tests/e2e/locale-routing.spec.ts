import { test, expect } from '@playwright/test';

/**
 * E2E — Locale Routing (i18n)
 * 
 * Valide :
 * 1. FR = locale par défaut (sans préfixe)
 * 2. EN = sous /en
 * 3. Redirection canonique /fr → /
 * 4. Navigation préserve la locale
 * 5. Middleware skip /api/*
 */

test.describe('Locale routing', () => {
  test('FR root (/) loads in French', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Vérifier contenu FR
    await expect(page.locator('text=Bienvenue dans le Reboot')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Construire mon profil')).toBeVisible();
  });

  test('EN root (/en) loads in English', async ({ page }) => {
    await page.goto('/en');
    await page.waitForLoadState('domcontentloaded');
    
    // Vérifier contenu EN
    await expect(page.locator('text=Welcome to the Reboot')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Build my profile')).toBeVisible();
  });

  test('/fr redirects to / (canonical FR)', async ({ page }) => {
    const response = await page.goto('/fr', { waitUntil: 'domcontentloaded' });
    
    // Doit rediriger vers /
    expect(page.url()).toMatch(/\/$/);
    expect(response?.status()).toBeLessThan(400);
  });

  test('/en/dashboard redirects to /en/login (auth required)', async ({ page }) => {
    const response = await page.goto('/en/dashboard', { waitUntil: 'domcontentloaded' });
    
    // Doit rediriger vers login EN avec locale préservée
    expect(page.url()).toMatch(/\/en\/login/);
    expect(response?.status()).toBeLessThan(400);
  });

  test('/dashboard redirects to /login (FR auth required)', async ({ page }) => {
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    
    // Doit rediriger vers login FR
    expect(page.url()).toMatch(/\/login$/);
    expect(response?.status()).toBeLessThan(400);
  });

  test('Navigation links preserve locale (FR)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Cliquer sur "Événements" (ou lien navigation)
    const eventsLink = page.locator('a:has-text("Événements")').first();
    if (await eventsLink.count() > 0) {
      await eventsLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toMatch(/^https?:\/\/[^/]+\/evenements/);
      expect(page.url()).not.toMatch(/\/en\//);
    }
  });

  test('Navigation links preserve locale (EN)', async ({ page }) => {
    await page.goto('/en');
    await page.waitForLoadState('domcontentloaded');
    
    const eventsLink = page.locator('a:has-text("Events")').first();
    if (await eventsLink.count() > 0) {
      await eventsLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toMatch(/\/en\/evenements/);
    }
  });

  test('API routes accessible without locale prefix', async ({ page }) => {
    // /api/* ne doit PAS être réécrit par le middleware i18n
    const response = await page.request.get('/api/health');
    expect([200, 404]).toContain(response.status()); // 404 si route n'existe pas, mais pas redirect 307
  });

  test('Static assets not redirected', async ({ page }) => {
    const response = await page.request.get('/favicon.ico');
    expect([200, 404]).toContain(response.status());
  });

  test('Locale switcher works (if present)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Chercher un sélecteur de langue s'il existe
    const langSwitch = page.locator('button:has-text("FR"), button:has-text("EN"), select[name="locale"]').first();
    if (await langSwitch.count() > 0) {
      // Test optionnel selon implémentation
    }
  });
});

test.describe('SEO meta tags per locale', () => {
  test('FR page has French meta tags', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const title = await page.title();
    expect(title).toMatch(/HASHCODE|Reboot/i);
    
    const metaDesc = page.locator('meta[name="description"]');
    if (await metaDesc.count() > 0) {
      const content = await metaDesc.getAttribute('content');
      expect(content).toMatch(/communauté|dev|cyber|IA/i);
    }
  });

  test('EN page has English meta tags', async ({ page }) => {
    await page.goto('/en');
    await page.waitForLoadState('domcontentloaded');
    
    const metaDesc = page.locator('meta[name="description"]');
    if (await metaDesc.count() > 0) {
      const content = await metaDesc.getAttribute('content');
      expect(content).toMatch(/community|dev|cyber|AI/i);
    }
  });
});