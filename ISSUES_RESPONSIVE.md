# 🎯 Issues Responsive Design & Next.js Best Practices — HASHCODE REBOOT

> Généré depuis l'audit complet. Chaque issue = **un commit/PR atomique**.
> Labels : `p0-critical` | `p1-high` | `p2-medium` | `p3-low` | `a11y` | `nextjs` | `mobile` | `admin` | `landing` | `profiling`
>
> **Plan de septembre 2026, résidu racine à supprimer (D15).** Les 6 P0 sont
> déjà corrigées. Les commandes citées ont été alignées sur `npm`, mais les
> chemins de fichiers antérieurs à la migration i18n ne sont plus valides.

---

## 🔴 P0 — CRITIQUES (Bloquants mobile / accessibilité)

### ISSUE-001 : Hero — Lime aura & Hash symbol apparition brutale à 640px
**Labels :** `p0-critical` `landing` `mobile` `a11y`
**Fichiers :** `src/components/reboot/landing/hero.tsx:14-23`
**Problème :** `hidden sm:block` → contenu décoratif apparaît sans transition à 640px. Sur tablettes (768-1023px) l'aura chevauche le texte.
**Critères d'acceptation :**
- [ ] Remplacer `hidden sm:block` par `opacity-0 sm:opacity-[0.06] transition-opacity duration-500`
- [ ] Media query `@media (min-width: 768px)` au lieu de `sm` (640px) pour l'aura
- [ ] Hash symbol : `opacity-0 lg:opacity-[0.15] transition-opacity` (visible ≥1024px seulement)
- [ ] Test `prefers-reduced-motion` : animations désactivées
**Effort :** 1h

---

### ISSUE-002 : Tables Admin — Colonnes masquées mobile sans alternative
**Labels :** `p0-critical` `admin` `mobile` `a11y`
**Fichiers :** `src/components/reboot/admin/MemberTable.tsx:511-513,531,648-662`
**Problème :** `hidden md:table-cell` / `hidden lg:table-cell` → Objectif, Mentorat, Budget invisibles mobile. Pas de vue détail inline.
**Critères d'acceptation :**
- [ ] Pattern "carte mobile / table desktop" :
  - Mobile (<768px) : `<div class="grid gap-3">` cartes avec toutes les infos
  - Desktop (≥768px) : `<Table>` existante
- [ ] Carte mobile = prénom, email, pays, domaine, niveau, objectif, mentorat, budget, statut, voie, date
- [ ] `onClick` carte → ouvre `MemberDetailDialog` (existant)
- [ ] Skeleton loading adapté aux deux vues
**Effort :** 4h

---

### ISSUE-003 : Profiling Flow — Framer Motion ignore `prefers-reduced-motion`
**Labels :** `p0-critical` `profiling` `a11y` `mobile`
**Fichiers :** `src/components/reboot/profiling-flow.tsx:286-293`
**Problème :** `AnimatePresence` + `motion.div` transitions non respectueuses de `prefers-reduced-motion`. CSS global coupe seulement CSS animations.
**Critères d'acceptation :**
- [ ] Hook `useReducedMotion()` dans `src/hooks/use-reduced-motion.ts`
- [ ] `transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22,1,0.36,1] }}`
- [ ] `initial={reducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: direction * 16 }}`
- [ ] Test : cocher "Réduire les animations" OS → transitions instantanées
**Effort :** 2h

---

### ISSUE-004 : Nav Mobile — Hamburger FAB chevauche MobileBottomNav
**Labels :** `p0-critical` `mobile` `a11y` `dashboard` `admin`
**Fichiers :** `src/components/reboot/mobile-bottom-nav.tsx:55`, `src/app/dashboard/_components/DashboardSidebar.tsx:198-209`
**Problème :** Deux fixed bottom (`z-40`) → zone tactile chevauchée. FAB sans `aria-expanded`/`aria-controls`.
**Critères d'acceptation :**
- [ ] Déplacer FAB sidebar à **droite** : `fixed bottom-5 right-5` (éloigné du bottom nav)
- [ ] Ajouter `aria-expanded={mobileOpen}` `aria-controls="dashboard-mobile-nav"` sur FAB
- [ ] `MobileBottomNav` : ajouter `role="navigation" aria-label="Navigation principale membre"`
- [ ] Supprimer `pb-[76px]` sur `Landing` (ligne 25) — n'utilise pas `MobileBottomNav`
**Effort :** 1h

---

### ISSUE-005 : AdminSidebar — Double hamburger (header toggle + FAB)
**Labels :** `p0-critical` `admin` `mobile` `a11y`
**Fichiers :** `src/components/reboot/admin/AdminSidebar.tsx:158-169,311-323`
**Problème :** Header toggle visible seulement `!collapsed`, FAB toujours visible → confusion.
**Critères d'acceptation :**
- [ ] Pattern unifié : **Header toggle (desktop) + FAB (mobile uniquement)**
- [ ] Header toggle : `hidden md:flex` (visible desktop seulement)
- [ ] FAB : `md:hidden fixed bottom-5 right-5` (mobile seulement)
- [ ] Les deux contrôlent le même état `collapsed`/`mobileOpen`
- [ ] ARIA cohérent : `aria-label` "Réduire le menu" / "Ouvrir le menu"
**Effort :** 1h

---

## 🟠 P1 — IMPORTANTS (Best practices / Next.js)

### ISSUE-006 : Globals.css — Nettoyage utilitaires lime dupliqués + prefers-reduced-motion
**Labels :** `p1-high` `nextjs` `a11y` `css`
**Fichiers :** `src/app/globals.css:128-170,409-431`
**Problème :**
1. Classes `.bg-lime`, `.text-lime`, `.hover\:bg-lime` dupliquées → Tailwind 4 génère via `@theme` (`--color-primary`)
2. `prefers-reduced-motion` force `animation-duration: 0.01ms` → casse framer-motion `layout` animations
**Critères d'acceptation :**
- [ ] Supprimer lignes 128-170 (utilitaires lime)
- [ ] Remplacer usages `bg-lime` → `bg-primary`, `text-lime` → `text-primary`, `border-lime` → `border-primary`
- [ ] `prefers-reduced-motion` : ne pas forcer `animation-duration: 0.01ms` sur `*`, seulement sur classes `.animate-*` explicites
- [ ] Conserver `scroll-behavior: auto` + désactiver `.animate-hash-*` uniquement
**Effort :** 2h

---

### ISSUE-007 : Forms — Manque `autocomplete` / `spellCheck={false}`
**Labels :** `p1-high` `a11y` `forms` `profiling` `auth`
**Fichiers :** `src/components/reboot/profiling/question-view.tsx`, `src/app/login/page.tsx`, `src/app/verify-otp/page.tsx`
**Problème :** Inputs email/country sans `autocomplete`, pas de `spellCheck={false}` sur codes/emails.
**Critères d'acceptation :**
- [ ] `TextView` (email) : `autocomplete="email"` `spellCheck={false}` `inputMode="email"`
- [ ] `TextView` (OTP) : `autocomplete="one-time-code"` `spellCheck={false}` `inputMode="numeric"`
- [ ] `CountrySelect` : `autocomplete="country"`
- [ ] `input` OTP existants (`verify-otp/page.tsx:207-223`) : ajouter `autocomplete="one-time-code"`
**Effort :** 1h

---

### ISSUE-008 : Typography — Points de suspension `...` et guillemets droits `"`
**Labels :** `p1-high` `content` `landing` `profiling`
**Fichiers :** `src/components/reboot/landing/hero.tsx:31`, `src/components/reboot/profiling/questions.ts` (multiples)
**Problème :** `...` au lieu de `…`, guillemets droits `"` au lieu de `“` `”`.
**Critères d'acceptation :**
- [ ] Remplacer tous `...` par `…` (U+2026)
- [ ] Remplacer guillemets droits par courbes dans les strings UI (pas code)
- [ ] Script `scripts/fix-typography.mjs` pour audit futur
**Effort :** 30min

---

### ISSUE-009 : Not-found pages manquantes
**Labels :** `p1-high` `nextjs` `a11y` `verify-email` `profile`
**Fichiers :** **NOUVEAUX** `src/app/verify-email/not-found.tsx`, `src/app/profile/[id]/not-found.tsx`
**Problème :** Next.js App Router attend `not-found.tsx` pour `notFound()` calls.
**Critères d'acceptation :**
- [ ] `verify-email/not-found.tsx` : message "Lien expiré" + bouton "Retour à HASHCODE" + lien "Demander un nouveau lien" → `/dashboard/settings`
- [ ] `profile/[id]/not-found.tsx` : message "Profil introuvable" + bouton "Retour à HASHCODE"
- [ ] Les deux : layout cohérent (header logo, footer), `animate-hash-in`
**Effort :** 30min

---

### ISSUE-010 : Tables Admin — Scrollbar native large, pas de `.scroll-slim`
**Labels :** `p1-high` `admin` `css`
**Fichiers :** `src/components/reboot/admin/MemberTable.tsx:446`, `src/app/admin/ateliers/page.tsx`, `src/app/admin/ateliers/submissions/page.tsx`
**Problème :** `.scroll-slim` défini dans `globals.css:282-295` mais non appliqué sur `overflow-x-auto` tables.
**Critères d'acceptation :**
- [ ] Ajouter `scroll-slim` sur tous wrappers `overflow-x-auto` tables admin
- [ ] Vérifier mobile : scrollbar fine (8px) au lieu de native (16px)
**Effort :** 30min

---

### ISSUE-011 : Landing Hero — Padding vertical excessif mobile
**Labels :** `p1-high` `landing` `mobile`
**Fichiers :** `src/components/reboot/landing/hero.tsx:24`
**Problème :** `pt-14 sm:pt-28 pb-14 sm:pb-32` = 168px vertical mobile (56px + 112px).
**Critères d'acceptation :**
- [ ] Réduire mobile : `py-10 sm:py-20` (40px + 80px)
- [ ] Garder `sm:py-24` pour tablette+ si besoin
**Effort :** 15min

---

### ISSUE-012 : Landing Hero — Steps grid 3 colonnes trop étroites tablette
**Labels :** `p1-high` `landing` `mobile`
**Fichiers :** `src/components/reboot/landing/hero.tsx:59`
**Problème :** `sm:grid-cols-3` → 3 cartes sur 640px = ~180px/carte (trop étroit).
**Critères d'acceptation :**
- [ ] `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- [ ] Gap constant `gap-3`
**Effort :** 15min

---

### ISSUE-013 : Profiling Flow — Indicateur progression sans `aria-live`
**Labels :** `p1-high` `profiling` `a11y`
**Fichiers :** `src/components/reboot/profiling/shell.tsx` (importé), `src/components/reboot/profiling-flow.tsx:278`
**Problème :** Changement d'étape non annoncé aux lecteurs d'écran.
**Critères d'acceptation :**
- [ ] `ProfilingShell` : ajouter `aria-live="polite"` sur indicateur progression (step X/Y)
- [ ] Annonce : "Question 3 sur 12, Domaine principal"
**Effort :** 30min

---

## 🟡 P2 — MOYENS (Polish / Modernisation Next.js)

### ISSUE-014 : Touch targets — `touch-action: manipulation` global manquant
**Labels :** `p2-medium` `mobile` `a11y`
**Fichiers :** `src/app/globals.css` (nouveau)
**Critères d'acceptation :**
- [ ] Ajouter `@layer base { * { touch-action: manipulation; } }` dans `globals.css`
- [ ] Exclure inputs `textarea` / `input[type="text"]` si sélection texte nécessaire
**Effort :** 15min

---

### ISSUE-015 : Hover states — Boutons `ghost` sans feedback visible
**Labels :** `p2-medium` `a11y` `admin` `components`
**Fichiers :** `src/components/reboot/admin/AdminSidebar.tsx:186-213` (palette button), `src/components/ui/button.tsx`
**Critères d'acceptation :**
- [ ] `variant="ghost"` → ajouter `hover:bg-lime/5 hover:text-foreground` (ou `hover:bg-accent`)
- [ ] Vérifier tous usages `RebootButton variant="ghost"` / `variant="outline"`
**Effort :** 30min

---

### ISSUE-016 : Hydration — `suppressHydrationWarning` sur `<html>` masque vrais problèmes
**Labels :** `p2-medium` `nextjs` `hydration`
**Fichiers :** `src/app/layout.tsx:102`
**Critères d'acceptation :**
- [ ] Retirer `suppressHydrationWarning`
- [ ] Identifier causes : probablement `date-fns` format dates SSR vs client
- [ ] Corriger : `suppressHydrationWarning` seulement sur composants spécifiques (ex: `DashboardSidebar` localStorage)
**Effort :** 1h

---

### ISSUE-017 : Images — Logo SVG sans dimensions explicites
**Labels :** `p2-medium` `nextjs` `performance` `cls`
**Fichiers :** `src/components/brand/logo.tsx`
**Critères d'acceptation :**
- [ ] `Logo` prop `size?: number` → `width={size} height={size}` sur `<svg>`
- [ ] Default `size={32}` → `width="32" height="32"`
- [ ] Évite CLS (Cumulative Layout Shift)
**Effort :** 15min

---

## 🟢 P3 — FAIBLES (Modernisation Next.js 16)

### ISSUE-018 : Server Actions — Migrer mutations API routes
**Labels :** `p3-low` `nextjs` `refactor` `api`
**Fichiers :** `src/app/api/members/route.ts`, `src/app/api/auth/*`, `src/app/api/admin/*`
**Critères d'acceptation :**
- [ ] `POST /api/members` → `actions/create-member.ts` (Server Action)
- [ ] `POST /api/auth/request-magic-link` → `actions/request-magic-link.ts`
- [ ] `POST /api/auth/verify-otp` → `actions/verify-otp.ts`
- [ ] `POST /api/admin/members/bulk` → `actions/bulk-members.ts`
- [ ] Forms client → `useActionState` / `useTransition` (React 19)
**Effort :** 1-2 semaines

---

### ISSUE-019 : Partial Prerendering — Pages statiques candidates
**Labels :** `p3-low` `nextjs` `performance`
**Fichiers :** `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/verify-otp/page.tsx`, pages légales futures
**Critères d'acceptation :**
- [ ] Évaluer PPR pour `/` (landing), `/login`, `/verify-otp`, `/verify-email`
- [ ] `export const dynamic = 'force-static'` + `unstable_noStore()` pour parties dynamiques
- [ ] Mesure TTFB amélioration
**Effort :** 2-3 jours

---

### ISSUE-020 : Turbopack — Activation build
**Labels :** `p3-low` `nextjs` `dx`
**Fichiers :** `next.config.ts`
**Critères d'acceptation :**
- [ ] Ajouter `experimental: { turbo: { resolveAlias: { ... } } }`
- [ ] Test `npm run build` → temps réduit
- [ ] Vérifier compatibilité `tailwindcss` v4 + `next-intl` futur
**Effort :** 30min

---

## 📋 CHECKLIST GLOBALE PAR COMPOSANT

| Composant | P0 | P1 | P2 | P3 | Statut |
|-----------|----|----|----|----|--------|
| `landing/hero.tsx` | #001 | #011, #012 | | | 🔴 |
| `landing/pillars.tsx` | | | | | ✅ |
| `profiling-flow.tsx` | #003 | #013 | | | 🔴 |
| `profiling/question-view.tsx` | | #007 | | | 🟠 |
| `mobile-bottom-nav.tsx` | #004 | | #014 | | 🔴 |
| `DashboardSidebar.tsx` | #004 | | #014, #016 | | 🔴 |
| `AdminSidebar.tsx` | #005 | | #014, #016 | | 🔴 |
| `MemberTable.tsx` | #002 | #010 | | | 🔴 |
| `globals.css` | | #006 | #014 | | 🟠 |
| `layout.tsx` (root) | | | #016 | | 🟡 |
| `verify-email/` | | #009 | | | 🟠 |
| `profile/[id]/` | | #009 | | | 🟠 |
| `login/` `verify-otp/` | | #007 | | | 🟠 |
| API routes mutations | | | | #018 | 🟢 |
| `next.config.ts` | | | | #020 | 🟢 |

---

## 🔗 LIENS UTILES

- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
- [Next.js 16 App Router Docs](https://nextjs.org/docs/app)
- [Tailwind CSS v4 Migration](https://tailwindcss.com/docs/installation)
- [React 19 `useActionState`](https://react.dev/reference/react/useActionState)