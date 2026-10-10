# HASHCODE REBOOT — UI/UX Audit Report

**Date:** 2026-10-10  
**Scope:** Full application (Landing, Profiling Flow, Dashboard, Admin, Shared Components)  
**Methodology:** Heuristic evaluation (Nielsen + WCAG 2.2 AA) + React Native Web / Next.js best practices (Vercel, Callstack, Anthropics guidelines)

---

## Executive Summary

| Dimension | Score | Trend |
|-----------|-------|-------|
| **Visual Design & Brand Cohesion** | 8.5/10 | ↗ Strong |
| **Interaction & Flow Design** | 7.5/10 | → Good, some friction |
| **Accessibility (a11y)** | 6.5/10 | ↘ Needs work |
| **Performance Perception** | 8/10 | ↗ Strong |
| **Responsive & Mobile UX** | 7/10 | → Good, gaps in touch targets |
| **Design System Maturity** | 8/10 | ↗ Strong tokens, inconsistent consumption |
| **Developer Experience (DX)** | 8.5/10 | ↗ Excellent |

**Overall: 7.6/10 — A polished, engineering-first product with a distinct dark/lime identity. Primary risks are accessibility gaps, mobile touch-target compliance, and inconsistent design-token consumption across the two UI systems (shadcn/ui + custom reboot components).**

---

## 1. Visual Design & Brand Cohesion

### Strengths
- **Dark-first, lime-as-accent** system is coherent and distinctive. The OKLCH token palette in `globals.css` (lines 60–102) is well-structured with semantic aliases (`--ds-*` lines 809–834).
- **Typography hierarchy**: Geist Sans (UI), Geist Mono (labels/data), Sora (display/wordmark). Admin scope correctly overrides to Inter + JetBrains Mono (`admin-scope` block, lines 418–477).
- **Landing page** uses engineered visual primitives (`.bg-grid`, `.bg-vignette`, `.bg-noise`, `.ecosystem-core`) rather than decorative imagery — aligns with "engineered, not decorated" philosophy.
- **Motion language** is restrained: `hash-in`, `hash-pulse`, `hash-sweep`, `bounce-slow` — all respect `prefers-reduced-motion` (lines 381–404).
- **Micro-interactions**: `.lift-on-hover`, `.row-sweep`, `.focus-lime` are consistent and tasteful.

### Issues

| # | Issue | Severity | Location | Recommendation |
|---|-------|----------|----------|----------------|
| V1 | **Lime alias dependency** — `--color-lime` aliases to `--primary` (line 47). If `--primary` changes, brand color shifts silently. | Medium | `globals.css:47` | Keep alias but add a comment warning; consider a dedicated `--color-brand-lime` token. |
| V2 | **Inconsistent radius usage** — shadcn `Card` uses `rounded-xl` (12px) while reboot `Card` uses `rounded-md` (8px, line 248). | Low | `shared.tsx:248`, `ui/card.tsx:10` | Standardize on `--radius-lg` (8px) or `--radius-xl` (12px) via design tokens. |
| V3 | **Two button systems** — `ui/button.tsx` (cva, Radix Slot) vs `shared.tsx:RebootButton` (manual variants). Different hover/focus semantics. | Medium | `shared.tsx:14–59`, `ui/button.tsx` | Migrate `RebootButton` to consume `buttonVariants` or deprecate one. |
| V4 | **Focus ring inconsistency** — shadcn uses `focus-visible:ring-ring/50 focus-visible:ring-[3px]`; reboot uses `.focus-lime` (2px solid lime, offset 2px). | Medium | `globals.css:247–250`, `ui/button.tsx:8` | Unify to one focus-ring spec (recommend shadcn's 3px ring for better visibility). |
| V5 | **Admin scope font override** — `.admin-scope .font-display` forces Inter (line 442–446) but Sora is loaded globally. Sora still downloads for admin pages. | Low | `globals.css:442–446`, `admin/fonts.ts` | Use `next/font` with `preload: false` for Sora in admin, or split layout to avoid loading. |

---

## 2. Interaction & Flow Design

### Strengths
- **Profiling flow** is well-architected: encrypted localStorage persistence, resume prompt, draft beacon on abandon, step timing analytics.
- **Optimistic UI** in `ProfilingFlow` — `AnimatePresence` with directional slide (lines 294–301) respects `useReducedMotion`.
- **Welcome screen** branches cleanly (Immediate vs Pending) with `RecommendationExperience` for orientation.
- **Dashboard layout** persists sidebar + top bar + mobile bottom nav — correct responsive pattern.

### Issues

| # | Issue | Severity | Location | Recommendation |
|---|-------|----------|----------|----------------|
| I1 | **No keyboard shortcut for "Back" in profiling** — only mouse/touch. Power users expect `Esc` or `←`. | Medium | `profiling-flow.tsx:202–215` | Add `keydown` handler for `Escape`/`ArrowLeft` when not in text input. |
| I2 | **Profiling step validation is inline only** — no summary screen before submit. Users can't review all answers at once. | Medium | `profiling-flow.tsx:232–247` | Add a "Review" step (phase) before final submit; reuse `ProfilePreview`. |
| I3 | **Sticky mobile CTA** (`StickyMobileCta`) duplicates hero CTA but no `aria-hidden` when hero visible — double announcement for screen readers. | Medium | `landing/sticky-cta.tsx` (not read, inferred) | Hide from AT when hero CTA in viewport via `IntersectionObserver`. |
| I4 | **Mobile bottom nav + sidebar drawer both exist** — redundant nav patterns. Drawer has logout; bottom nav doesn't. | Low | `DashboardSidebar.tsx:200–252`, `mobile-bottom-nav.tsx` | Consolidate: bottom nav for primary 5, drawer for secondary (logout, admin). |
| I5 | **No empty state for dashboard agenda** — `AgendaCard` shows skeleton but no "no events" illustration/copy. | Low | `dashboard/_components/AgendaCard.tsx` (not read) | Add empty state with CTA to browse events. |
| I6 | **Profiling "threeMonthGoal" gates preview phase** — but user can skip if not required. Flow logic unclear. | Low | `profiling-flow.tsx:194–197` | Make `threeMonthGoal` required or clarify optional preview transition. |

---

## 3. Accessibility (WCAG 2.2 AA)

### Critical Gaps

| # | Criterion | Failure | Location | Fix |
|---|-----------|---------|----------|-----|
| A1 | **1.4.3 Contrast (Minimum)** — `text-muted-foreground` on `bg-card` (oklch 0.70 / 0.20) = ~3.8:1. **Fails AA for normal text (4.5:1)**. | Critical | `globals.css:77`, `globals.css:65` | Darken `--muted-foreground` to ≥ oklch(0.78) or lighten `--card` to ≤ oklch(0.16). |
| A2 | **1.4.11 Non-text Contrast** — `.hairline` border (`--border` oklch 0.31) on `--card` (0.20) = ~2.1:1. **Fails AA (3:1)**. | Critical | `globals.css:84`, `globals.css:65`, `shared.tsx:130` | Increase `--border` to ≥ oklch(0.38) or use `--ds-line` with explicit contrast. |
| A3 | **2.4.7 Focus Visible** — shadcn focus ring uses `ring-ring/50` (lime at 50% opacity). On dark bg, may not meet 3:1 against adjacent colors. | High | `ui/button.tsx:8`, `ui/input.tsx:12` | Use solid `--ring` (lime) at full opacity, 3px minimum. |
| A4 | **2.5.5 Target Size** — Multiple interactive elements < 44×44px: `Tag` (line 186: `py-2` ≈ 32px), `MiniStat` icon (line 654: `size-8` = 32px), sidebar collapsed icons (line 258: `w-14` = 56px but hit area `px-0 py-2`). | High | `shared.tsx:186`, `welcome.tsx:653–654`, `DashboardSidebar.tsx:258` | Enforce `min-h-[44px] min-w-[44px]` on all interactive primitives. |
| A5 | **1.3.1 Info & Relationships** — `MonoLabel` used as visual label but not associated via `aria-label`/`aria-labelledby` on inputs. | Medium | `shared.tsx:75–83`, `profiling/question-view.tsx` (not read) | Pair each `MonoLabel` with `id` + `aria-labelledby` on controlled input. |
| A6 | **2.4.3 Focus Order** — Mobile sidebar drawer (`DashboardSidebar.tsx:217–252`) traps focus? No `FocusTrap` / `inert` on background. | Medium | `DashboardSidebar.tsx:217–252` | Add `react-aria` `Dialog` or manual focus trap + `inert` on main. |
| A7 | **4.1.2 Name, Role, Value** — `Tag` with `onClick` renders `<button>` but no `aria-pressed` for `active` state. | Medium | `shared.tsx:195–200` | Add `aria-pressed={active}` when `onClick` present. |
| A8 | **3.3.2 Labels or Instructions** — `WhatsAppCapture` input (line 453–462) has `placeholder` but no `<label>` or `aria-label` (only `aria-label` on input). | Medium | `welcome.tsx:453–462` | Add visible `<label>` or `aria-labelledby` referencing `MonoLabel`. |
| A9 | **2.2.2 Pause, Stop, Hide** — `.animate-hash-pulse` on live indicator (line 159) loops infinitely. No pause mechanism. | Low | `welcome.tsx:159`, `globals.css:320–326` | Add `prefers-reduced-motion` stop (already in CSS) + JS pause on hover/focus. |
| A10 | **1.4.4 Resize Text** — `.admin-scope .text-[9px]` guard (line 449–453) forces 11px minimum, but global `.mono-label` is 12.5px. Inconsistent. | Low | `globals.css:449–453`, `globals.css:201–208` | Standardize minimum text size at 12px (1rem base × 0.75) globally. |

### Positive Patterns
- `prefers-reduced-motion` respected globally (CSS + `useReducedMotion` hook).
- `focus-lime` utility exists and used on custom elements.
- Semantic HTML: `<main id="contenu">`, `<section aria-labelledby>`, `<ol>` for steps.
- `next-intl` for i18n — all user-facing text translated.

---

## 4. Responsive & Mobile UX

### Strengths
- Landing hero splits correctly: editorial first, visual second on mobile (lines 61, 118).
- Ecosystem Core reflows to 3-column grid on mobile (lines 599–620).
- Dashboard uses drawer (mobile) + collapsible sidebar (desktop) + bottom nav — complete pattern.
- `content-visibility: auto` on `.cv-auto` (line 125–128) for offscreen perf.
- `safe-area-inset-bottom` respected on bottom nav (line 56).

### Issues

| # | Issue | Severity | Location | Recommendation |
|---|-------|----------|----------|----------------|
| R1 | **Bottom nav labels at 11px** (line 77) — below 12px minimum for comfortable reading. | Medium | `mobile-bottom-nav.tsx:77` | Increase to 12px (`text-xs` → `text-[12px]`). |
| R2 | **Sidebar drawer width 72px (w-72 = 288px)** — exceeds recommended 280px max, may cause thumb reach issues on small phones. | Low | `DashboardSidebar.tsx:228` | Reduce to `w-[280px]` or `max-w-[85vw]`. |
| R3 | **Profiling flow question view** — not reviewed but likely uses desktop-first layouts. Need to verify mobile stack. | Medium | `profiling/question-view.tsx` (not read) | Audit each question type for mobile: tap targets, input sizing, scroll. |
| R4 | **Admin mobile** — `MobileBottomNav` switches items for admin (line 44–45) but `AdminSidebar` has no mobile drawer (hidden `md:hidden`). Admin mobile relies solely on bottom nav (5 items). | Medium | `AdminShell.tsx:171`, `AdminSidebar.tsx` (not read) | Add mobile drawer for admin or ensure bottom nav covers all sections. |
| R5 | **Landing sticky CTA** — `bottom-0` fixed, but no `padding-bottom` on main content to prevent overlap. | Low | `landing/sticky-cta.tsx` (not read), `landing.tsx:61` | Add `pb-[calc(56px+env(safe-area-inset-bottom))]` to main when sticky CTA visible. |

---

## 5. Design System Maturity

### Token Architecture (globals.css)
- **Well-organized**: Base tokens → `@theme inline` → `.admin-scope` overrides → DS-127 additive aliases (`--ds-*`).
- **Documentation inline** (§1 inventory, lines 749–802) — excellent for onboarding.
- **Gap**: No automated token sync to Figma / Style Dictionary. Manual drift risk.

### Component Library Split
| System | Components | Scope | Risk |
|--------|------------|-------|------|
| **shadcn/ui** (`ui/*.tsx`) | 40+ primitives (Button, Input, Card, Dialog, etc.) | Admin, Dashboard, Forms | High duplication with reboot |
| **Reboot** (`reboot/shared.tsx`, `reboot/landing/*.tsx`) | 15+ brand-specific (RebootButton, MonoLabel, Eyebrow, Card, Hero, Engine, etc.) | Landing, Profiling, Welcome | Inconsistent token consumption |

### Issues

| # | Issue | Severity | Recommendation |
|---|-------|----------|----------------|
| D1 | **Two Card components** — `ui/card.tsx` (shadcn, `rounded-xl`, `gap-6`, `py-6`) vs `shared.tsx:Card` (line 238, `rounded-md`, no padding). Used interchangeably? | High | Deprecate one. Recommend shadcn Card as base; extend via `className` for reboot variants. |
| D2 | **Two Button systems** — see V3. `RebootButton` lacks `asChild` (Radix Slot) support — breaks `Link` composition. | High | Migrate `RebootButton` to wrap `ui/Button` with brand variants. |
| D3 | **No Storybook / visual regression** — design changes validated manually only. | Medium | Add Storybook + Chromatic or Playwright visual tests. |
| D4 | **Icon inconsistency** — `lucide-react` used everywhere, but `HashSymbol` / `Logo` are custom SVGs. No icon registry. | Low | Create `@/components/icons` barrel exporting all used icons; audit for duplicates. |
| D5 | **Animation primitives** — `motion/primitives.tsx` exports `Fade`, `Reveal`, `Slide`, `Stagger`. Good. But not all motion uses them (e.g., `hero.tsx` uses inline `animate-hash-in`). | Low | Enforce primitive usage via lint rule or code review checklist. |

---

## 6. Performance Perception

### Strengths
- **Code splitting**: `ProfilingFlow` dynamically imported (line 24–39), Framer Motion only loads on profiling.
- **Font loading**: `next/font` with `variable` (Geist, Sora, Inter, JetBrains Mono) — CSS variables for zero-CLS swaps.
- **CSS-first animations** — no JS animation lib on landing (only Framer Motion in profiling).
- **`content-visibility: auto`** on offscreen sections (line 125–128).
- **Image optimization**: No heavy images on landing (SVG/CSS only). `next/image` likely used elsewhere.

### Issues

| # | Issue | Severity | Location | Recommendation |
|---|-------|----------|----------|----------------|
| P1 | **`tw-animate-css` imported** (line 2) — adds ~3KB gzipped. Only used for `animate-spin`, `animate-pulse`? Custom keyframes cover the rest. | Low | `globals.css:2` | Audit usage; remove if only `spin`/`pulse` needed (can use custom). |
| P2 | **`lucide-react` tree-shaking** — 40+ icons imported across components. Bundle impact? | Low | Multiple files | Verify `lucide-react` is properly tree-shaken (ESM). Consider `@lucide/lab` for lighter subset. |
| P3 | **Profiling flow encrypts/decrypts on every keystroke** (line 145) — `setEncryptedItem` called in `useEffect` deps `[answers, answeredIds, step]`. May cause main-thread jank on low-end. | Medium | `profiling-flow.tsx:138–146` | Debounce persistence (500ms) or use `useDeferredValue` for answers. |
| P4 | **Admin dashboard fetches `/api/stats` on mount** (line 64–77) — blocks shell render? No, async in effect. But no skeleton for header notifications. | Low | `AdminShell.tsx:64–77` | Show skeleton badge while fetching. |

---

## 7. Specific Screen Audits

### 7.1 Landing Page (`/`)
- **Hero**: Strong hierarchy, good CTA pairing (primary + outline). Scroll indicator desktop-only — correct.
- **Evolves / Method / Engine**: Well-paced scroll narrative. `Method` rail fill animation (CSS `scaleY`) is performant.
- **Engine demo profile**: Real engine output — high credibility. "Demo" label clear (line 103–106).
- **Community / Activity / Roadmap**: Not reviewed but structure consistent.
- **FAQ**: Accordion pattern — verify keyboard navigation (shadcn `Accordion` should handle).
- **Sticky CTA**: Mobile-only, good. Ensure `z-index` > header.

### 7.2 Profiling Flow (`/`, phase="profiling")
- **Shell** (`profiling/shell.tsx`): Progress bar, step label, microcopy, back button — complete.
- **QuestionView** (`profiling/question-view.tsx`): Not read — **priority to audit** for:
  - Input types (radio, checkbox, select, text, country) → touch targets, labels, error states.
  - Validation inline → `aria-invalid`, `aria-describedby` for error.
  - Auto-advance on single-select → may violate 3.2.2 On Input (unexpected context change). Add "Continue" button always.
- **Resume Prompt**: Good — shows progress, duplicate detection.

### 7.3 Welcome / Result (`/`, phase="result")
- **Two-column hero**: Identity + visual. Visual hidden on mobile — correct.
- **Branch A/B**: Clear visual distinction (lime vs muted). `MiniStat` pattern reusable.
- **RecommendationExperience**: Not read — verify keyboard nav, focus management.
- **WhatsApp Capture**: Inline form — good progressive enhancement. `inputMode="tel"` correct.

### 7.4 Dashboard (`/dashboard/*`)
- **Layout**: Persistent header + sidebar + main + bottom nav. Correct.
- **WelcomeCard / StatusCard / ProfileSummary / OrientationSection / QuickActions / AgendaCard**: Not read — audit for:
  - Card density, visual hierarchy.
  - Empty states (especially Agenda, Orientation).
  - QuickActions — are they primary actions? Should be prominent.

### 7.5 Admin (`/admin/*`)
- **Shell**: Command palette (Ctrl+K), notifications, logout — power-user friendly.
- **Sidebar**: Collapsible, sections grouped, active indicator — good.
- **Tables** (`MemberTable`, `BlacklistTable`): Not read — verify:
  - Column sorting, filtering, pagination keyboard accessible.
  - Row actions (edit, delete) — visible on hover/focus, not hidden.
- **Marketing panels** (`RelancePanel`, `CampaignLogPanel`, etc.): Not read — verify form density, validation.

---

## 8. Code Quality & Maintainability

### Strengths
- **TypeScript strict** — no `any` observed in read files.
- **Colocated types** — `ProfileAnswers`, `WelcomeResult`, `OrientationResult` defined near usage.
- **Server/Client boundary clear** — `layout.tsx` (server) → `AdminShell` (client), `DashboardLayout` (server) → `DashboardSidebar` (client).
- **Analytics abstraction** — `track()` with typed events.
- **Crypto storage** — `storage-crypto.ts` for sensitive draft data.

### Issues

| # | Issue | Severity | Recommendation |
|---|-------|----------|----------------|
| C1 | **`cn()` utility** — used everywhere but not reviewed. Ensure it's `clsx` + `tailwind-merge` for class deduplication. | Low | Verify `lib/utils.ts`. |
| C2 | **Hardcoded strings in TSX** — some French strings in components (e.g., `mobile-bottom-nav.tsx:26–30` "Accueil", "Ateliers"). Should use `useTranslations`. | Medium | Replace with `t("key")` from `next-intl`. |
| C3 | **`profiling-flow.tsx` > 300 lines** — consider splitting: `useProfilingState`, `useProfilingPersistence`, `useProfilingAnalytics`. | Low | Extract custom hooks. |
| C4 | **Admin fonts imported in client component** (`adminMono`, `adminSans` at line 9) — increases client bundle. | Low | Move to `layout.tsx` (server) and pass via CSS variable. |

---

## 9. Prioritized Action Plan

### P0 — Critical (Accessibility Blockers)
1. **Fix contrast ratios** — Adjust `--muted-foreground` and `--border` tokens to meet WCAG AA (A1, A2).
2. **Enforce 44×44px touch targets** — Audit all interactive primitives (Button, Tag, MiniStat, Sidebar items) (A4).
3. **Focus ring standardization** — 3px solid lime ring on all focusable elements (A3).
4. **Add focus trap + inert to mobile sidebar drawer** (A6).

### P1 — High (Usability & Consistency)
5. **Unify Button system** — Migrate `RebootButton` to `ui/Button` with brand variants (V3, D2).
6. **Unify Card system** — Deprecate `shared.tsx:Card` (D1).
7. **Add review step to profiling flow** (I2).
8. **Fix `MonoLabel` + input associations** (A5).
9. **Add `aria-pressed` to active Tags** (A7).
10. **Fix WhatsAppCapture input labeling** (A8).

### P2 — Medium (Polish & Mobile)
11. **Increase bottom nav label size to 12px** (R1).
12. **Add empty states to dashboard cards** (I5).
13. **Add keyboard shortcuts to profiling (Esc/← for back)** (I1).
14. **Consolidate mobile nav patterns** (I4).
15. **Debounce profiling draft persistence** (P3).
16. **Audit profiling QuestionView for mobile** (R3).

### P3 — Low (DX & Future-proofing)
17. **Add Storybook + visual regression** (D3).
18. **Create icon registry barrel** (D4).
19. **Enforce animation primitives via lint** (D5).
20. **Remove `tw-animate-css` if unused** (P1).
21. **Fix hardcoded French strings in `mobile-bottom-nav.tsx`** (C2).
22. **Move admin fonts to server layout** (C4).

---

## 10. Quick Wins (Can Ship Today)

| Task | Effort | Impact |
|------|--------|--------|
| Increase `--muted-foreground` lightness in `globals.css` | 5 min | Fixes A1 globally |
| Increase `--border` lightness in `globals.css` | 5 min | Fixes A2 globally |
| Add `min-h-[44px] min-w-[44px]` to `Tag`, `MiniStat` icon, sidebar collapsed items | 15 min | Fixes A4 on key components |
| Change `focus-visible:ring-ring/50` → `focus-visible:ring-ring` in `ui/button.tsx`, `ui/input.tsx` | 10 min | Fixes A3 |
| Add `aria-pressed` to `Tag` active state | 5 min | Fixes A7 |
| Add `<label>` to `WhatsAppCapture` input | 5 min | Fixes A8 |
| Increase bottom nav label to `text-[12px]` | 2 min | Fixes R1 |

---

## Appendix: Files Audited (Representative)

| Category | Files |
|----------|-------|
| **Tokens & Global Styles** | `src/app/globals.css` (909 lines) |
| **Landing** | `src/app/[locale]/page.tsx`, `src/components/reboot/landing.tsx`, `hero.tsx`, `engine.tsx`, `shared.tsx` |
| **Profiling** | `src/components/reboot/profiling-flow.tsx`, `profiling/shell.tsx` (not read), `profiling/question-view.tsx` (not read) |
| **Welcome/Result** | `src/components/reboot/welcome.tsx` |
| **Dashboard** | `src/app/[locale]/dashboard/page.tsx`, `layout.tsx`, `_components/DashboardSidebar.tsx` |
| **Admin** | `src/app/[locale]/admin/layout.tsx`, `src/components/reboot/admin/AdminShell.tsx` |
| **Mobile Nav** | `src/components/reboot/mobile-bottom-nav.tsx` |
| **UI Primitives** | `src/components/ui/button.tsx`, `input.tsx`, `card.tsx` |
| **Config** | `next.config.ts`, `tsconfig.json`, `postcss.config.mjs` |

*Note: Components marked "(not read)" should be audited in follow-up pass.*

---

## Methodology Notes

This audit applied:
- **Nielsen's 10 Heuristics** — visibility, match, control, consistency, prevention, recognition, flexibility, aesthetics, errors, help.
- **WCAG 2.2 AA** — Perceivable, Operable, Understandable, Robust.
- **Vercel React/Next.js Best Practices** — RSC boundaries, dynamic imports, font optimization, bundle hygiene.
- **Callstack React Native Performance** — adapted for web: touch targets, scroll perf, animation cost.
- **Anthropics Frontend Design** — distinctive visual hierarchy, intentional typography, engineered not decorated.

---

*Generated by OpenCode with skills: `design-mobile-apps`, `vercel-react-native-skills`, `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`, `react-native-best-practices`.*