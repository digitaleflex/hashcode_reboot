# 🗺️ Roadmap Responsive & Next.js — HASHCODE REBOOT

> **Source unique de vérité** pour le suivi.  
> Colonnes style Kanban : **Backlog → Ready → In Progress → Review → Done**  
> Mise à jour hebdomadaire (lundi).

---

## 📊 VUE D'ENSEMBLE

| Sprint | Focus | Issues | Objectif |
|--------|-------|--------|----------|
| **S1** | P0 Critiques | #001-#005 | Mobile utilisable, accessibilité de base |
| **S2** | P1 Best Practices | #006-#013 | Code propre, Next.js 16 ready, formulaires |
| **S3** | P2 Polish | #014-#017 | Touch, hydration, CLS, hover states |
| **S4** | P3 Modernisation | #018-#020 | Server Actions, PPR, Turbopack |

---

## 🎯 KANBAN BOARD

### 📥 BACKLOG (Prêtes à être priorisées)
```
[ ] #018 Server Actions migration (P3, 1-2 sem)
[ ] #019 Partial Prerendering eval (P3, 2-3 j)
[ ] #020 Turbopack activation (P3, 30min)
```

### ✅ READY (Specs claires, pouvez commencer)
```
[ ] #006 Globals.css cleanup + prefers-reduced-motion fix (P1, 2h)
[ ] #007 Forms autocomplete/spellCheck (P1, 1h)
[ ] #008 Typography … et guillemets (P1, 30min)
[ ] #009 not-found pages verify-email + profile (P1, 30min)
[ ] #010 Tables scroll-slim (P1, 30min)
[ ] #011 Hero padding mobile (P1, 15min)
[ ] #012 Hero steps grid (P1, 15min)
[ ] #013 Profiling aria-live (P1, 30min)
[ ] #014 touch-action: manipulation (P2, 15min)
[ ] #015 Hover states ghost buttons (P2, 30min)
[ ] #016 suppressHydrationWarning removal (P2, 1h)
[ ] #017 Logo SVG dimensions (P2, 15min)
```

### 🚀 IN PROGRESS (En cours — max 2 simultanées par dev)
```
[ ] #001 Hero aura/hash transition (P0, 1h)          → ASSIGNÉ: _______
[ ] #002 MemberTable mobile cards (P0, 4h)           → ASSIGNÉ: _______
[ ] #003 Profiling reduced-motion (P0, 2h)           → ASSIGNÉ: _______
[ ] #004 MobileBottomNav + DashboardSidebar FAB (P0, 1h) → ASSIGNÉ: _______
[ ] #005 AdminSidebar double hamburger (P0, 1h)      → ASSIGNÉ: _______
```

### 👀 REVIEW (PR ouverte, en attente review)
```
[ ] ________________________________________
[ ] ________________________________________
```

### ✅ DONE (Mergées)
```
[ ] ________________________________________
[ ] ________________________________________
```

---

## 📅 PLANNING DÉTAILLÉ SEMAINE PAR SEMAINE

### SEMAINE 1 (Lundi → Vendredi) — **P0 ONLY**
| Jour | Issue | Livrable | Validé par |
|------|-------|----------|------------|
| Lun | #001 | Hero transitions fluides 768px+ | |
| Mar | #003 | Profiling `useReducedMotion` hook + intégration | |
| Mer | #004 | FAB droite + ARIA + Landing pb-[76px] removed | |
| Jeu | #005 | AdminSidebar header toggle (desktop) + FAB (mobile) | |
| Ven | #002 | MemberTable cartes mobile + skeleton | |

**Definition of Done S1 :**
- [ ] `bun run validate` passe (typecheck + lint + test:unit)
- [ ] Test manuel mobile (Chrome DevTools device toolbar)
- [ ] Test `prefers-reduced-motion` OS activé
- [ ] Test lecteur d'écran (NVDA/VoiceOver) navigation principale

---

### SEMAINE 2 — **P1 BEST PRACTICES**
| Jour | Issue | Livrable |
|------|-------|----------|
| Lun | #006 | Globals.css nettoyé, prefers-reduced-motion corrigé |
| Mar | #007 + #008 | Forms autocomplete + typo …/guillemets |
| Mer | #009 + #010 | not-found pages + scroll-slim tables |
| Jeu | #011 + #012 + #013 | Hero padding/grid + Profiling aria-live |
| Ven | Buffer | Revue code + tests intégration |

**Definition of Done S2 :**
- [ ] Tous formulaires ont `autocomplete` + `spellCheck={false}` appropriés
- [ ] Aucune occurrence `...` ou `"` dans strings UI (script vérif)
- [ ] `not-found.tsx` fonctionnels + design cohérent
- [ ] Tables admin scrollbar fine mobile

---

### SEMAINE 3 — **P2 POLISH**
| Jour | Issue | Livrable |
|------|-------|----------|
| Lun | #014 | `touch-action: manipulation` global |
| Mar | #015 | Hover states boutons ghost/outline |
| Mer | #016 | Retirer `suppressHydrationWarning`, corriger causes |
| Jeu | #017 | Logo SVG width/height explicites |
| Ven | Buffer | Tests cross-browser (Safari mobile, Firefox, Chrome) |

**Definition of Done S3 :**
- [ ] Pas de double-tap zoom delay sur boutons/inputs
- [ ] Tous boutons ont `:hover` visible (contraste +)
- [ ] Build sans `suppressHydrationWarning` + pas d'erreurs hydration
- [ ] Lighthouse CLS < 0.1 sur pages clés

---

### SEMAINE 4 — **P3 MODERNISATION (Optionnel, post-V1 stable)**
| Jour | Issue | Livrable |
|------|-------|----------|
| Lun-Mar | #018 | Server Actions : create-member, auth, bulk-members |
| Mer | #019 | PPR test sur `/` + `/login` |
| Jeu | #020 | Turbopack config + bench build |
| Ven | | Rétrospective + plan next quarter |

---

## 🏷️ LABELS GITHUB (À créer dans le repo)

| Label | Couleur | Description |
|-------|---------|-------------|
| `p0-critical` | `#B60205` | Bloquant mobile/accessibilité — faire cette semaine |
| `p1-high` | `#D93F0B` | Best practice importante — faire dans les 2 semaines |
| `p2-medium` | `#F9A602` | Polish/qualité — faire dans le mois |
| `p3-low` | `#1D76DB` | Modernisation/tech debt — backlog |
| `a11y` | `#5319E7` | Accessibilité (WCAG 2.1 AA) |
| `mobile` | `#006B75` | Spécifique mobile/responsive |
| `admin` | `#22863A` | Zone admin |
| `landing` | `#6F42C1` | Landing page publique |
| `profiling` | `#E99695` | Parcours profiling |
| `nextjs` | `#000000` | Next.js 16 features (Server Actions, PPR, Turbopack) |
| `css` | `#F08833` | Tailwind/globals.css |
| `forms` | `#A041BD` | Formulaires/validation |
| `performance` | `#DB243F` | Web Vitals, CLS, LCP |

---

## 🔄 RITUELS

### Quotidien (Standup 10min)
- Qu'ai-je fait hier sur ma issue ?
- Qu'est-ce qui bloque ?
- Quel issue je prends aujourd'hui ?

### Hebdomadaire (Vendredi 30min — Review + Planning)
1. **Demo** : ce qui a été mergeé (mobile + desktop)
2. **Metrics** : Lighthouse mobile (LCP, CLS, INP) sur 3 pages clés
3. **Blockers** : dépendances, decisions needed
4. **Next week** : déplacer issues Backlog → Ready → In Progress

### Mensuelle (Rétrospective 1h)
- Velocity : issues P0/P1 fermées vs planifiées
- Qualité : régressions visuelles ? bugs mobile signalés ?
- Process : estimation réaliste ? review bottleneck ?
- Ajustement roadmap trimestre suivant

---

## 📈 MÉTRIQUES DE SUCCÈS

| Métrique | Baseline (audit) | Cible S1 | Cible S2 | Cible S3 |
|----------|------------------|----------|----------|----------|
| **Lighthouse Mobile Performance** | ~65 | >75 | >85 | >90 |
| **Lighthouse Accessibility** | ~85 | >90 | >95 | 100 |
| **CLS (mobile)** | ~0.15 | <0.1 | <0.05 | <0.01 |
| **INP (mobile)** | ~300ms | <200ms | <150ms | <100ms |
| **Issues P0 ouvertes** | 5 | 0 | 0 | 0 |
| **Issues P1 ouvertes** | 8 | 8 | 0 | 0 |
| **Hydration errors (console)** | 3-5 | 0 | 0 | 0 |

---

## 🛠️ OUTILS LOCAUX

### Task Tracker (CLI)
```bash
# Prochaine tâche faisable
node scripts/task-tracker.mjs next

# Marquer faite
node scripts/task-tracker.mjs done ISSUE-001

# Vue d'ensemble
node scripts/task-tracker.mjs status
```

### Scripts utiles
```bash
# Audit typo (points suspension + guillemets)
node scripts/audit-typo.mjs

# Lighthouse CI local
npx lhci autorun --config=lighthouserc.json

# Test reduced-motion
# Chrome DevTools > Rendering > Emulate CSS prefers-reduced-motion
```

---

## 📝 NOTES & DÉCISIONS

| Date | Décision | Contexte |
|------|----------|----------|
| 2026-10-01 | Pattern "carte mobile / table desktop" pour MemberTable | Table overflow-x inutilisable mobile, colonnes critiques manquantes |
| 2026-10-01 | FAB hamburger à droite (bottom-5 right-5) | Évite collision MobileBottomNav (left) |
| 2026-10-01 | `prefers-reduced-motion` : désactiver seulement `.animate-*` + framer-motion via hook | Ne pas casser `layout` animations framer-motion |
| 2026-10-01 | Server Actions migration = P3 (post-V1) | Risque régression fort, V1 stable prioritaire |

---

## 🔗 LIENS RAPIDES

- **Issues détaillées** : `ISSUES_RESPONSIVE.md`
- **Task tracker** : `scripts/task-tracker.mjs`
- **Audit complet** : conversation OpenCode (cette session)
- **Vercel Guidelines** : https://github.com/vercel-labs/web-interface-guidelines

---

> **Règle d'or** : *Une issue = un commit = un PR = une review.*  
> Pas de "gros PR fourre-tout". Atomicité = vélocité + qualité.