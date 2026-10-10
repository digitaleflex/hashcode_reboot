# Issues détaillées — Audit UI/UX (2026-10-10)

> Issues dérivées de `AUDIT_UI_UX.md`. Format compatible avec le workflow agent (lire issue → plan → PR → validation).

---

## 🔴 P0 — Blocage accessibilité

### #UI-001 — Contraste texte `--muted-foreground` échoue AA (4.5:1)

**Priorité :** 🔴 P0  
**Composants :** `globals.css`, `shared.tsx`, `landing.tsx`, `welcome.tsx`, `dashboard/*`

**Problème :** `--muted-foreground` = `oklch(0.70 0.02 240)` sur fond `--card` (`oklch(0.20 0 0)`) donne ~3.8:1 — échoue WCAG AA (normal text 4.5:1). Même problème sur `--background` (0.16) et `--secondary` (0.24).

**Acceptation :**
- [ ] `--muted-foreground` ≥ `oklch(0.78 0.02 240)` OU `--card` ≤ `oklch(0.16 0 0)`
- [ ] Vérifier contraste `.mono-label`, `.soft-note`, `.eyebrow-mono` sur leurs fonds respectifs
- [ ] Aucune régression sur `focus-lime` (ring doit rester visible)

**Fichiers :** `src/app/globals.css` (lignes 60–102, 201–208)

---

### #UI-002 — Contraste bordure `--border` échoue Non-text AA (3:1)

**Priorité :** 🔴 P0  
**Composants :** `globals.css`, `shared.tsx`, `ui/card.tsx`

**Problème :** `--border` = `oklch(0.31 0 0)` sur `--card` (0.20) donne ~2.1:1 — échoue WCAG AA Non-text Contrast.

**Acceptation :**
- [ ] `--border` ≥ `oklch(0.38 0 0)` OU `--card` ≤ `oklch(0.16 0 0)`
- [ ] Vérifier `.hairline`, `.divider-grad`, `Card` shadcn, `DashboardSidebar`
- [ ] Vérifier que `--input` reste cohérent (`--border` et `--input` aliasés)

**Fichiers :** `src/app/globals.css:84`, `shared.tsx:130`, `ui/card.tsx:9`

---

### #UI-003 — Touch targets < 44×44px sur éléments interactifs

**Priorité :** 🔴 P0  
**Composants :** `shared.tsx:Tag`, `shared.tsx:RebootButton:sm`, `welcome.tsx:MiniStat`, `DashboardSidebar:NavLink`

**Problème :** `Tag` (ligne 186) : `py-2` ≈ 32px hauteur. `MiniStat` icône `size-8` = 32px. `RebootButton:sm` = `h-11` (44px) mais sans `min-w-[44px]`. `NavLink` collapsed = `px-0 py-2` ≈ 32px largeur.

**Acceptation :**
- [ ] `Tag`: `min-h-[44px] min-w-[44px]` sur bouton + `min-h-[44px]` sur span
- [ ] `MiniStat` icône container: `size-11` minimum ou `min-h-[44px]`
- [ ] `NavLink` collapsed: `w-11 min-h-[44px]`
- [ ] `RebootButton`: ajouter `min-w-[44px]` sur taille `sm`
- [ ] Vérifier `mobile-bottom-nav.tsx` — items doivent avoir `min-h-[44px]` (déjà `min-h-[56px]` parent, `flex-1` items ≈ 56px ok)

**Fichiers :** `src/components/reboot/shared.tsx` (Tag 174, MiniStat non présent ici — `welcome.tsx`), `DashboardSidebar.tsx`

---

### #UI-004 — Focus ring standardisation (solid lime 3px)

**Priorité :** 🔴 P0  
**Composants :** `ui/button.tsx`, `ui/input.tsx`, `ui/card.tsx`, `globals.css`

**Problème :** `focus-visible:ring-ring/50` (lime 50% opacité) + `focus-visible:ring-[3px]`. À 50% sur fond sombre (~0.16), contraste ≈ 1.8:1 — échoue 3:1 contre fond et 3:1 contre adjacent.

**Acceptation :**
- [ ] `ui/button.tsx`: remplacer `/50` par `/100` ou supprimer opacité dans `focus-visible` variants
- [ ] `ui/input.tsx`: même correction
- [ ] `globals.css`: `.focus-lime` doit être `outline: 2px solid var(--primary)` (déjà solide) — ajouter variante `focus-lime-3px`
- [ ] Vérifier que `focus-visible` fonctionne sur tous les éléments `Tab`, `Tag`, `RebootButton`

**Fichiers :** `src/components/ui/button.tsx:8`, `src/components/ui/input.tsx:12`, `globals.css:247–250`

---

### #UI-005 — Focus trap sur drawer mobile sidebar

**Priorité :** 🔴 P0  
**Composants :** `DashboardSidebar.tsx`

**Problème :** Drawer mobile (ligne 224–252) s'ouvre sans `inert` sur le fond. Focus reste dans le contenu arrière. `Escape` ferme (ligne 122–129) mais pas de retour au bouton d'ouverture.

**Acceptation :**
- [ ] Ajouter `inert` sur `<main>` et `<header>` quand `mobileOpen` = true
- [ ] Après fermeture (`Escape` ou clic overlay), déplacer focus vers bouton hamburger (`aria-controls`)
- [ ] Vérifier `tab` ne passe pas derrière le drawer quand ouvert

**Fichiers :** `src/app/[locale]/dashboard/_components/DashboardSidebar.tsx` (lignes 122–252)

---

## 🟠 P1 — Usabilité et cohérence

### #UI-006 — Unifier système Button : `RebootButton` consomme `ui/Button`

**Priorité :** 🟠 P1  
**Composants :** `shared.tsx`, `ui/button.tsx`

**Problème :** Deux boutons — `RebootButton` (manuel, pas d'`asChild`, styles brand) et `Button` (cva, Slot, Radix, styles shadcn). `RebootButton` ne supporte pas `<Link>` natif (doit utiliser `<a>` externe dans `ExternalCta` séparé). Duplication de styles et logique.

**Acceptation :**
- [ ] Créer variantes `brand-primary`, `brand-outline`, `brand-ghost` dans `buttonVariants` (`ui/button.tsx`)
- [ ] `RebootButton` devient wrapper fin : `return <Button variant={...} size={...} className={cn(...)} />`
- [ ] `RebootButton` conserve `size="sm/md/lg"` et `variant="primary/outline/ghost"` (mapping direct)
- [ ] `ExternalCta` devient `<Button asChild><a>...</a></Button>` ou reste séparé mais consomme `Button`
- [ ] Vérifier que `focus-lime` s'applique toujours (via `className` ou via `buttonVariants` override)

**Fichiers :** `src/components/reboot/shared.tsx` (14–59, 133–170), `src/components/ui/button.tsx`

---

### #UI-007 — Unifier système Card : `shared:Card` → `ui/Card`

**Priorité :** 🟠 P1  
**Composants :** `shared.tsx`, `ui/card.tsx`

**Problème :** `Card` reboot (`rounded-md`, `border-border/60`, `bg-card/40`, pas de padding) vs `Card` shadcn (`rounded-xl`, `border`, `bg-card`, `gap-6`, `py-6`, padding `px-6`). Même nom, sémantique différente.

**Acceptation :**
- [ ] Déprécier `shared.Card` ou le renommer `BrandCard`
- [ ] `shared.Card` devient wrapper de `ui/Card` avec `variant="brand"` (par défaut `rounded-md`, `bg-card/40`)
- [ ] Vérifier usages dans `landing/*.tsx`, `welcome.tsx`, `dashboard/*.tsx`
- [ ] Aucun `rounded-xl` brand non intentionnel

**Fichiers :** `src/components/reboot/shared.tsx:238–252`, `src/components/ui/card.tsx`

---

### #UI-008 — Profiling : ajouter étape de revue avant soumission

**Priorité :** 🟠 P1  
**Composants :** `profiling-flow.tsx`

**Problème :** Aucune vue récapitulative avant `handleSubmit`. L'utilisateur ne voit pas toutes ses réponses en un coup d'œil. Risque d'erreur non détectée.

**Acceptation :**
- [ ] Créer `ProfileReview` (réutiliser `ProfilePreview` déjà existant dans `profiling/preview.tsx` si adapté)
- [ ] Quand `threeMonthGoal` atteint, au lieu de passer directement à `preview`, passer à `review`
- [ ] `ProfileReview` affiche : nom, domaine, niveau, objectif, style d'apprentissage, intérêt mentorat, tags
- [ ] Bouton "Modifier" → revient à question correspondante (`goBack` ciblé)
- [ ] Bouton "Confirmer" → `handleSubmit`
- [ ] Si `answers.email` vide → alerter avant confirmation (déjà géré par validation ?)

**Fichiers :** `src/components/reboot/profiling-flow.tsx` (232–247, 267–279), `src/components/reboot/profiling/preview.tsx`

---

### #UI-009 — Profiling : raccourcis clavier (Escape / ← pour retour)

**Priorité :** 🟠 P1  
**Composants :** `profiling-flow.tsx`

**Problème :** Aucune navigation clavier. L'utilisateur doit cliquer sur le bouton retour. Pas d'accès rapide.

**Acceptation :**
- [ ] `keydown` listener global dans `ProfilingFlow`: `Escape` = `goBack()` si `phase === "questions"`; `ArrowLeft` = `goBack()` si pas dans un `textarea` ou `input`
- [ ] Ne déclenche pas si `showResumePrompt` actif (priorité au prompt)
- [ ] `focus-visible` doit rester fonctionnel après `keydown`
- [ ] Vérifier `useReducedMotion` — aucun impact

**Fichiers :** `src/components/reboot/profiling-flow.tsx` (202–215)

---

### #UI-010 — Profiling : `MonoLabel` + input associations (`aria-labelledby`)

**Priorité :** 🟠 P1  
**Composants :** `profiling/question-view.tsx` (non lu — audité par convention)

**Problème :** Les labels sont visuels (`MonoLabel`) mais non associés programmaticalement aux champs (`aria-labelledby` ou `label for`). Les lecteurs d'écran ne peuvent pas annoncer le label correctement.

**Acceptation :**
- [ ] Chaque `MonoLabel` dans `question-view.tsx` doit avoir un `id` (ex: `label-${question.id}`)
- [ ] Chaque `input`/`textarea`/`select` doit avoir `aria-labelledby={labelId}`
- [ ] Si `label` HTML natif utilisé, ajouter `htmlFor={labelId}`
- [ ] Vérifier `error` message : doit avoir `aria-describedby` pointant vers un `id` d'erreur

**Fichiers :** `src/components/reboot/profiling/question-view.tsx` (inféré — audit complémentaire requis)

---

### #UI-011 — `Tag` : `aria-pressed` pour état actif

**Priorité :** 🟡 P2 (promu P1 si audit strict)  
**Composants :** `shared.tsx`

**Problème :** Quand `Tag` a `onClick`, il rend `<button>` mais pas d'`aria-pressed`. Quand `active`, pas d'état sémantique.

**Acceptation :**
- [ ] Quand `onClick` présent : `aria-pressed={!!active}`
- [ ] Quand `onClick` absent (span statique) : `role="status"` ou pas d'`aria-pressed`
- [ ] Vérifier que `focus-lime` reste visible sur `Tag` bouton

**Fichiers :** `src/components/reboot/shared.tsx:185–203`

---

### #UI-012 — `WhatsAppCapture` : label visible sur input téléphone

**Priorité :** 🟡 P2 (promu P1 si audit strict)  
**Composants :** `welcome.tsx`

**Problème :** `input` (ligne 453) a `placeholder` et `aria-label` mais aucun `<label>` visible. `MonoLabel` au-dessus n'est pas lié.

**Acceptation :**
- [ ] Ajouter `id="whatsapp-label"` sur `MonoLabel` du titre du formulaire
- [ ] Ou ajouter `<label htmlFor="whatsapp-phone">` visible au-dessus du champ
- [ ] `input` doit avoir `aria-labelledby={labelId}`
- [ ] Vérifier contraste du label sur fond `bg-card/25`

**Fichiers :** `src/components/reboot/welcome.tsx` (387–485)

---

### #UI-013 — Profiling `QuestionView` : audit mobile et touch targets

**Priorité :** 🟠 P1  
**Composants :** `profiling/question-view.tsx`

**Problème :** Non lu dans l'audit principal. Nécessaire pour vérifier que chaque type de question respecte 44×44px, a un focus visible, et s'adapte au mobile (pas de scroll horizontal, labels lisibles).

**Acceptation :**
- [ ] Audit du fichier : vérifier 5 types de question (single, multi, text, country, email)
- [ ] Chaque bouton/radio cochable : `min-h-[44px] min-w-[44px]`
- [ ] Input texte : `min-h-[44px] px-3`
- [ ] Aucun `overflow-x` au niveau du composant
- [ ] Message d'erreur : `aria-live="polite"` et `aria-describedby`

**Fichiers :** `src/components/reboot/profiling/question-view.tsx`

---

## 🟡 P2 — Amélioration

### #UI-014 — Mobile bottom nav : taille texte 11px → 12px

**Priorité :** 🟡 P2  
**Composants :** `mobile-bottom-nav.tsx`

**Acceptation :** `className` ligne 77 : `text-[11px]` → `text-[12px]`. Vérifier lisibilité.

---

### #UI-015 — Dashboard : états vides (`AgendaCard`, `OrientationSection`)

**Priorité :** 🟡 P2  
**Composants :** `dashboard/_components/*`

**Acceptation :**
- [ ] Quand pas d'événements : illustration/icône + texte explicatif + CTA vers `/evenements`
- [ ] Quand orientation non évaluée : message + bouton vers profil
- [ ] Vérifier que `EmptyState` réutilise un composant existant (`empty-events-state.tsx` peut servir d'inspiration)

---

### #UI-016 — Profiling : navigation mobile du drawer admin

**Priorité :** 🟡 P2  
**Composants :** `AdminShell` + `mobile-bottom-nav`

**Problème :** `AdminShell` utilise `MobileBottomNav` (ligne 171) mais `AdminSidebar` n'a pas de version mobile drawer. Les 5 items du bottom nav admin couvrent-ils tout ? Non — `AdminSidebar` a 10 sections.

**Acceptation :**
- [ ] Vérifier que `ADMIN_ITEMS` couvre toutes les sections nécessaires OU
- [ ] Créer `AdminSidebarMobileDrawer` (similaire à `DashboardSidebar` mobile drawer)
- [ ] Ou étendre `ADMIN_ITEMS` avec toutes les sections admin

---

## 📋 Définition du Fait (pour toutes les issues P0/P1)

Pour chaque issue, la définition du fait suit le modèle agent (`AI-AGENT-OPERATING-MODEL.md`) :

1. **Lecture issue + liens**
2. **Audit existant** (`AUDIT_UI_UX.md` + code lu)
3. **Plan court** (dans session)
4. **Implémentation bornée** (un seul domaine, pas de migrations DB ici)
5. **Tests / validation** (visuel + contraste mesuré + a11y axe ou lighthouse)
6. **PR** avec preuve d'acceptation (screenshot avant/après ou résultat axe)
7. **Validation** par humain

---

*Généré le 2026-10-10. Issues alignées sur `AUDIT_UI_UX.md`. Priorité 🔴 = livraison immédiate, 🟠 = sprint 2, 🟡 = backlog.*
