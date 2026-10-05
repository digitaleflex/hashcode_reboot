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
  // AUDIT SUR-INGÉNIERIE 2026-10-05
  // Détail + raisons : docs/ROADMAP-SUR-INGENIERIE-2026.md
  // Protocole      : docs/REGLE-EXECUTION.md
  // ─────────────────────────────────────────────────────────────

  // PHASE 0 — Bugs réels (sécurité + données fausses)
  { id: 'D01', title: 'disableSignUp — bloque la préemption d\'identité admin', priority: 'P0', deps: [], area: 'securite' },
  { id: 'D02', title: 'Valider (ou retirer) le token sur invite/accept et invite/refuse', priority: 'P0', deps: [], area: 'securite' },
  { id: 'D03', title: 'categorizeEmail — le tunnel de relance est vide (chiffres faux)', priority: 'P0', deps: [], area: 'email' },
  { id: 'D04', title: 'Webhook Resend — memberId manquant sur les 4 emailEvent.create', priority: 'P0', deps: [], area: 'email' },
  { id: 'D05', title: 'Turnstile fail-closed sur /api/admin/login', priority: 'P1', deps: [], area: 'securite' },
  { id: 'D06', title: 'Aligner la durée OTP : 300 s réel vs 15 min annoncées', priority: 'P1', deps: [], area: 'auth' },
  { id: 'D07', title: 'Migrations CREATE TABLE manquantes pour les tables Better Auth', priority: 'P1', deps: [], area: 'db' },
  { id: 'D08', title: 'ADMIN_EMAIL || EMAIL_FROM — Display Name utilisé comme adresse', priority: 'P1', deps: [], area: 'email' },

  // PHASE 1 — Suppressions sèches (risque nul)
  { id: 'D09', title: 'Supprimer 35 composants ui/ morts + use-mobile (~4 340 l.)', priority: 'P0', deps: [], area: 'cleanup' },
  { id: 'D10', title: 'Supprimer ~30 dépendances mortes (~60 Mo de bundle)', priority: 'P0', deps: ['D09'], area: 'deps' },
  { id: 'D11', title: 'Supprimer lib/prisma-extensions.ts (235 l., 0 consommateur)', priority: 'P0', deps: [], area: 'cleanup' },
  { id: 'D12', title: 'Supprimer hooks useStats/useActivity + résidu useMembers', priority: 'P0', deps: [], area: 'cleanup' },
  { id: 'D13', title: 'Supprimer 5 routes API mortes + manifeste ROUTES de health.ts', priority: 'P0', deps: [], area: 'cleanup' },
  { id: 'D14', title: 'Supprimer 9 validateurs Ateliers morts (445 l., CRUD renoncé)', priority: 'P0', deps: [], area: 'ateliers' },
  { id: 'D15', title: 'Supprimer 16 scripts orphelins + résidus racine + bun.lock', priority: 'P1', deps: [], area: 'cleanup' },
  { id: 'D16', title: 'Nettoyer squelettes dupliqués, props mortes, revalidate=0', priority: 'P1', deps: [], area: 'admin' },
  { id: 'D17', title: 'Supprimer ~34 exports morts (errors, labels, analytics, matching)', priority: 'P2', deps: [], area: 'cleanup' },

  // PHASE 2 — Fiabiliser les tests
  { id: 'D18', title: 'Basculer les tests sur tsx — supprimer 741 lignes de miroirs', priority: 'P0', deps: ['D14'], area: 'test' },
  { id: 'D19', title: 'Réécrire magic-link.test.cjs (teste account-otp.ts, supprimé)', priority: 'P0', deps: ['D18'], area: 'test' },
  { id: 'D20', title: 'Réactiver ou supprimer les 3 suites E2E fixme (sélecteurs périmés)', priority: 'P2', deps: ['D18'], area: 'test' },

  // PHASE 3 — Purge i18n + documentation
  { id: 'D21', title: 'Trancher legal.* — brancher les 4 pages légales ou supprimer', priority: 'P1', deps: [], area: 'i18n' },
  { id: 'D22', title: 'Purger ~2 400 clés i18n mortes par locale (~4 800 l.)', priority: 'P2', deps: ['D21'], area: 'i18n' },
  { id: 'D23', title: 'Corriger README, CONTRIBUTING et docs obsolètes (16 erreurs)', priority: 'P1', deps: ['D02'], area: 'docs' },

  // PHASE 4 — Cohérence serveur
  { id: 'D24', title: 'requireAdmin() unifié — corrige le 401-vs-403 selon la route', priority: 'P0', deps: [], area: 'api' },
  { id: 'D25', title: 'adminQuery() — factoriser les blocs 401/429 (29 + 16 occurrences)', priority: 'P1', deps: ['D24'], area: 'admin' },
  { id: 'D26', title: 'Migrer les 33 routes restantes vers errors.ts', priority: 'P2', deps: ['D24'], area: 'api' },
  { id: 'D27', title: 'SECTION_MAP incomplet — menu faux sur 4 pages admin', priority: 'P0', deps: [], area: 'admin' },
  { id: 'D28', title: 'Supprimer la double résolution de session admin (2x getSession)', priority: 'P1', deps: ['D24'], area: 'api' },

  // PHASE 5 — Composition admin (arrêter de copier)
  { id: 'D29', title: 'Faire composer admin/dashboard par les 6 endpoints existants', priority: 'P1', deps: ['D03', 'D04'], area: 'api' },
  { id: 'D30', title: 'Extraire 5 primitives UI partagées (StatusBadge x6, RateBar x3...)', priority: 'P2', deps: ['D09'], area: 'admin' },
  { id: 'D31', title: 'Extraire les helpers dupliqués (formatDate x7, queryError x3)', priority: 'P2', deps: ['D09'], area: 'admin' },
  { id: 'D32', title: 'Migrer 17 composants manuels vers useQuery (AbortController x11)', priority: 'P2', deps: ['D25'], area: 'admin' },

  // PHASE 6 — Décisions produit (arbitrage requis)
  { id: 'D33', title: 'Trancher ?admin=1 — supprimer admin-login.tsx (401 l.) ou /admin', priority: 'P1', deps: ['D27'], area: 'auth' },
  { id: 'D34', title: 'Trancher le magic-link onboarding (570 l. pour un flag jamais lu)', priority: 'P1', deps: ['D02'], area: 'auth' },
  { id: 'D35', title: 'Réaligner SessionReminder (12 h vs 30 j) ou supprimer 355 l.', priority: 'P1', deps: [], area: 'admin' },
  { id: 'D36', title: 'Supprimer MemberSession/AdminKey/RateLimit + colonnes mortes', priority: 'P2', deps: ['D07'], area: 'db' },
  { id: 'D37', title: 'Trancher le ticket phone-fill (132 l. câblées mais inopérantes)', priority: 'P2', deps: [], area: 'auth' },
  { id: 'D38', title: 'Réactiver des règles ESLint désactivées (no-undef, exhaustive-deps)', priority: 'P2', deps: ['D18'], area: 'config' },

  // ─────────────────────────────────────────────────────────────
  // CORRECTIFS D'OPPORTUNE (trouvés pendant l'exécution)
  // ─────────────────────────────────────────────────────────────

  { id: 'D39', title: 'Domaine dupliqué : 13 URLs en joinhashcode.com au lieu de reboot.', priority: 'P0', deps: [], area: 'email' },

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

function resetTask(id) {
  const progress = loadProgress();
  if (!progress[id]) {
    console.error(`❌ Tâche ${id} non marquée — rien à annuler`);
    process.exit(1);
  }
  delete progress[id];
  saveProgress(progress);
  console.log(`↩️  ${id} remise à zéro`);
}

// CLI
const cmd = process.argv[2];
switch (cmd) {
  case 'list': listTasks(); break;
  case 'next': nextTask(); break;
  case 'done': markDone(process.argv[3]); break;
  case 'reset': resetTask(process.argv[3]); break;
  case 'status': status(); break;
  default:
    console.log(`
Usage: node scripts/task-tracker.mjs <command>

Commands:
  list       - Liste toutes les tâches avec statut
  next       - Affiche la prochaine tâche faisable
  done D01   - Marque D01 comme terminée
  reset D01  - Annule le marquage de D01
  status     - Vue d'ensemble par priorité

Roadmap sur-ingénierie : docs/ROADMAP-SUR-INGENIERIE-2026.md
Protocole d'exécution : docs/REGLE-EXECUTION.md
`);
}