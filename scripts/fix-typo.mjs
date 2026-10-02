import fs from 'fs';
import path from 'path';

const projectRoot = 'C:\\Users\\PC\\Documents\\hashcode_reboot';

function fixTypographyInFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) return 0;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let changes = 0;
  let newContent = content;

  // Replace ... with … (in JSX text content)
  // Pattern: "text..." -> "text…"  or  'text...' -> 'text…'
  // We'll use a more precise approach: find text between > and < in JSX
  const jsxContentRegex = />([^<]*?)\.\.\.([^<]*?)</g;
  let match;
  let offset = 0;
  
  while ((match = jsxContentRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const fixed = fullMatch.replace(/\.\.\./g, '…');
    if (fullMatch !== fixed) {
      const idx = match.index + offset;
      newContent = newContent.slice(0, idx) + fixed + newContent.slice(idx + fullMatch.length);
      offset += fixed.length - fullMatch.length;
      changes++;
    }
  }

  // Also handle standalone ... in JSX expressions
  const jsxExprRegex = /\{([^}]*?)\.\.\.([^}]*?)\}/g;
  while ((match = jsxExprRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const fixed = fullMatch.replace(/\.\.\./g, '…');
    if (fullMatch !== fixed) {
      const idx = match.index + offset;
      newContent = newContent.slice(0, idx) + fixed + newContent.slice(idx + fullMatch.length);
      offset += fixed.length - fullMatch.length;
      changes++;
    }
  }

  if (newContent !== content) {
    fs.writeFileSync(fullPath, newContent);
  }
  
  return changes;
}

// Files to check for typography issues
const files = [
  'src/components/reboot/landing/hero.tsx',
  'src/components/reboot/landing/axes.tsx',
  'src/components/reboot/landing/pillars.tsx',
  'src/components/reboot/landing/audience.tsx',
  'src/components/reboot/landing/coming.tsx',
  'src/components/reboot/landing/faq-section.tsx',
  'src/components/reboot/landing/final-cta.tsx',
  'src/components/reboot/landing/site-footer.tsx',
  'src/components/reboot/landing/site-header.tsx',
  'src/components/reboot/landing/sticky-cta.tsx',
  'src/components/reboot/landing/testimonial.tsx',
  'src/components/reboot/profiling/questions.ts',
  'src/components/reboot/profiling/views.tsx',
  'src/components/reboot/profiling/question-view.tsx',
  'src/components/reboot/profiling/resume-prompt.tsx',
  'src/components/reboot/profiling/shell.tsx',
  'src/components/reboot/profiling/preview.tsx',
  'src/app/login/page.tsx',
  'src/app/verify-otp/page.tsx',
  'src/app/verify-email/page.tsx',
  'src/app/dashboard/page.tsx',
  'src/app/dashboard/profile/page.tsx',
  'src/app/dashboard/settings/page.tsx',
  'src/app/dashboard/agenda/page.tsx',
  'src/app/dashboard/ateliers/page.tsx',
  'src/app/profile/[id]/page.tsx',
  'src/app/admin/dashboard/page.tsx',
  'src/app/admin/ateliers/page.tsx',
  'src/app/admin/ateliers/submissions/page.tsx',
  'src/app/admin/members/page.tsx',
];

console.log('Checking files for ... and straight quotes...');

let totalChanges = 0;
for (const file of files) {
  const changes = fixTypographyInFile(file);
  if (changes > 0) {
    console.log(`  ${file}: ${changes} changes`);
    totalChanges += changes;
  }
}

console.log(`\nTotal changes: ${totalChanges}`);