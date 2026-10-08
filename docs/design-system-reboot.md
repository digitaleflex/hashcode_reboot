# Design System Reboot — consolidation (Issue #127, Phase 1 Agent B)

> Périmètre BORNÉ : consolidation des tokens dark/lime/shadcn **déjà live**.
> Aucune valeur live modifiée (preuve : `git diff` de cette issue ne contient
> que des `+`). Archive historique : `docs/interface-utilisateur.md`
> (lecture seule, ne pas réécrire). Référence d'ordre :
> `docs/roadmap/reboot-execution-order-v2.md` (Phase 1, Agent B).

## 1. Inventaire des tokens (source : `src/app/globals.css`)

Stack : Tailwind v4 (`@theme inline` + `@custom-variant dark`) + shadcn.
Thème sombre unique (`color-scheme: dark`), lime **accent uniquement**.

### 1.1 Couleurs (`:root`, anciennement lignes 60-102)

| Token | Valeur live | Usage | Où |
|---|---|---|---|
| `--background` | oklch(0.16 0 0) VOID | fond de page | `body`, `.shell`, header/footer, sticky-cta |
| `--foreground` | oklch(0.97…) TEXT PRIMARY | texte courant | `body`, titres landing |
| `--card` / `--card-foreground` | oklch(0.20…) SURFACE | cartes, panneaux | `Card` shadcn, engine/community (`bg-card/40`), Alert default |
| `--popover` / `--popover-foreground` | oklch(0.18…) | flottants | dropdown-menu, popover, select, command |
| `--primary` | oklch(0.92 0.21 125) HASH LIME #C5F441 | accent, jamais fond plein | CTA, `text-lime` (alias `--color-lime`), timeline fill, selection |
| `--primary-foreground` | oklch(0.16 0 0) | texte sombre sur lime | Button/Badge default |
| `--secondary` / `-foreground` | oklch(0.24…) ELEVATED | surfaces 2nd, boutons 2nd | Button secondary |
| `--muted` / `--muted-foreground` | #94A3B8 TEXT SECONDARY | hints, descriptions | `.mono-label`, `.soft-note`, CardDescription |
| `--accent` / `--accent-foreground` | oklch(0.27…) | survols, actifs | Button ghost/outline hover, Skeleton (`bg-accent`) |
| `--destructive` | oklch(0.62 0.22 25) | erreurs, danger | Button/Alert destructive, `aria-invalid` rings |
| `--border` = `--input` | oklch(0.31…) #2A2A2A | TOUS les traits 1px | `.hairline`, `.divider-grad`, cards, timeline, inputs |
| `--ring` | lime | focus clavier uniquement | `*` outline, `.focus-lime`, `focus-visible:ring` |
| `--chart-1..5` | lime/bleu/orange/violet/vert | dataviz uniquement | `chart.tsx`, donut-chart |
| `--sidebar*` | — | scope sidebar shadcn | `sidebar.tsx` |

### 1.2 Typographie

| Token | Usage | Où |
|---|---|---|
| `--font-sans` (Geist) | texte courant | `body` |
| `--font-mono` (Geist Mono) | labels techniques | `.mono-label` (12.5px, 0.08em), `.eyebrow-mono`, legendes |
| `--font-display` (Sora) | titres, wordmark | `.font-display`, hero, headings. Scope admin → Inter (`.admin-scope`) |
| `.soft-note` | 13px lisible, remplace les `text-[9px]/[11px]` | hints, notes |
| `.wordmark-tracking` | tracking marque 0.42em + compensation | logo REBOOT |

### 1.3 Spacing & surfaces

| Token / classe | Valeur | Où |
|---|---|---|
| `--radius-sm/md/lg/xl` | 4/6/8/12px, `--radius` 8px | boutons/inputs, cartes, panneaux |
| `.shell` | max 1320px, padding 20/32/40px (base/sm/xl) | conteneur éditorial landing |
| `.section` | padding-block 72/112/144px (base/md/xl) | sections landing |
| `.rails` | grille 4 col, opacité ≤ 4%, desktop-only (`lg:`) | fond landing |
| `--ds-*` (globals.css §2) | **alias documentaires** → tokens live | futurs composants ; changer un token live se propage sans toucher ce bloc |

### 1.4 Focus & états

- `.focus-lime` / `.ds-focus-ring` : outline 2px lime, offset 2px — **tout
  contrôle custom atteignable au clavier DOIT l'appliquer** (Button/Input/
  Badge shadcn l'ont déjà via `focus-visible:ring`).
- États : `.ds-state-success/error` (bordures, `color-mix` sur tokens live),
  `.ds-state-*-ink` (teintes texte), `.ds-loading-bar` (réutilise keyframe
  live `hash-sweep`), `.ds-loading-dot` (`hash-pulse`), `.ds-skeleton-line`
  (géométrie ; base visuelle = `Skeleton` shadcn). `prefers-reduced-motion`
  coupe les animations `.ds-*` (comme les `animate-hash-*` live).

## 2. Composants de référence

### 2.1 shadcn existants — LECTURE SEULE (ne pas modifier les variants)

`button` (cva : default/destructive/outline/secondary/ghost/link ;
~26 imports dans `reboot/`, landing+events+admin — tout changement casse tout),
`badge`, `card`, `input`, `alert`, `progress`, `skeleton`, `form`,
`dialog`, `select`, `tabs`, `accordion`, `sonner`/`toast`, `tooltip`, etc.
(`src/components/ui/*`).

### 2.2 AJOUTS DS-127 (cette issue, seuls fichiers `ui/` modifiables)

| Fichier | Export | Usage (parcours) |
|---|---|---|
| `src/components/ui/feedback.tsx` | `Feedback` + `feedbackVariants` (cva `tone`: info/success/warning/error/loading) | bannières d'état : diagnostic → capture → conversion (soumission, résultat, erreur réseau). `role="alert"` si error/warning, `"status"` sinon ; `aria-busy` si loading ; icônes lucide (`Loader2` + `animate-spin` si loading) |
| `src/components/ui/form-state.tsx` | `FieldHint` / `FieldError` (`role="alert"`) / `FieldSuccess` (`role="status"`) | micro-textes sous champs de capture (email, OTP, RSVP) ; à lier via `aria-describedby` + `aria-invalid` sur l'`Input` shadcn |

## 3. États UI documentés

| État | Composant | Tokens | ARIA |
|---|---|---|---|
| loading (soumission) | `Feedback tone="loading"` + `.ds-loading-bar` / `.ds-loading-dot` | lime 35% sweep sur `--card` | `role="status"`, `aria-busy="true"` |
| error (réseau/validation) | `Feedback tone="error"` / `FieldError` | `--destructive`, `.ds-state-error` | `role="alert"` |
| warning (non bloquant) | `Feedback tone="warning"` | `--chart-3`, `.ds-state-error` (bordure) | `role="alert"` |
| success (confirmation) | `Feedback tone="success"` / `FieldSuccess` | `--primary`, `.ds-state-success` | `role="status"` |
| info (neutre) | `Feedback tone="info"` / `FieldHint` | `--muted-foreground` | `role="status"` / aucun |
| attente contenu | `Skeleton` shadcn / `.ds-skeleton-line` | `--accent` pulse | `aria-busy` sur le conteneur |
| focus clavier | `.focus-lime` / `.ds-focus-ring` | `--ring` | `:focus-visible` uniquement |

## 4. Règles

1. **Réutiliser, pas de CSS ponctuel** : un besoin déjà couvert par
   `ui/*` ou une classe `globals.css` ne crée ni nouveau composant ni style
   inline — on compose (`cn()`).
2. **Ajout seulement** : jamais de modification d'un variant shadcn existant
   sans snapshot visuel + revue ; les alias `--ds-*` pointent, ne dupliquent pas.
3. **Lime = accent** : jamais de fond plein lime, jamais de texte courant lime ;
   rem
...[truncated 2085 chars]