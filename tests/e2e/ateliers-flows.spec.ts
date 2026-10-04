/* FIXME: suite obsolète (post-migration Better Auth).
   Ces tests simulaient l'auth via localStorage.setItem('hashcode:mock:auth', …).
   Rien dans src/ ne lit 'hashcode:mock' : l'app utilise Better Auth (cookies de
   session). Les deux describes ci-dessous sont donc marqués `fixme` : ils sont
   signalés (et non comptés comme échecs) jusqu'à réécriture pour une
   authentification réelle via l'UI Better Auth avec un compte de test. */

import { test, expect } from '@playwright/test';

/**
 * E2E — Ateliers (Workshops) Enroll & Quiz
 * 
 * Valide :
 * 1. Liste ateliers accessible
 * 2. Détail atelier affiche semaines/sessions
 * 3. Inscription (enroll) fonctionne
 * 4. Session detail affiche contenu
 * 5. Livrable soumission
 * 6. Quiz questions + soumission
 * 7. États verrouillés respectés
 */

test.describe.fixme('Ateliers flows (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hashcode:mock:auth', 'true');
      localStorage.setItem('hashcode:mock:user', JSON.stringify({
        email: 'test-e2e@hashcode.reboot',
        firstName: 'Test',
        lastName: 'User',
        profileStatus: 'APPROVED',
        accessLane: 'immediate',
        archetype: 'web-builder',
      }));
    });
  });

  test('Ateliers list page loads', async ({ page }) => {
    await page.goto('/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('text=/Ateliers|Workshops/i')).toBeVisible({ timeout: 15000 });
    // Au moins une carte atelier ou état vide
    const atelierCards = page.locator('[data-testid="atelier-card"], article:has-text("Semaine")').first();
    // Soit il y a des ateliers, soit message vide
    const hasContent = await atelierCards.count() > 0;
    const emptyState = page.locator('text=/Aucun atelier|No workshops/i');
    expect(hasContent || await emptyState.count() > 0).toBeTruthy();
  });

  test('Atelier detail page (if exists)', async ({ page }) => {
    await page.goto('/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    // Chercher premier lien atelier
    const firstAtelierLink = page.locator('a[href*="/dashboard/ateliers/"]').first();
    if (await firstAtelierLink.count() > 0) {
      const href = await firstAtelierLink.getAttribute('href');
      await firstAtelierLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Page détail
      expect(page.url()).toMatch(/\/dashboard\/ateliers\/[^/]+$/);
      
      // Éléments attendus
      await expect(page.locator('text=/Mes ateliers|My workshops/i')).toBeVisible(); // back link
      await expect(page.locator('text=/S\'inscrire|Enroll/i')).toBeVisible(); // ou état inscrit
      
      // Semaines/sessions
      const weeks = page.locator('text=/Semaine|Week/i');
      if (await weeks.count() > 0) {
        await expect(weeks.first()).toBeVisible();
      }
    }
  });

  test('Enroll button works (if not enrolled)', async ({ page }) => {
    await page.goto('/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    const enrollBtn = page.locator('button:has-text("S\'inscrire"), button:has-text("Enroll")').first();
    if (await enrollBtn.count() > 0) {
      await enrollBtn.click();
      
      // Attendre état de chargement ou succès
      await expect(
        page.locator('text=/Inscription|Enrolling|Inscrit|Enrolled/i')
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('Session detail page (if enrolled)', async ({ page }) => {
    await page.goto('/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    // Naviguer vers un atelier puis une session
    const atelierLink = page.locator('a[href*="/dashboard/ateliers/"]').first();
    if (await atelierLink.count() > 0) {
      await atelierLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Chercher lien session (première session non verrouillée)
      const sessionLink = page.locator('a[href*="/sessions/"]').first();
      if (await sessionLink.count() > 0) {
        await sessionLink.click();
        await page.waitForLoadState('domcontentloaded');
        
        expect(page.url()).toMatch(/\/sessions\/[^/]+$/);
        
        // Éléments session
        await expect(page.locator('text=/SÉANCE|SESSION/i')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=/Au programme|Program/i')).toBeVisible();
        await expect(page.locator('text=/Activités|Activities/i')).toBeVisible();
      }
    }
  });

  test('Locked session shows lock badge and date', async ({ page }) => {
    await page.goto('/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    const atelierLink = page.locator('a[href*="/dashboard/ateliers/"]').first();
    if (await atelierLink.count() > 0) {
      await atelierLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Chercher badge verrouillé
      const lockedBadge = page.locator('text=/Verrouillée|Locked/i').first();
      if (await lockedBadge.count() > 0) {
        await expect(lockedBadge).toBeVisible();
        // Date de disponibilité
        await expect(page.locator('text=/Disponible le|Available on/i')).toBeVisible();
        // Pas de contenu fuité
        const sessionCard = lockedBadge.locator('..').first();
        const text = await sessionCard.textContent();
        expect(text).not.toMatch(/programme|activités|quiz|objectif/i);
      }
    }
  });

  test('Deliverable submission form (if session has deliverable)', async ({ page }) => {
    await page.goto('/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    const atelierLink = page.locator('a[href*="/dashboard/ateliers/"]').first();
    if (await atelierLink.count() > 0) {
      await atelierLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      const sessionLink = page.locator('a[href*="/sessions/"]').first();
      if (await sessionLink.count() > 0) {
        await sessionLink.click();
        await page.waitForLoadState('domcontentloaded');
        
        // Chercher section livrable
        const deliverableSection = page.locator('text=/Livrable|Deliverable/i').first();
        if (await deliverableSection.count() > 0) {
          // Type de livrable attendu
          await expect(page.locator('text=/TYPE ATTENDU|EXPECTED TYPE/i')).toBeVisible();
          
          // Champ de soumission (URL ou texte)
          const urlInput = page.locator('input[placeholder*="https://"]').first();
          const textArea = page.locator('textarea[placeholder*="livrable"], textarea[placeholder*="deliverable"]').first();
          
          if (await urlInput.count() > 0) {
            await urlInput.fill('https://github.com/test/project');
            await page.click('button:has-text("Soumettre"), button:has-text("Submit")');
            await expect(page.locator('text=/Soumis|Submitted|En attente|Pending/i')).toBeVisible({ timeout: 10000 });
          } else if (await textArea.count() > 0) {
            await textArea.fill('Mon livrable de test pour la session.');
            await page.click('button:has-text("Soumettre"), button:has-text("Submit")');
            await expect(page.locator('text=/Soumis|Submitted|En attente|Pending/i')).toBeVisible({ timeout: 10000 });
          }
        }
      }
    }
  });

  test('Quiz section loads and can submit', async ({ page }) => {
    await page.goto('/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    const atelierLink = page.locator('a[href*="/dashboard/ateliers/"]').first();
    if (await atelierLink.count() > 0) {
      await atelierLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      const sessionLink = page.locator('a[href*="/sessions/"]').first();
      if (await sessionLink.count() > 0) {
        await sessionLink.click();
        await page.waitForLoadState('domcontentloaded');
        
        // Chercher section quiz
        const quizSection = page.locator('text=/Quiz/i').first();
        if (await quizSection.count() > 0) {
          await expect(page.locator('text=/Seuil de réussite|Pass threshold/i')).toBeVisible();
          
          // Questions
          const questions = page.locator('[data-testid="quiz-question"], .quiz-question').first();
          if (await questions.count() > 0) {
            // Répondre à la première question (choix unique)
            const firstOption = page.locator('input[type="radio"]').first();
            if (await firstOption.count() > 0) {
              await firstOption.check();
            }
            
            // Soumettre quiz
            const submitBtn = page.locator('button:has-text("Valider mes réponses"), button:has-text("Submit my answers")').first();
            if (await submitBtn.count() > 0) {
              await submitBtn.click();
              await expect(page.locator('text=/Correction|Grading|Quiz réussi|Quiz passed/i')).toBeVisible({ timeout: 15000 });
            }
          }
        }
      }
    }
  });

  test('Quiz attempt history visible', async ({ page }) => {
    await page.goto('/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    const atelierLink = page.locator('a[href*="/dashboard/ateliers/"]').first();
    if (await atelierLink.count() > 0) {
      await atelierLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      const sessionLink = page.locator('a[href*="/sessions/"]').first();
      if (await sessionLink.count() > 0) {
        await sessionLink.click();
        await page.waitForLoadState('domcontentloaded');
        
        const historySection = page.locator('text=/MES TENTATIVES|MY ATTEMPTS/i').first();
        if (await historySection.count() > 0) {
          await expect(historySection).toBeVisible();
        }
      }
    }
  });

  test('Back navigation works', async ({ page }) => {
    await page.goto('/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    const atelierLink = page.locator('a[href*="/dashboard/ateliers/"]').first();
    if (await atelierLink.count() > 0) {
      await atelierLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Back link
      const backLink = page.locator('a:has-text("Mes ateliers"), a:has-text("My workshops")').first();
      if (await backLink.count() > 0) {
        await backLink.click();
        await page.waitForLoadState('domcontentloaded');
        expect(page.url()).toMatch(/\/dashboard\/ateliers$/);
      }
    }
  });
});

test.describe.fixme('Ateliers EN locale', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hashcode:mock:auth', 'true');
      localStorage.setItem('hashcode:mock:user', JSON.stringify({
        email: 'test-e2e@hashcode.reboot',
        firstName: 'Test',
        profileStatus: 'APPROVED',
        accessLane: 'immediate',
      }));
    });
  });

  test('Ateliers list loads in English', async ({ page }) => {
    await page.goto('/en/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('text=Workshops')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Enroll')).toBeVisible();
  });

  test('Atelier detail in English', async ({ page }) => {
    await page.goto('/en/dashboard/ateliers');
    await page.waitForLoadState('domcontentloaded');
    
    const atelierLink = page.locator('a[href*="/en/dashboard/ateliers/"]').first();
    if (await atelierLink.count() > 0) {
      await atelierLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      await expect(page.locator('text=My workshops')).toBeVisible();
      await expect(page.locator('text=Enroll')).toBeVisible();
      await expect(page.locator('text=Week')).toBeVisible();
    }
  });
});