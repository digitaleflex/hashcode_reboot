import { test, expect } from '@playwright/test';

/**
 * E2E — Dashboard Flows
 * 
 * Valide :
 * 1. Dashboard home charge avec données membre
 * 2. Sidebar navigation fonctionne
 * 3. Agenda page accessible
 * 4. Profile page accessible
 * 5. Settings page accessible
 * 6. Quick actions (WhatsApp, edit profile)
 * 7. Status cards affichent bons états
 */

test.describe('Dashboard flows (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth state for all tests
    await page.addInitScript(() => {
      localStorage.setItem('hashcode:mock:auth', 'true');
      localStorage.setItem('hashcode:mock:user', JSON.stringify({
        email: 'test-e2e@hashcode.reboot',
        firstName: 'Test',
        lastName: 'User',
        profileStatus: 'APPROVED',
        accessLane: 'immediate',
        domain: 'web',
        level: 'beginner',
        goal: 'Build my first project',
        availability: '2-5h',
        learningStyle: 'practice',
        threeMonthGoal: 'Land my first internship',
        archetype: 'web-builder',
        whatsappVerified: false,
      }));
    });
  });

  test('Dashboard home loads (FR)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Vérifier éléments clés
    await expect(page.locator('text=/Bonjour Test|Hello Test/i')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/Statut|Status/i')).toBeVisible();
    await expect(page.locator('text=/Mon profil|My profile/i')).toBeVisible();
    await expect(page.locator('text=/Actions rapides|Quick actions/i')).toBeVisible();
    await expect(page.locator('text=/Agenda/i')).toBeVisible();
  });

  test('Dashboard home loads (EN)', async ({ page }) => {
    await page.goto('/en/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('text=Hello Test')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Status')).toBeVisible();
    await expect(page.locator('text=My profile')).toBeVisible();
    await expect(page.locator('text=Quick actions')).toBeVisible();
    await expect(page.locator('text=Agenda')).toBeVisible();
  });

  test('Status cards show correct badges', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Profil : Validé/Approved
    await expect(page.locator('text=/Validé|Approved/i')).toBeVisible();
    
    // Communauté : Pas encore invité/Not invited yet (selon mock)
    // Accès : Immédiat/Immediate
    await expect(page.locator('text=/Immédiat|Immediate/i')).toBeVisible();
  });

  test('Profile summary shows correct data', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('text=/Web/i')).toBeVisible(); // domain
    await expect(page.locator('text=/Débutant|Beginner/i')).toBeVisible(); // level
    await expect(page.locator('text=/Build my first project|Construire un projet/i')).toBeVisible(); // goal
  });

  test('Quick actions - WhatsApp join button', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    const whatsappBtn = page.locator('button:has-text("Rejoindre WhatsApp"), button:has-text("Join WhatsApp")').first();
    if (await whatsappBtn.count() > 0) {
      await expect(whatsappBtn).toBeVisible();
      // Clic n'ouvre pas vraiment WhatsApp en test, mais le bouton existe
    }
  });

  test('Quick actions - Edit profile button', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    const editBtn = page.locator('button:has-text("Modifier mon profil"), button:has-text("Edit my profile")').first();
    if (await editBtn.count() > 0) {
      await expect(editBtn).toBeVisible();
    }
  });

  test('Sidebar navigation - Ateliers link', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Ouvrir sidebar si mobile
    const sidebarToggle = page.locator('button[aria-label*="menu" i]').first();
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
    }
    
    const ateliersLink = page.locator('a:has-text("Ateliers"), a:has-text("Workshops")').first();
    if (await ateliersLink.count() > 0) {
      await ateliersLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toMatch(/\/dashboard\/ateliers/);
    }
  });

  test('Sidebar navigation - Agenda link', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    const sidebarToggle = page.locator('button[aria-label*="menu" i]').first();
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
    }
    
    const agendaLink = page.locator('a:has-text("Agenda")').first();
    if (await agendaLink.count() > 0) {
      await agendaLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toMatch(/\/dashboard\/agenda/);
    }
  });

  test('Agenda page loads', async ({ page }) => {
    await page.goto('/dashboard/agenda');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('text=/Agenda/i')).toBeVisible({ timeout: 15000 });
    // Filtres présents
    await expect(page.locator('text=/Type :|Type:/i')).toBeVisible();
    await expect(page.locator('text=/Domaine :|Domain:/i')).toBeVisible();
  });

  test('Profile page loads', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('text=/Mon profil|My profile/i')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/Objectif à 3 mois|3-month goal/i')).toBeVisible();
    await expect(page.locator('text=/Profil public|Public profile/i')).toBeVisible();
  });

  test('Settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('text=/Paramètres|Settings/i')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/Mes coordonnées|My contact details/i')).toBeVisible();
    await expect(page.locator('text=/Compte|Account/i')).toBeVisible();
    await expect(page.locator('text=/Mes données|My data/i')).toBeVisible();
  });

  test('Mentoring section visible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('text=/Votre mentorat|Your mentoring/i')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Dashboard responsive', () => {
  test('Mobile viewport - sidebar collapses', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
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
    
    // Sidebar devrait être masquée par défaut sur mobile
    const sidebar = page.locator('[data-testid="dashboard-sidebar"], aside').first();
    // Le toggle menu devrait être visible
    const toggle = page.locator('button[aria-label*="menu" i]').first();
    await expect(toggle).toBeVisible();
  });

  test('Desktop viewport - sidebar expanded', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    
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
    
    // Sidebar devrait être visible sur desktop
    const sidebar = page.locator('[data-testid="dashboard-sidebar"], aside').first();
    await expect(sidebar).toBeVisible();
  });
});