import { test as base, type Page } from '@playwright/test';

/**
 * Test fixtures pour éviter la duplication
 */

// Utilisateur de test (email magic link simulé)
export const TEST_USER = {
  email: 'test-e2e@hashcode.reboot',
  firstName: 'Test',
  lastName: 'User',
};

// Locales supportées
export const LOCALES = ['fr', 'en'] as const;
export type Locale = typeof LOCALES[number];

// URLs de base par locale
export function getUrl(path: string, locale: Locale = 'fr'): string {
  if (locale === 'fr') return path;
  return `/${locale}${path}`;
}

// Helpers d'authentification
export async function loginViaMagicLink(page: Page, email: string, locale: Locale = 'fr') {
  await page.goto(getUrl('/login', locale));
  await page.fill('input[type="email"]', email);
  await page.click('button:has-text("Recevoir mon code"), button:has-text("Get my code")');
  
  // En E2E, on simule la réception du code via l'API de test
  // Pour l'instant, on attend l'erreur "code invalide" pour confirmer l'envoi
  await page.waitForSelector('text=/Code invalide|Invalid or expired code/i', { timeout: 10000 }).catch(() => {});
}

// Helper `mockAuthState` supprimé : il injectait 'hashcode:mock:auth' dans
// localStorage, mécanisme que plus rien dans src/ ne lit (Better Auth utilise
// un cookie de session). Il aurait donné une fausse impression de contournement
// de l'authentification — voir les `test.fixme` des specs concernées.
// Helpers pour attendre le chargement
export async function waitForDashboard(page: Page) {
  await page.waitForSelector('text=/Bonjour|Hello/i', { timeout: 15000 });
}

export async function waitForAteliersPage(page: Page) {
  await page.waitForSelector('text=/Ateliers|Workshops/i', { timeout: 15000 });
}

// Selectors communs
export const SELECTORS = {
  // Landing
  heroCta: 'a:has-text("Construire mon profil"), a:has-text("Build my profile")',
  // Auth
  emailInput: 'input[type="email"]',
  submitButton: 'button[type="submit"]',
  otpInputs: 'input[inputmode="numeric"][maxlength="1"]',
  // Dashboard
  sidebarToggle: 'button[aria-label*="menu"], button[aria-label*="Menu"]',
  ateliersLink: 'a:has-text("Ateliers"), a:has-text("Workshops")',
  agendaLink: 'a:has-text("Agenda")',
  profileLink: 'a:has-text("Mon profil"), a:has-text("My profile")',
  settingsLink: 'a:has-text("Paramètres"), a:has-text("Settings")',
  logoutButton: 'button:has-text("Déconnexion"), button:has-text("Log out")',
  // Ateliers
  atelierCard: '[data-testid="atelier-card"]',
  enrollButton: 'button:has-text("S\'inscrire"), button:has-text("Enroll")',
  sessionLink: 'a[href*="/sessions/"]',
  // Quiz
  quizQuestion: '[data-testid="quiz-question"]',
  quizSubmit: 'button:has-text("Valider mes réponses"), button:has-text("Submit my answers")',
  // Admin
  adminLink: 'a:has-text("Admin")',
};

export type TestFixtures = {
  page: Page;
  locale: Locale;
};

export const test = base.extend<TestFixtures>({
  locale: 'fr' as Locale,
});

export { expect } from '@playwright/test';