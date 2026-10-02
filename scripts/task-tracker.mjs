#!/usr/bin/env node
/**
 * Task Tracker — HASHCODE REBOOT
 * Usage:
 *   node scripts/task-tracker.mjs list           # liste toutes les tâches
 *   node scripts/task-tracker.mjs next           # prochaine tâche à faire
 *   node scripts/task-tracker.mjs done T01       # marque T01 comme faite
 *   node scripts/task-tracker.mjs status         # vue d'ensemble
 */

import fs from 'fs';
import path from 'path';

const TRACKER_FILE = path.join(process.cwd(), '.task-progress.json');

const TASKS = [
  // ─────────────────────────────────────────────────────────────
  // RESPONSIVE & NEXT.JS BEST PRACTICES (Audit 2026-10-01)
  // ─────────────────────────────────────────────────────────────

  // P0 — CRITIQUES (Semaine 1)
  { id: 'R01', title: 'Hero — Lime aura/hash transition fluide (hidden sm:block → opacity)', priority: 'P0', deps: [], area: 'landing' },
  { id: 'R02', title: 'MemberTable — Pattern carte mobile / table desktop (colonnes manquantes)', priority: 'P0', deps: [], area: 'admin' },
  { id: 'R03', title: 'Profiling Flow — useReducedMotion hook + framer-motion respectueux', priority: 'P0', deps: [], area: 'profiling' },
  { id: 'R04', title: 'MobileBottomNav + DashboardSidebar — FAB droite + ARIA + pb-[76px] removal', priority: 'P0', deps: [], area: 'mobile' },
  { id: 'R05', title: 'AdminSidebar — Unifier hamburger (header toggle desktop + FAB mobile)', priority: 'P0', deps: [], area: 'admin' },

  // P1 — IMPORTANTS (Semaine 2)
  { id: 'R06', title: 'Globals.css — Cleanup utilitaires lime + prefers-reduced-motion fix', priority: 'P1', deps: [], area: 'css' },
  { id: 'R07', title: 'Forms — autocomplete + spellCheck=false sur email/OTP/country', priority: 'P1', deps: [], area: 'forms' },
  { id: 'R08', title: 'Typography — … au lieu de ... + guillemets courbes', priority: 'P1', deps: [], area: 'content' },
  { id: 'R09', title: 'not-found.tsx — verify-email + profile/[id]', priority: 'P1', deps: [], area: 'fe' },
  { id: 'R10', title: 'Tables admin — Appliquer .scroll-slim sur overflow-x-auto', priority: 'P1', deps: [], area: 'admin' },
  { id: 'R11', title: 'Hero — Padding mobile py-10 sm:py-20 (réduire 168px → 120px)', priority: 'P1', deps: [], area: 'landing' },
  { id: 'R12', title: 'Hero — Steps grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', priority: 'P1', deps: [], area: 'landing' },
  { id: 'R13', title: 'Profiling — aria-live="polite" sur indicateur progression', priority: 'P1', deps: [], area: 'profiling' },

  // P2 — MOYENS (Semaine 3)
  { id: 'R14', title: 'Touch — touch-action: manipulation global', priority: 'P2', deps: [], area: 'mobile' },
  { id: 'R15', title: 'Hover states — Boutons ghost/outline feedback visible', priority: 'P2', deps: [], area: 'components' },
  { id: 'R16', title: 'Hydration — Retirer suppressHydrationWarning + corriger causes', priority: 'P2', deps: [], area: 'nextjs' },
  { id: 'R17', title: 'Logo SVG — width/height explicites (éviter CLS)', priority: 'P2', deps: [], area: 'performance' },

  // P3 — FAIBLES / MODERNISATION (Semaine 4+)
  { id: 'R18', title: 'Server Actions — Migrer mutations API (members, auth, admin)', priority: 'P3', deps: [], area: 'nextjs' },
  { id: 'R19', title: 'Partial Prerendering — Évaluer sur /, /login, pages légales', priority: 'P3', deps: [], area: 'nextjs' },
  { id: 'R20', title: 'Turbopack — Activation build', priority: 'P3', deps: [], area: 'nextjs' },

  // ─────────────────────────────────────────────────────────────
  // FONCTIONNEL (Roadmap originale)
  // ─────────────────────────────────────────────────────────────

  // P0
  { id: 'T01', title: 'POST /api/account/complete-profile', priority: 'P0', deps: [], area: 'api' },
  { id: 'T02', title: '/dashboard/mentoring (page membre)', priority: 'P0', deps: [], area: 'fe' },

  // P1
  { id: 'T03', title: '/dashboard/ateliers/[slug] (détail atelier)', priority: 'P1', deps: [], area: 'fe' },
  { id: 'T04', title: '/dashboard/ateliers/[slug]/sessions/[id] (détail séance)', priority: 'P1', deps: ['T03'], area: 'fe' },
  { id: 'T05', title: '/dashboard/ateliers/[slug]/sessions/[id]/quiz (passage quiz)', priority: 'P1', deps: ['T04'], area: 'fe' },
  { id: 'T06', title: '/verify-email/not-found.tsx (fallback SSR)', priority: 'P1', deps: [], area: 'fe' },
  { id: 'T07', title: 'Seed ateliers complet (structure démo)', priority: 'P1', deps: [], area: 'script' },

  // P2 i18n
  { id: 'T08', title: 'Config next-intl + routage [locale]', priority: 'P2', deps: [], area: 'config' },
  { id: 'T09', title: 'Messages fr.json + en.json (extraction)', priority: 'P2', deps: ['T08'], area: 'i18n' },
  { id: 'T10', title: 'Migration composants → useTranslations()', priority: 'P2', deps: ['T09'], area: 'fe' },

  // P2 docs
  { id: 'T11', title: 'docs/espace-membre.md', priority: 'P2', deps: [], area: 'docs' },
  { id: 'T12', title: 'docs/interface-utilisateur.md', priority: 'P2', deps: [], area: 'docs' },
  { id: 'T13', title: 'docs/ateliers/ (déplacement doc existante)', priority: 'P2', deps: [], area: 'docs' },

  // P3 e2e
  { id: 'T14', title: 'Scénarios E2E critiques (5 specs)', priority: 'P3', deps: [], area: 'test' },
  { id: 'T15', title: 'CI GitHub Actions Playwright', priority: 'P3', deps: ['T14'], area: 'ci' },

  // P4 legal
  { id: 'T16', title: 'Pages légales (mentions, CGU, confidentialité)', priority: 'P4', deps: [], area: 'fe' },

  // P5 auth refactor
  { id: 'T17', title: 'Migration admin auth → Better Auth', priority: 'P5', deps: ['T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11','T12','T13','T14','T15','T16','R01','R02','R03','R04','R05','R06','R07','R08','R09','R10','R11','R12','R13','R14','R15','R16','R17','R18','R19','R20'], area: 'refactor' },
];

function loadProgress() {
  if (fs.existsSync(TRACKER_FILE)) {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
  }
  return {};
}

function saveProgress(progress) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(progress, null, 2));
}

function listTasks() {
  const progress = loadProgress();
  console.log('\n📋 TÂCHES HASHCODE REBOOT\n');
  console.log('ID   │ PRIO │ AREA     │ STATUS │ TITLE');
  console.log('─────┼──────┼──────────┼────────┼────────────────────────────────────────');
  for (const t of TASKS) {
    const done = progress[t.id]?.done ? '✅' : '⬜';
    const blocked = t.deps.some(d => !progress[d]?.done) ? '🔒' : '';
    console.log(`${t.id.padEnd(4)} │ ${t.priority.padEnd(4)} │ ${t.area.padEnd(8)} │ ${done} ${blocked} │ ${t.title}`);
  }
  console.log('');
}

function nextTask() {
  const progress = loadProgress();
  for (const t of TASKS) {
    if (progress[t.id]?.done) continue;
    const blocked = t.deps.some(d => !progress[d]?.done);
    if (!blocked) {
      console.log(`\n🎯 PROCHAINE : ${t.id} — ${t.title} (${t.priority})`);
      console.log(`   Dépendances : ${t.deps.length ? t.deps.join(', ') : 'aucune'}`);
      return;
    }
  }
  console.log('\n🎉 Toutes les tâches sont terminées ou bloquées !');
}

function markDone(id) {
  const progress = loadProgress();
  const task = TASKS.find(t => t.id === id);
  if (!task) {
    console.error(`❌ Tâche ${id} introuvable`);
    process.exit(1);
  }
  const blocked = task.deps.some(d => !progress[d]?.done);
  if (blocked) {
    console.warn(`⚠️  ${id} a des dépendances non résolues : ${task.deps.filter(d => !progress[d]?.done).join(', ')}`);
  }
  progress[id] = { done: true, date: new Date().toISOString() };
  saveProgress(progress);
  console.log(`✅ ${id} marquée comme terminée`);
}

function status() {
  const progress = loadProgress();
  const total = TASKS.length;
  const done = Object.values(progress).filter(p => p.done).length;
  const byPrio = {};
  for (const t of TASKS) {
    if (!byPrio[t.priority]) byPrio[t.priority] = { total: 0, done: 0 };
    byPrio[t.priority].total++;
    if (progress[t.id]?.done) byPrio[t.priority].done++;
  }
  console.log(`\n📊 PROGRESSION GLOBALE : ${done}/${total} (${Math.round(done/total*100)}%)\n`);
  for (const [prio, stats] of Object.entries(byPrio).sort()) {
    const pct = Math.round(stats.done/stats.total*100);
    const bar = '█'.repeat(Math.round(pct/5)) + '░'.repeat(20-Math.round(pct/5));
    console.log(`${prio} : ${stats.done}/${stats.total} [${bar}] ${pct}%`);
  }
  console.log('');
}

// CLI
const cmd = process.argv[2];
switch (cmd) {
  case 'list': listTasks(); break;
  case 'next': nextTask(); break;
  case 'done': markDone(process.argv[3]); break;
  case 'status': status(); break;
  default:
    console.log(`
Usage: node scripts/task-tracker.mjs <command>

Commands:
  list     - Liste toutes les tâches avec statut
  next     - Affiche la prochaine tâche faisable
  done T01 - Marque T01 comme terminée
  status   - Vue d'ensemble par priorité
`);
}