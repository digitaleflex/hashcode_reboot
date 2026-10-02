import fs from 'fs';

const path = 'C:\\Users\\PC\\Documents\\hashcode_reboot\\src\\app\\globals.css';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove duplicate lime utilities (from "/* Lime accent text */" to before "/* Subtle dotted grid background")
const startIdx = content.indexOf('/* Lime accent text */');
const endIdx = content.indexOf('/* Subtle dotted grid background');

if (startIdx >= 0 && endIdx >= 0 && endIdx > startIdx) {
  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx);
  
  const replacement = `/* ============================================================
   HASHCODE utility helpers
   ============================================================ */

 /* NOTE: Lime utilities (text-lime, bg-lime, border-lime, hover variants)
    are now generated automatically by Tailwind 4 via @theme inline (--color-primary).
    The custom classes below were removed to avoid duplication.
    Use: text-primary, bg-primary, border-primary, hover:bg-primary, etc. */
`;
  
  content = before + replacement + after;
  console.log('✅ Lime utilities removed');
} else {
  console.log('❌ Could not find lime utilities boundaries');
  console.log('startIdx:', startIdx, 'endIdx:', endIdx);
}

// 2. Fix prefers-reduced-motion - the aggressive * rule was already fixed by previous script
// Let's verify
const checkIdx = content.indexOf('transition-duration: 0.01ms !important');
if (checkIdx >= 0) {
  console.log('❌ Still has aggressive transition-duration rule');
  // Fix it
  content = content.replace(
    '*, *::before, *::after {\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.01ms !important;\n    scroll-behavior: auto !important;\n  }',
    '/* NE PAS forcer transition-duration: 0.01ms sur * — casse Framer Motion layout animations.\n     Les composants React doivent utiliser useReducedMotion() pour désactiver leurs propres transitions. */'
  );
  console.log('✅ Fixed aggressive transition rule');
} else {
  console.log('✅ Aggressive transition rule already removed');
}

fs.writeFileSync(path, content);
console.log('Done');