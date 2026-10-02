import fs from 'fs';

const path = 'C:\\Users\\PC\\Documents\\hashcode_reboot\\src\\app\\globals.css';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove duplicate lime utilities (lines 124-171)
const oldLimeUtils = `/* ============================================================
   HASHCODE utility helpers
   ============================================================ */

 /* Lime accent text */
 .text-lime {
   color: var(--primary);
 }

 /* Lime accent background — needed because Tailwind 4 doesn't auto-generate
    custom-named utilities. bg-primary works (via --color-primary), but we
    use bg-lime throughout the components for readability. */
 .bg-lime {
   background-color: var(--primary);
 }

 /* Lime border */
 .border-lime {
   border-color: var(--primary);
 }

 /* Lime background with opacity (e.g. bg-lime/5) — Tailwind 4 handles the
    /opacity modifier on registered colors, but bg-lime is a custom class.
    We provide common opacity variants here. */
 .bg-lime\\/5 { background-color: oklch(0.92 0.21 125 / 0.05); }
 .bg-lime\\/10 { background-color: oklch(0.92 0.21 125 / 0.10); }
 .bg-lime\\/\\[0\\.04\\] { background-color: oklch(0.92 0.21 125 / 0.04); }
 .bg-lime\\/\\[0\\.06\\] { background-color: oklch(0.92 0.21 125 / 0.06); }

 /* Lime border with opacity */
 .border-lime\\/40 { border-color: oklch(0.92 0.21 125 / 0.40); }
 .border-lime\\/60 { border-color: oklch(0.92 0.21 125 / 0.60); }
 .border-lime\\/50 { border-color: oklch(0.92 0.21 125 / 0.50); }
 .border-lime\\/80 { border-color: oklch(0.92 0.21 125 / 0.80); }

 /* Lime text with opacity */
 .text-lime\\/20 { color: oklch(0.92 0.21 125 / 0.20); }
 .text-lime\\/80 { color: oklch(0.92 0.21 125 / 0.80); }
 .text-lime\\/90 { color: oklch(0.92 0.21 125 / 0.90); }

 /* Lime background hover with opacity */
 .hover\\:bg-lime\\/90:hover { background-color: oklch(0.92 0.21 125 / 0.90); }
 .hover\\:bg-lime:hover { background-color: var(--primary); }
 .hover\\:border-lime\\/60:hover { border-color: oklch(0.92 0.21 125 / 0.60); }
 .hover\\:border-lime\\/50:hover { border-color: oklch(0.92 0.21 125 / 0.50); }
 .hover\\:border-lime\\/40:hover { border-color: oklch(0.92 0.21 125 / 0.40); }
 .hover\\:text-lime:hover { color: var(--primary); }
 .hover\\:text-lime\\/80:hover { color: oklch(0.92 0.21 125 / 0.80); }`;

const newLimeUtils = `/* ============================================================
   HASHCODE utility helpers
   ============================================================ */

 /* NOTE: Lime utilities (text-lime, bg-lime, border-lime, hover variants)
    are now generated automatically by Tailwind 4 via @theme inline (--color-primary).
    The custom classes below were removed to avoid duplication.
    Use: text-primary, bg-primary, border-primary, hover:bg-primary, etc. */`;

if (content.includes(oldLimeUtils)) {
  content = content.replace(oldLimeUtils, newLimeUtils);
  console.log('✅ Lime utilities removed');
} else {
  console.log('❌ Could not find lime utilities block');
  // Debug
  const idx = content.indexOf('/* ============================================================');
  if (idx >= 0) {
    console.log('Found section at:', idx);
    console.log(content.substring(idx, idx + 200));
  }
}

// 2. Fix prefers-reduced-motion - remove the aggressive * rule that breaks framer-motion
const oldReducedMotion = `/* Accessibilité : coupe les animations si l'utilisateur les réduit */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  .carousel-track {
    scroll-behavior: auto !important;
  }
  .animate-hash-in,
  .animate-hash-pulse,
  .animate-hash-roll,
  .animate-bounce-slow,
  .animate-hash-slide-up,
  .animate-hash-draw,
  .animate-hash-sweep::after {
    animation: none !important;
  }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}`;

const newReducedMotion = `/* Accessibilité : coupe les animations CSS si l'utilisateur les réduit.
   Framer Motion gère sa propre réduction via useReducedMotion hook (côté React). */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  .carousel-track {
    scroll-behavior: auto !important;
  }
  .animate-hash-in,
  .animate-hash-pulse,
  .animate-hash-roll,
  .animate-bounce-slow,
  .animate-hash-slide-up,
  .animate-hash-draw,
  .animate-hash-sweep::after {
    animation: none !important;
  }
  /* NE PAS forcer transition-duration: 0.01ms sur * — casse Framer Motion layout animations.
     Les composants React doivent utiliser useReducedMotion() pour désactiver leurs propres transitions. */
}`;

if (content.includes(oldReducedMotion)) {
  content = content.replace(oldReducedMotion, newReducedMotion);
  console.log('✅ prefers-reduced-motion fixed');
} else {
  console.log('❌ Could not find prefers-reduced-motion block');
  const idx = content.indexOf('/* Accessibilité : coupe les animations si l\'utilisateur les réduit */');
  if (idx >= 0) {
    console.log('Found at:', idx);
    console.log(content.substring(idx, idx + 500));
  }
}

fs.writeFileSync(path, content);
console.log('Done');