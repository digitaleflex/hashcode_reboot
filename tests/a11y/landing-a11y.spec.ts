import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe.configure({ retries: 0 });

test('Landing page accessibility', async ({ page }) => {
  test.setTimeout(120000);
  
  await page.goto('/fr', { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2aa', 'wcag21aa', 'best-practice'])
    .analyze();

  if (accessibilityScanResults.violations.length > 0) {
    console.log('\n=== VIOLATIONS: Landing page ===');
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

  const criticalViolations = accessibilityScanResults.violations.filter(v => v.impact === 'critical');
  const seriousViolations = accessibilityScanResults.violations.filter(v => v.impact === 'serious');
  
  console.log(`\nSummary: ${criticalViolations.length} critical, ${seriousViolations.length} serious, ${accessibilityScanResults.violations.length} total`);
  
  expect(criticalViolations.length).toBe(0);
  expect(seriousViolations.length).toBeLessThanOrEqual(5);
});