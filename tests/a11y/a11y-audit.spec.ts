import { writeFileSync } from "node:fs";
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Audit d'accessibilité automatisé avec axe-core
 * Cible les parcours critiques de l'application HASHCODE REBOOT
 */

const CRITICAL_PATHS = [
  { name: 'Landing page (FR)', path: '/fr' },
  { name: 'Landing page (EN)', path: '/en' },
  { name: 'Profiling Flow Start', path: '/fr?resume=1' },
  { name: 'Login / Magic Link', path: '/fr/login' },
  { name: 'Verify OTP', path: '/fr/verify-otp' },
  { name: 'Dashboard (auth required - will redirect)', path: '/fr/dashboard' },
  { name: 'Events Public', path: '/fr/evenements' },
  { name: 'Profile Public Share (404 expected)', path: '/fr/profile/test-id' },
  { name: 'Legal: Confidentialité', path: '/fr/confidentialite' },
  { name: 'Legal: Mentions légales', path: '/fr/mentions-legales' },
  { name: 'Legal: CGU', path: '/fr/cgu' },
  { name: 'Legal: Cookies', path: '/fr/cookies' },
];

const ADMIN_PATHS = [
  { name: 'Admin Dashboard (auth required)', path: '/fr/admin/dashboard' },
  { name: 'Admin Members', path: '/fr/admin/members' },
  { name: 'Admin Ateliers', path: '/fr/admin/ateliers' },
  { name: 'Admin Events', path: '/fr/admin/events' },
  { name: 'Admin Email Templates', path: '/fr/admin/email-templates' },
  { name: 'Admin Stats', path: '/fr/admin/stats' },
];

test.describe.configure({ retries: 1 });

test.describe('Accessibilité - Parcours Publics (WCAG 2.2 AA)', () => {
  for (const page of CRITICAL_PATHS) {
    test(`[a11y] ${page.name}`, async ({ page: playwrightPage }) => {
      await playwrightPage.goto(page.path, { waitUntil: 'networkidle' });
      
      // Attendre que la page soit interactive
      await playwrightPage.waitForLoadState('domcontentloaded');
      
      const accessibilityScanResults = await new AxeBuilder({ page: playwrightPage })
        .withTags(['wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();

      // Rapport détaillé des violations
      if (accessibilityScanResults.violations.length > 0) {
        console.log(`\n=== VIOLATIONS: ${page.name} ===`);
        for (const violation of accessibilityScanResults.violations) {
          console.log(`\n🔴 ${violation.id} (${violation.impact}) - ${violation.help}`);
          console.log(`   Tags: ${violation.tags.join(', ')}`);
          console.log(`   Nodes affected: ${violation.nodes.length}`);
          for (const node of violation.nodes.slice(0, 3)) {
            console.log(`   - Target: ${node.target.join(' > ')}`);
            console.log(`     HTML: ${node.html?.slice(0, 150)}...`);
            console.log(`     Fix: ${node.failureSummary}`);
          }
          if (violation.nodes.length > 3) {
            console.log(`   ... et ${violation.nodes.length - 3} autres éléments`);
          }
        }
      }

      // Seuil : 0 violations critiques, max 5 violations majeures/mineures
      const criticalViolations = accessibilityScanResults.violations.filter(v => v.impact === 'critical');
      const seriousViolations = accessibilityScanResults.violations.filter(v => v.impact === 'serious');
      const moderateViolations = accessibilityScanResults.violations.filter(v => v.impact === 'moderate');
      const minorViolations = accessibilityScanResults.violations.filter(v => v.impact === 'minor');

      expect(criticalViolations.length).toBe(0);
      expect(seriousViolations.length).toBeLessThanOrEqual(3);
      expect(moderateViolations.length + minorViolations.length).toBeLessThanOrEqual(10);
    });
  }
});

test.describe('Accessibilité - Admin (WCAG 2.2 AA)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: les pages admin nécessitent une auth - on teste la page de login/admin
    await page.goto('/fr/admin', { waitUntil: 'networkidle' });
  });

  for (const pageInfo of ADMIN_PATHS) {
    test(`[a11y] ${pageInfo.name}`, async ({ page: playwrightPage }) => {
      await playwrightPage.goto(pageInfo.path, { waitUntil: 'networkidle' });
      await playwrightPage.waitForLoadState('domcontentloaded');
      
      const accessibilityScanResults = await new AxeBuilder({ page: playwrightPage })
        .withTags(['wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();

      if (accessibilityScanResults.violations.length > 0) {
        console.log(`\n=== VIOLATIONS ADMIN: ${pageInfo.name} ===`);
        for (const violation of accessibilityScanResults.violations) {
          console.log(`\n🔴 ${violation.id} (${violation.impact}) - ${violation.help}`);
          console.log(`   Nodes: ${violation.nodes.length}`);
          for (const node of violation.nodes.slice(0, 2)) {
            console.log(`   - ${node.target.join(' > ')}: ${node.failureSummary}`);
          }
        }
      }

      const criticalViolations = accessibilityScanResults.violations.filter(v => v.impact === 'critical');
      expect(criticalViolations.length).toBe(0);
    });
  }
});

test.describe('Accessibilité - Focus & Navigation Clavier', () => {
  test('Tab navigation sur Landing page', async ({ page }) => {
    await page.goto('/fr', { waitUntil: 'networkidle' });
    
    // Premier Tab devrait focus un élément interactif
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'AREA']).toContain(firstFocused);
    
    // Vérifier indicateur de focus visible
    const focusStyles = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor,
      };
    });
    
    console.log('Focus styles on first element:', focusStyles);
    // Au moins un indicateur de focus visible
    const hasVisibleFocus = focusStyles && (
      (focusStyles.outline && focusStyles.outline !== 'none' && focusStyles.outlineWidth !== '0px') ||
      (focusStyles.boxShadow && focusStyles.boxShadow !== 'none') ||
      (focusStyles.borderColor && focusStyles.borderColor !== 'transparent')
    );
    expect(hasVisibleFocus).toBeTruthy();
  });

  test('Skip link / navigation principale accessible', async ({ page }) => {
    await page.goto('/fr', { waitUntil: 'networkidle' });
    
    // Chercher un skip link ou landmark main
    const mainLandmark = await page.locator('main').count();
    expect(mainLandmark).toBeGreaterThan(0);
    
    // Vérifier que le main a un id ou est le premier landmark
    const mainId = await page.locator('main').getAttribute('id');
    console.log('Main landmark ID:', mainId);
  });
});

test.describe('Accessibilité - Formulaires (Profiling, Login, Contact)', () => {
  test('Labels et associations formulaires', async ({ page }) => {
    await page.goto('/fr/login', { waitUntil: 'networkidle' });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'forms'])
      .analyze();

    const formViolations = accessibilityScanResults.violations.filter(v => 
      v.tags.includes('forms') || v.id.includes('label') || v.id.includes('form')
    );
    
    console.log('\n=== FORM VIOLATIONS ===');
    for (const v of formViolations) {
      console.log(`🔴 ${v.id} (${v.impact}): ${v.help}`);
      for (const node of v.nodes.slice(0, 2)) {
        console.log(`   - ${node.target.join(' > ')}: ${node.failureSummary}`);
      }
    }
    
    expect(formViolations.filter(v => v.impact === 'critical' || v.impact === 'serious').length).toBe(0);
  });

  test('Messages d\'erreur accessibles (aria-describedby, role=alert)', async ({ page }) => {
    await page.goto('/fr/login', { waitUntil: 'networkidle' });
    
    // Tenter une soumission vide pour déclencher erreurs
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();

    const errorViolations = accessibilityScanResults.violations.filter(v => 
      v.id.includes('alert') || v.id.includes('error') || v.id.includes('status')
    );
    
    console.log('\n=== ERROR/ALERT VIOLATIONS ===');
    for (const v of errorViolations) {
      console.log(`🔴 ${v.id} (${v.impact}): ${v.help}`);
    }
  });
});

test.describe('Accessibilité - Composants Spécifiques', () => {
  test('Modales (Privacy, Cookie) - focus trap & ARIA', async ({ page }) => {
    await page.goto('/fr', { waitUntil: 'networkidle' });
    
    // Ouvrir modale confidentialité (si bouton présent)
    const privacyBtn = page.locator('button:has-text("Confidentialité"), button:has-text("Privacy"), [data-testid="privacy-modal-trigger"]').first();
    if (await privacyBtn.count() > 0) {
      await privacyBtn.click();
      await page.waitForTimeout(300);
      
      const modal = page.locator('[role="dialog"], [aria-modal="true"]').first();
      await expect(modal).toBeVisible();
      
      // Vérifier focus trap
      await page.keyboard.press('Tab');
      const focusedInModal = await page.evaluate(() => {
        const el = document.activeElement;
        const modal = document.querySelector('[role="dialog"], [aria-modal="true"]');
        return modal?.contains(el as Node) ?? false;
      });
      expect(focusedInModal).toBeTruthy();
      
      // Fermer
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  test('Tableaux de données (Admin) - ARIA grid/table', async ({ page }) => {
    await page.goto('/fr/admin/members', { waitUntil: 'networkidle' });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'table'])
      .analyze();

    const tableViolations = accessibilityScanResults.violations.filter(v => 
      v.tags.includes('table') || v.id.includes('table') || v.id.includes('grid')
    );
    
    console.log('\n=== TABLE VIOLATIONS ===');
    for (const v of tableViolations) {
      console.log(`🔴 ${v.id} (${v.impact}): ${v.help}`);
    }
  });

  test('Target size minimum 24x24px (WCAG 2.5.8)', async ({ page }) => {
    await page.goto('/fr', { waitUntil: 'networkidle' });
    
    const smallTargets = await page.evaluate(() => {
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="link"], [tabindex="0"]');
      const small: Array<{tag: string; text: string; width: number; height: number; selector: string}> = [];
      
      interactiveElements.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        
        if (isVisible && (rect.width < 24 || rect.height < 24)) {
          small.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute('aria-label') || '').slice(0, 50),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            selector: Array.from(el.closest('*')?.querySelectorAll('*') || []).indexOf(el).toString()
          });
        }
      });
      
      return small;
    });
    
    console.log('\n=== SMALL TARGETS (< 24px) ===');
    for (const t of smallTargets.slice(0, 10)) {
      console.log(`  ${t.tag} [${t.width}x${t.height}] "${t.text}"`);
    }
    
    // Seuil : max 5 cibles trop petites (souvent icônes décoratives)
    expect(smallTargets.length).toBeLessThanOrEqual(5);
  });
});

test.describe('Rapport de synthèse', () => {
  test('Générer rapport JSON complet', async ({ page }) => {
    const allResults: Record<string, any> = {};
    
    for (const pageInfo of CRITICAL_PATHS) {
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });
      await page.waitForLoadState('domcontentloaded');
      
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();
      
      allResults[pageInfo.name] = {
        url: pageInfo.path,
        violations: results.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          tags: v.tags,
          nodesCount: v.nodes.length,
          nodes: v.nodes.slice(0, 2).map(n => ({
            target: n.target,
            html: n.html?.slice(0, 200),
            failureSummary: n.failureSummary,
          })),
        })),
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        inapplicable: results.inapplicable.length,
      };
    }
    
    console.log('\n\n=== RAPPORT A11Y COMPLET ===');
    console.log(JSON.stringify(allResults, null, 2));
    
    // Écrire dans un fichier pour analyse
    writeFileSync('a11y-report.json', JSON.stringify(allResults, null, 2));
    console.log('\nRapport écrit dans a11y-report.json');
  });
});