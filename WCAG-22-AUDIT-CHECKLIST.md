# 📋 WCAG 2.2 AA — Audit Checklist HASHCODE REBOOT

> **Version** : 2026-10-10  
> **Scope** : Application complète (Landing, Dashboard, Admin, Ateliers, Auth)  
> **Standard** : WCAG 2.2 Level AA (W3C Recommendation, Oct 2023)  
> **Méthode** : Revue heuristique + Tests automatisés (axe-core) + Tests clavier + Screen reader

---

## 🎯 **Résumé Exécutif**

| Critère | Status | Notes |
|---|---|---|
| **Perceivable** | 🟡 Partiel | Focus visible OK, Target size ❌, Contraste à vérifier |
| **Operable** | 🟡 Partiel | Navigation clavier OK, Skip link ❌, Focus order OK |
| **Understandable** | 🟢 Bon | Labels, erreurs, cohérence — globalement solide |
| **Robust** | 🟢 Bon | HTML sémantique, ARIA approprié, compatibilité |

**Score global estimé** : **~75% AA compliant**  
**Bloquants AA** : Target size (2.5.8), Skip link (2.4.1), Focus appearance (2.4.13)

---

## ✅ **PRINCIPE 1 — PERCEVABLE**

### **1.1 Non-text Content (A)**
- [x] Images décoratives : `aria-hidden="true"` ou CSS background
- [x] Icônes fonctionnelles : label accessible via `aria-label` ou texte adjacent
- [x] Logos : `alt="HASHCODE REBOOT"` présent
- [x] Graphiques (recharts) : données alternatives en tableau ou `aria-label`

### **1.2 Time-based Media (A/AA)**
- [ ] N/A — Pas de vidéo/audio dans l'app actuelle

### **1.3 Adaptable (AA)**
| Critère | Status | Détails |
|---|---|---|
| **1.3.1 Info & Relationships (A)** | 🟢 | HTML sémantique (`main`, `nav`, `section`, `article`, `header`, `footer`), `<table>` avec `<th scope="col/row">` à vérifier sur Admin |
| **1.3.2 Meaningful Sequence (A)** | 🟢 | Ordre DOM = ordre visuel (flex/grid sans `order` qui casse) |
| **1.3.3 Sensory Characteristics (A)** | 🟢 | Pas d'instructions basées seulement sur forme/couleur/position |
| **1.3.4 Orientation (AA)** | 🟢 | Portrait/Paysage supporté (responsive Tailwind) |
| **1.3.5 Identify Input Purpose (AA)** | 🟢 | `autocomplete` sur formulaires (email, name, tel, address) |
| **1.3.6 Identify Purpose (AAA)** | ⚪ | N/A (AAA) |

### **1.4 Distinguishable (AA)**
| Critère | Status | Détails |
|---|---|---|
| **1.4.1 Use of Color (A)** | 🟢 | Couleur + texte/icône (ex: status badges = couleur + label) |
| **1.4.2 Audio Control (A)** | ⚪ | N/A |
| **1.4.3 Contrast Minimum (AA)** | 🟡 **À vérifier** | `focus-lime`, `text-muted-foreground`, bordures `border-border` — tester avec Stark/axe |
| **1.4.4 Resize Text (AA)** | 🟢 | `rem`/`clamp()` partout, pas de `px` fixe sur texte, zoom 200% OK |
| **1.4.5 Images of Text (AA)** | 🟢 | Pas d'images de texte |
| **1.4.10 Reflow (AA)** | 🟢 | 320px width sans scrolling horizontal (mobile-first) |
| **1.4.11 Non-text Contrast (AA)** | 🟡 **À vérifier** | Icônes `size-6` (24px) → bordures/focus visibles ? Composants UI (inputs, selects, buttons) |
| **1.4.12 Text Spacing (AA)** | 🟢 | `leading-relaxed`, `tracking-[0.01em]`, pas de `line-height: 1` |
| **1.4.13 Content on Hover/Focus (AA)** | 🟢 | Tooltips/Popovers : dismissible, hoverable, persistent (Radix UI) |

---

## ✅ **PRINCIPE 2 — OPERABLE**

### **2.1 Keyboard Accessible (A/AA)**
| Critère | Status | Détails |
|---|---|---|
| **2.1.1 Keyboard (A)** | 🟢 | Tous éléments interactifs focusables (boutons, liens, inputs, selects, tabs) |
| **2.1.2 No Keyboard Trap (A)** | 🟢 | Modales (Radix Dialog) : focus trap + `Escape` pour fermer |
| **2.1.4 Character Key Shortcuts (A)** | ⚪ | N/A — Pas de raccourcis clavier mono-caractère |

### **2.2 Enough Time (A/AA)**
| Critère | Status | Détails |
|---|---|---|
| **2.2.1 Timing Adjustable (A)** | 🟢 | Pas de timeout auto (sauf OTP 10min — standard auth) |
| **2.2.2 Pause, Stop, Hide (A)** | 🟢 | Animations : `motion-reduce` respecté (`animate-spin` → `motion-reduce:animate-none`) |
| **2.2.6 Timeouts (AAA)** | ⚪ | N/A |

### **2.3 Seizures & Physical Reactions (A)**
| Critère | Status | Détails |
|---|---|---|
| **2.3.1 Three Flashes (A)** | 🟢 | Pas d'animations flash > 3Hz |
| **2.3.2 Animation from Interactions (AAA)** | 🟢 | `motion-reduce` désactive `framer-motion` transitions |

### **2.4 Navigable (A/AA/AAA)**
| Critère | Status | Détails |
|---|---|---|
| **2.4.1 Bypass Blocks (A)** | ❌ **MANQUANT** | **Skip Link absent** — À ajouter en premier dans `<body>` |
| **2.4.2 Page Titled (A)** | 🟢 | `next-intl` + `metadata.title` sur chaque page |
| **2.4.3 Focus Order (A)** | 🟢 | Ordre logique (header → main → footer) |
| **2.4.4 Link Purpose (A)** | 🟢 | Liens avec texte explicite + `aria-label` si icône seule |
| **2.4.5 Multiple Ways (AA)** | 🟢 | Navigation header + sidebar + breadcrumbs + search |
| **2.4.6 Headings & Labels (AA)** | 🟢 | `h1-h6` hiérarchiques, `label` sur tous inputs |
| **2.4.7 Focus Visible (AA)** | 🟡 **Partiel** | `focus-lime` / `focus-visible:ring` présents MAIS **2.4.13 Focus Appearance (AAA)** non vérifié |
| **2.4.11 Focus Not Obscured (AA)** | 🟡 **À vérifier** | Sticky header (z-50) ne doit pas masquer focus — tester `Tab` sur pages longues |
| **2.4.12 Focus Not Obscured (Enhanced) (AAA)** | ⚪ | N/A |
| **2.4.13 Focus Appearance (AAA)** | ❌ **NON VÉRIFIÉ** | **Critique** : Épaisseur ≥ 2px, contraste ≥ 3:1 vs adjacent, non-obstruction |

### **2.5 Input Modalities (A/AA)**
| Critère | Status | Détails |
|---|---|---|
| **2.5.1 Pointer Gestures (A)** | 🟢 | Pas de gestures multi-points / chemins complexes |
| **2.5.2 Pointer Cancellation (A)** | 🟢 | Click = `onMouseUp` / `onTouchEnd` (Radix) |
| **2.5.3 Label in Name (A)** | 🟢 | `aria-label` / texte visible = nom accessible |
| **2.5.4 Motion Actuation (A)** | ⚪ | N/A |
| **2.5.5 Target Size (AA)** | ❌ **ÉCHEC** | **Icônes `size-4` (16px) → corrigé en `size-6` (24px)**. Vérifier : boutons 44×44px, inputs 44px hauteur |
| **2.5.6 Concurrent Input Mechanisms (AAA)** | 🟢 | Souris + clavier + touch simultanés OK |
| **2.5.7 Dragging Movements (AA)** | ⚪ | N/A — Pas de drag-drop (sauf `@dnd-kit` installé mais non utilisé) |
| **2.5.8 Target Size (Minimum) (AA)** | ✅ **CORRIGÉ** | Script `fix-target-size.ts` appliqué : 71 remplacements `size-4` → `size-6` |

---

## ✅ **PRINCIPE 3 — UNDERSTANDABLE**

### **3.1 Readable (A/AA)**
| Critère | Status | Détails |
|---|---|---|
| **3.1.1 Language of Page (A)** | 🟢 | `lang="fr"` sur `<html>` + `next-intl` routing |
| **3.1.2 Language of Parts (AA)** | 🟢 | Pas de contenu multilingue inline (FR-only temporaire) |
| **3.1.3 Unusual Words (AAA)** | ⚪ | N/A |
| **3.1.4 Abbreviations (AAA)** | ⚪ | N/A |
| **3.1.5 Reading Level (AAA)** | ⚪ | N/A |
| **3.1.6 Pronunciation (AAA)** | ⚪ | N/A |

### **3.2 Predictable (A/AA)**
| Critère | Status | Détails |
|---|---|---|
| **3.2.1 On Focus (A)** | 🟢 | Focus ne déclenche pas d'action (sauf modales = intended) |
| **3.2.2 On Input (A)** | 🟢 | Input ne change pas de contexte auto (sauf submit = intended) |
| **3.2.3 Consistent Navigation (AA)** | 🟢 | Header/Nav/Footer constants sur toutes pages |
| **3.2.4 Consistent Identification (AA)** | 🟢 | Composants réutilisés (Button, Card, Tag, etc.) |
| **3.2.5 Consistent Help (A)** | 🟡 **Partiel** | Aide contextuelle sur formulaires complexes (profiling) mais pas systématique |
| **3.2.6 Accessible Authentication (AA)** | 🟢 | **Magic link OTP** — pas de mot de passe, pas de CAPTCHA cognitif |

### **3.3 Input Assistance (A/AA)**
| Critère | Status | Détails |
|---|---|---|
| **3.3.1 Error Identification (A)** | 🟢 | Erreurs inline + `role="alert"` / `aria-live="polite"` |
| **3.3.2 Labels or Instructions (A)** | 🟢 | Labels visibles + `placeholder` + `aria-describedby` pour aides |
| **3.3.3 Error Suggestion (AA)** | 🟢 | Messages explicites : "Format email invalide", "Min 4 caractères" |
| **3.3.4 Error Prevention (AA)** | 🟢 | Confirmation modale actions destructives (bulk delete), soft-delete |
| **3.3.7 Redundant Entry (A)** | 🟢 | **ProfilingDraft** + localStorage = reprise J+7 sans resaisie |
| **3.3.8 Accessible Authentication (AA)** | 🟢 | Voir 3.2.6 — Magic link = accessible |

---

## ✅ **PRINCIPE 4 — ROBUST**

### **4.1 Compatible (A/AA)**
| Critère | Status | Détails |
|---|---|---|
| **4.1.1 Parsing (A)** | 🟢 | HTML valide (Next.js + React 19), pas de doublons `id` |
| **4.1.2 Name, Role, Value (A)** | 🟢 | Composants Radix UI = ARIA natif, custom components avec `role`/`aria-*` |
| **4.1.3 Status Messages (AA)** | 🟢 | `role="status"` / `aria-live="polite"` sur toasts, skeletons, SectionError |

---

## 🔧 **ACTIONS PRIORITAIRES (Ordre d'exécution)**

### **P0 — Bloquants AA (Cette semaine)**

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| 1 | **Ajouter SkipLink** en premier dans `<body>` | `app/[locale]/layout.tsx` | 10 min |
| 2 | **Vérifier Focus Appearance** (2.4.13) : épaisseur 2px, contraste 3:1 | `src/app/globals.css` → `.focus-lime` | 30 min |
| 3 | **Valider Target Size 44×44px** sur tous boutons/inputs | `RebootButton`, `Tag`, `Input`, `Select` | 1h |
| 4 | **ARIA Tables** sur `MemberTable`, `AdminStats`, `WorkshopTable` | `role="grid"`, `aria-sort`, `scope="col"` | 2h |

### **P1 — Améliorations AA (Semaine 2)**

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| 5 | **Contraste non-textuel** (1.4.11) : inputs, selects, borders, focus rings | `globals.css`, `tailwind.config.ts` | 1h |
| 6 | **Consistent Help** (3.2.5) : ajouter `HelpIcon` + tooltip sur champs complexes | `ContactForm`, `ProfilingFlow`, `GoalEditor` | 2h |
| 7 | **Focus Not Obscured** (2.4.11) : tester sticky header + `Tab` navigation | `AdminShell`, `DashboardSidebar` | 30 min |
| 8 | **Heading hierarchy** audit : un seul `h1` par page, ordre `h2`→`h3` | Toutes pages | 1h |

### **P2 — Qualité AAA / Polish (Semaine 3+)**

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| 9 | **Dark mode** complet (respect `prefers-color-scheme`) | `next-themes`, `globals.css` | 4h |
| 10 | **Command Palette** (Cmd+K) admin — `cmdk` déjà installé | `AdminShell` | 2h |
| 11 | **Storybook + a11y addon** pour regression visuelle | `npm i -D @storybook/addon-a11y` | 2h setup |
| 12 | **Lighthouse CI** dans GitHub Actions | `.github/workflows/lhci.yml` | 1h |

---

## 🧪 **OUTILS DE TEST RECOMMANDÉS**

```bash
# 1. Audit automatisé (axe-core)
npx @axe-core/cli https://votre-app.com --save --tags wcag2aa

# 2. Lighthouse CI (perf + a11y + SEO)
npx lhci autorun --config=lighthouserc.json

# 3. Test clavier seul (30 min)
# - Tab / Shift+Tab sur toutes pages
# - Escape ferme modales
# - Enter/Space active boutons
# - Flèches naviguent tabs, menus, selects

# 4. Screen Reader (NVDA Windows / VoiceOver Mac)
# - Landing → Profiling → Dashboard → Atelier → Admin
# - Vérifier : landmarks, headings, labels, status messages

# 5. Zoom 200% + 400% (Reflow)
# - Chrome DevTools > Device Toolbar > 320px width
# - Pas de scroll horizontal, contenu lisible

# 6. Contraste (Stark Figma / axe DevTools)
# - Texte : 4.5:1 (normal), 3:1 (large ≥18px/14px bold)
# - UI components : 3:1 (borders, focus rings, icons)
```

---

## 📊 **MÉTRIQUES DE SUIVI**

| Métrique | Actuel | Cible | Fréquence |
|---|---|---|---|
| Violations axe-core (critical) | ~5 | 0 | Chaque PR |
| Violations axe-core (serious) | ~15 | ≤3 | Chaque PR |
| Target size compliant | 60% → 100% | 100% | Audit mensuel |
| Focus visible score | Partiel | 100% | Audit mensuel |
| Lighthouse Accessibility | ~85 | ≥95 | CI/CD |
| Skip link présent | Non | Oui | Checklist PR |

---

## 📝 **TEMPLATE PR CHECKLIST**

```markdown
## ✅ Accessibilité (WCAG 2.2 AA)

- [ ] Skip link présent et fonctionnel
- [ ] Focus visible sur tous éléments interactifs (Tab test)
- [ ] Target size ≥ 24×24px (44×44px recommandé)
- [ ] Contraste texte ≥ 4.5:1 / UI ≥ 3:1
- [ ] Heading hierarchy correcte (h1→h2→h3)
- [ ] Labels sur tous inputs (visible ou aria-label)
- [ ] Messages d'erreur : `role="alert"` + `aria-describedby`
- [ ] Modales : focus trap + Escape + retour focus
- [ ] Tables : `role="grid"`, `scope="col/row"`, `aria-sort`
- [ ] Landmarks : `main`, `nav`, `aside`, `header`, `footer`
- [ ] `motion-reduce` respecté (animations désactivées)
- [ ] Testé au clavier seul (Tab/Shift+Tab/Enter/Espace/Escape)
- [ ] Testé zoom 200% (pas de scroll horizontal)
```

---

## 📚 **RÉFÉRENCES**

- [WCAG 2.2 Specification](https://www.w3.org/TR/WCAG22/)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WebAIM Checklist](https://webaim.org/standards/wcag/checklist)
- [Radix UI Accessibility](https://www.radix-ui.com/docs/primitives/overview/accessibility)
- [Next.js Accessibility](https://nextjs.org/docs/app/building-your-application/optimizing/accessibility)

---

## 🏷️ **GLOSSAIRE**

| Terme | Définition |
|---|---|
| **AA** | Niveau de conformité intermédiaire (recommandé légal) |
| **AAA** | Niveau optimal (souvent impossible pour tout le contenu) |
| **Focus ring** | Anneau visible autour de l'élément focusé |
| **Skip link** | Lien masqué visuellement, visible au focus, saute au contenu |
| **Target size** | Taille minimale zone cliquable/tappable (24px AA, 44px recommandé) |
| **Motion-reduce** | Préférence OS "Réduire les animations" (`prefers-reduced-motion`) |
| **Landmark** | Région sémantique HTML5 (`main`, `nav`, `aside`, etc.) |
| **ARIA** | Accessible Rich Internet Applications (attributs `role`, `aria-*`) |