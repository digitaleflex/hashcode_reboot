/* FIXME: partie de suite obsolète (post-migration Better Auth).
   Les 3 tests marqués `fixme` simulaient l'auth via localStorage
   ('hashcode:mock:auth'). Rien dans src/ ne lit cette clé : l'app utilise
   Better Auth (cookies de session). Les tests de redirection anonyme et de
   rendu des pages d'auth restent actifs. */

import { test, expect } from '@playwright/test';

/**
 * E2E — Auth Redirects Locale-Aware
 * 
 * Valide :
 * 1. Accès /dashboard non authentifié → /login (FR)
 * 2. Accès /en/dashboard non authentifié → /en/login (EN)
 * 3. Login FR → redirige vers /dashboard (FR)
 * 4. Login EN → redirige vers /en/dashboard (EN)
 * 5. OTP verification préserve locale
 * 6. Déconnexion → landing (locale préservée)
 */

test.describe('Auth redirects preserve locale', () => {
  test('FR /dashboard → /login (FR)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    expect(page.url()).toMatch(/\/login$/);
    expect(page.url()).not.toMatch(/\/en\//);
    
    // Page login en FR. Locator sur le titre (rôle heading) et non `text=` :
    // le sous-titre contient aussi « connexion », ce qui rend `text=` ambigu.
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Recevoir mon code")')).toBeVisible();
  });

  test('EN /en/dashboard → /en/login (EN)', async ({ page }) => {
    await page.goto('/en/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    expect(page.url()).toMatch(/\/en\/login/);
    
    // Page login en EN. Même precaution qu'en FR : le sous-titre contient
    // « sign-in code », donc on cible le titre via son rôle.
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Get my code")')).toBeVisible();
  });

  test('FR /account → /login (FR)', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');
    
    expect(page.url()).toMatch(/\/login$/);
    expect(page.url()).not.toMatch(/\/en\//);
  });

  test('EN /en/account → /en/login (EN)', async ({ page }) => {
    await page.goto('/en/account');
    await page.waitForLoadState('domcontentloaded');
    
    expect(page.url()).toMatch(/\/en\/login/);
  });

  test('FR /verify-otp accessible directly', async ({ page }) => {
    await page.goto('/verify-otp');
    await page.waitForLoadState('domcontentloaded');
    
    // Page OTP en FR
    await expect(page.locator('text=Saisis ton code')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Valider')).toBeVisible();
  });

  test('EN /en/verify-otp accessible directly', async ({ page }) => {
    await page.goto('/en/verify-otp');
    await page.waitForLoadState('domcontentloaded');
    
    // Page OTP en EN
    await expect(page.locator('text=Enter your code')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Verify')).toBeVisible();
  });

  test('FR /verify-email accessible directly', async ({ page }) => {
    await page.goto('/verify-email');
    await page.waitForLoadState('domcontentloaded');

    // Sans `?token=`, la page bascule immédiatement en état d'erreur explicite.
    await expect(page.locator('text=LIEN INVALIDE')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Lien manquant')).toBeVisible();
  });

  test('EN /en/verify-email accessible directly', async ({ page }) => {
    await page.goto('/en/verify-email');
    await page.waitForLoadState('domcontentloaded');

    // Sans `?token=`, la page bascule immédiatement en état d'erreur explicite.
    await expect(page.locator('text=INVALID LINK')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Missing link')).toBeVisible();
  });

  test('Login form submits email (FR)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    await page.fill('input[type="email"]', 'test-e2e@hashcode.reboot');
    await page.click('button:has-text("Recevoir mon code")');
    
    // Doit afficher état d'envoi ou erreur (code invalide = email envoyé)
    await expect(
      page.locator('text=/Envoi en cours|Code invalide|Trop de demandes/i')
    ).toBeVisible({ timeout: 15000 });
  });

  test('Login form submits email (EN)', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('domcontentloaded');
    
    await page.fill('input[type="email"]', 'test-e2e@hashcode.reboot');
    await page.click('button:has-text("Get my code")');
    
    await expect(
      page.locator('text=/Sending|Invalid or expired code|Too many requests/i')
    ).toBeVisible({ timeout: 15000 });
  });

  test('Already logged in redirect (FR)', async ({ page }) => {
    test.fixme(true, "Auth simulée via 'hashcode:mock' : migrer vers Better Auth (voir FIXME de fichier).");
    // Simuler session existante via localStorage
    await page.addInitScript(() => {
      localStorage.setItem('hashcode:mock:auth', 'true');
      localStorage.setItem('hashcode:mock:user', JSON.stringify({
        email: 'test@hashcode.reboot',
        firstName: 'Test',
        profileStatus: 'APPROVED',
      }));
    });
    
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    // Doit détecter session existante et proposer d'aller à l'espace
    await expect(page.locator('text=/déjà connecté|already signed in/i')).toBeVisible({ timeout: 10000 });
  });

  test('Logout preserves locale (FR)', async ({ page }) => {
    test.fixme(true, "Auth simulée via 'hashcode:mock' : migrer vers Better Auth (voir FIXME de fichier).");
    await page.addInitScript(() => {
      localStorage.setItem('hashcode:mock:auth', 'true');
      localStorage.setItem('hashcode:mock:user', JSON.stringify({
        email: 'test@hashcode.reboot',
        firstName: 'Test',
        profileStatus: 'APPROVED',
      }));
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Cliquer déconnexion
    const logoutBtn = page.locator('button:has-text("Déconnexion"), a:has-text("Déconnexion")').first();
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Doit rediriger vers landing FR
      expect(page.url()).toMatch(/\/$/);
      expect(page.url()).not.toMatch(/\/en\//);
    }
  });

  test('Logout preserves locale (EN)', async ({ page }) => {
    test.fixme(true, "Auth simulée via 'hashcode:mock' : migrer vers Better Auth (voir FIXME de fichier).");
    await page.addInitScript(() => {
      localStorage.setItem('hashcode:mock:auth', 'true');
      localStorage.setItem('hashcode:mock:user', JSON.stringify({
        email: 'test@hashcode.reboot',
        firstName: 'Test',
        profileStatus: 'APPROVED',
      }));
    });
    
    await page.goto('/en/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    const logoutBtn = page.locator('button:has-text("Log out"), a:has-text("Log out")').first();
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Doit rediriger vers landing EN
      expect(page.url()).toMatch(/\/en$/);
    }
  });
});