# ADMIN_UI_REDESIGN_SPEC — Spécification de Design de l'Interface Admin HASHCODE REBOOT

> **Phase 4 du projet de redesign** — Spécification détaillée de l'interface admin redessinée.
>
> **Base de référence** : AUDIT_EXISTANT.md (inventaire technique) + UX_UI_AUDIT.md (analyse des problèmes UX/UI) + ADMIN_INFORMATION_ARCHITECTURE.md (architecture de l'information) + DATA_EXPERIENCE_AUDIT.md (expérience des données).
>
> **Objectif** : Définir une spécification de design complète et détaillée pour l'interface admin, couvrant le layout, les composants, la typographie, la palette de couleurs, le responsive, l'accessibilité, les animations et les états.

---

## 📋 Table des matières

1. [Introduction et objectifs](#1-introduction-et-objectifs)
2. [Principes de design](#2-principes-de-design)
3. [Palette de couleurs et tokens](#3-palette-de-couleurs-et-tokens)
4. [Typographie](#4-typographie)
5. [Layout général](#5-layout-général)
6. [Composants détaillés](#6-composants-détaillés)
7. [États](#7-états)
8. [Responsive design](#8-responsive-design)
9. [Accessibilité](#9-accessibilité)
10. [Animations et transitions](#10-animations-et-transitions)
11. [Contraintes techniques](#11-contraintes-techniques)

---

## 1. Introduction et objectifs

### 1.1 Objectif de la spécification

La présente spécification définit les exigences de design pour l'interface admin HASHCODE REBOOT après le redesign complet. Elle fournit une description détaillée de chaque élément visuel et comportemental de l'interface, permettant une implémentation cohérente et de haute qualité.

### 1.2 Cibles de la spécification

- **Designers** : Comprendre les exigences visuelles et comportementales de chaque composant
- **Développeurs** : Obtenir des spécifications techniques précises pour l'implémentation
- **Testeurs** : Disposer de critères clairs pour valider le design
- **Stakeholders** : Visualiser l'interface finale avant l'implémentation

### 1.3 Livrable

Ce document est une **spécification de design**, pas une implémentation technique. Il décrit ce que l'interface doit afficher et comment elle doit se comporter, sans détailler la structure du code.

---

## 2. Principes de design

### 2.1 KPI Tiers — Classification des métriques

L'interface admin doit présenter des métriques classées selon 4 niveaux de profondeur :

| Niveau | Type | Objectif | Présentation | Actions possibles |
|--------|------|----------|--------------|-------------------|
| **Tier 1** | Opérationnel/Action | Actions immédiates, pilotage direct | Cartes cliquables, prévisualisation des résultats, indicateurs de tendance | Filtrer les membres, ouvrir les détails |
| **Tier 2** | Pilotage/Contexte | Compréhension de l'état global | Résumés rapides, indicateurs de tendance, comparaisons | Naviguer vers les sections, exporter les données |
| **Tier 3** | Analytique | Profondeur d'analyse | Breakdowns détaillés, funnel, comparaisons historiques | Télécharger les données, filtrer par dimension |
| **Tier 4** | Décoratif | Esthétique uniquement | **À supprimer** (surcharge visuelle, pas d'action) | - |

**Exemples de KPIs par niveau :**
- **Tier 1** : "Inscrits (3)" — Clic → filtre la liste des membres par statut INSCRIT
- **Tier 2** : "3 membres validés, 1 en attente, 1 sur waitlist" — Résumé global
- **Tier 3** : "Taux de complétion du funnel : 45%" — Analyse détaillée
- **Tier 4** : "Statistiques décoratives" — À supprimer

### 2.2 Insight → Action

Chaque statistique/clique doit mener à une action réelle :

| Insight | Action | Résultat |
|---------|--------|----------|
| "Inscrits (3)" | Cliquer sur la carte | Affiche les 3 membres inscrits filtrés |
| "Validés (2)" | Cliquer sur la carte | Affiche les 2 membres validés filtrés |
| "Taux de complétion : 45%" | Cliquer sur le breakdown | Ouvre le funnel détaillé |
| "Waitlist (1)" | Cliquer sur la carte | Affiche le membre sur waitlist |

### 2.3 Minimum clicks

Optimiser les chemins critiques pour réduire le nombre de clics nécessaires :

| Action critique | Chemin actuel | Chemin cible | Économie |
|-----------------|---------------|--------------|----------|
| Voir les membres Cyber | Dashboard → Membres → Filtre Cyber | Dashboard → Clic carte "Cyber" | 2 clics → 1 clic |
| Valider un membre | Membres → Cliquer membre → Fenêtre détails → Bouton Valider | Membres → Cliquer membre → Fenêtre détails → Bouton Valider | - |
| Exporter CSV | Exports → Cliquer bouton Exporter | Exports → Cliquer bouton Exporter (inchangé) | - |
| Aller aux statistiques | Sidebar → Statistiques | Sidebar → Clic "Statistiques" (inchangé) | - |

### 2.4 Progressive disclosure

Ne pas tout afficher d'un coup. L'information doit être présentée de manière hiérarchique :

- **L1 (Essentiel)** : Affiché par défaut (stats globales, liste des membres, filtres principaux)
- **L2 (Détail)** : Accessible via clic ou hover (prévisualisation des détails, tooltips, breakdowns)
- **L3 (Avancé)** : Accessible via actions supplémentaires (fenêtre de détails, exports avancés, analytics détaillés)

### 2.5 Design system HASHCODE

- **Thème** : Sombre (#0A0A0A pour VOID, #141414 pour SURFACE, #1A1A1A pour ELEVATED, #2A2A2A pour BORDER)
- **Accents** : Lime (#C5F441) pour les actions positives, Vert (#22c55e) pour succès
- **Style** : Tech/cybersécurité (polices monospaced, bordures fines, icônes tech)
- **Contraste** : WCAG AA minimum (4.5:1 pour texte normal)

### 2.6 Performance

- Pas de re-rendu inutile (optimiser les composants React)
- Pas de surcharge API (cacher les données non nécessaires)
- Lazy loading pour les sections lourdes (analytics détaillés)

### 2.7 Accessibilité WCAG

- Navigation clavier complète (Tab, Shift+Tab, Enter/Space, Escape, ?)
- Focus visuel explicite (outline coloré + ombre)
- Labels associés aux contrôles (htmlFor)
- Contraste suffisant (4.5:1 pour texte normal)

### 2.8 Responsive

- **Desktop** : Full layout (sidebar fixe, contenu principal scrollable)
- **Tablet** : Layout condensé (sidebar réduite, contenu plus compact)
- **Mobile** : Layout essentiel (sidebar cachable, contenu scrollable)

---

## 3. Palette de couleurs et tokens

### 3.1 Palette de couleurs principale

| Couleur | Hex | Nom | Usage |
|---------|-----|-----|-------|
| **VOID** | `#0A0A0A` | Fond principal | Corps de page, fond de fenêtre de dialogue |
| **SURFACE** | `#141414` | Fond des cartes, sections | Conteneurs principaux |
| **ELEVATED** | `#1A1A1A` | Fond des éléments interactifs | Éléments au survol, focus |
| **BORDER** | `#2A2A2A` | Bordures | Séparateurs, cadres |
| **TEXT PRIMARY** | `#F8FAFC` | Texte principal | Titres, labels importants |
| **TEXT SECONDARY** | `#94A3B8` | Texte secondaire | Labels, descriptions, placeholders |
| **TEXT MUTED** | `#64748B` | Texte éteint | Texte très secondaire, méta-données |
| **HASH LIME** | `#C5F441` | Accent principal | Actions positives, succès, focus |
| **LIME GLOW** | `#C5F44180` | Accent avec transparence | Effets de lueur, auras |
| **SUCCESS** | `#22C55E` | Succès | Messages de succès, indicateurs positifs |
| **WARNING** | `#F59E0B` | Avertissement | Membres en attente, alertes |
| **DANGER** | `#EF4444` | Danger | Suppression, erreurs, alertes critiques |
| **INFO** | `#3B82F6` | Information | Messages d'information |

### 3.2 Palette de couleurs par état

#### États de survol (Hover)

| État | Fond | Bordure | Texte |
|------|------|---------|-------|
| **Bouton primaire** | `bg-lime/10` | `border-lime/30` | `text-lime` |
| **Bouton secondaire** | `bg-elevated/80` | `border-border` | `text-foreground` |
| **Carte KPI** | `bg-elevated/80` | `border-border` | `text-foreground` |
| **Ligne tableau** | `bg-lime/5` | `border-lime/20` | `text-foreground` |

#### États actifs (Active)

| État | Fond | Bordure | Texte |
|------|------|---------|-------|
| **Bouton primaire** | `bg-lime/20` | `border-lime/50` | `text-lime` |
| **Bouton secondaire** | `bg-elevated/100` | `border-lime/30` | `text-foreground` |
| **Carte KPI** | `bg-lime/10` | `border-lime/50` | `text-lime` |

#### États désactivés (Disabled)

| État | Fond | Bordure | Texte |
|------|------|---------|-------|
| **Bouton** | `bg-card/30` | `border-border` | `text-muted-foreground` |
| **Carte KPI** | `bg-card/30` | `border-border` | `text-muted-foreground` |
| **Ligne tableau** | `bg-card/30` | `border-border` | `text-muted-foreground` |

### 3.3 Palette de couleurs par composant

#### Cartes (Cards)

| Type | Fond | Bordure | Ombre | Rayon |
|------|------|---------|-------|-------|
| **Standard** | `bg-surface` | `border-border` | `shadow-sm` | `rounded-md` |
| **Elevated** | `bg-elevated` | `border-lime/20` | `shadow-md` | `rounded-md` |
| **Success** | `bg-success/5` | `border-success/20` | `shadow-sm` | `rounded-md` |
| **Warning** | `bg-warning/5` | `border-warning/20` | `shadow-sm` | `rounded-md` |
| **Danger** | `bg-danger/5` | `border-danger/20` | `shadow-sm` | `rounded-md` |

#### Badges (Badges)

| Type | Fond | Bordure | Texte | Rayon |
|------|------|---------|-------|-------|
| **Default** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-full` |
| **Lime** | `bg-lime/10` | `border-lime/30` | `text-lime` | `rounded-full` |
| **Success** | `bg-success/10` | `border-success/20` | `text-success` | `rounded-full` |
| **Warning** | `bg-warning/10` | `border-warning/20` | `text-warning` | `rounded-full` |
| **Danger** | `bg-danger/10` | `border-danger/20` | `text-danger` | `rounded-full` |
| **Muted** | `bg-muted/10` | `border-muted/20` | `text-muted-foreground` | `rounded-full` |

#### Boutons (Buttons)

| Type | Fond | Bordure | Texte | Rayon |
|------|------|---------|-------|-------|
| **Primary** | `bg-lime` | `border-lime` | `text-black` | `rounded-md` |
| **Secondary** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-md` |
| **Destructive** | `bg-danger` | `border-danger` | `text-white` | `rounded-md` |
| **Ghost** | `bg-transparent` | `border-transparent` | `text-foreground` | `rounded-md` |
| **Outline** | `bg-transparent` | `border-border` | `text-foreground` | `rounded-md` |

#### Indicateurs (Indicators)

| Type | Fond | Bordure | Texte | Rayon |
|------|------|---------|-------|-------|
| **Dot** | `bg-lime` | `border-lime` | `text-lime` | `rounded-full` |
| **Ring** | `bg-lime/10` | `border-lime/30` | `text-lime` | `rounded-full` |
| **Badge** | `bg-lime/10` | `border-lime/30` | `text-lime` | `rounded-sm` |

### 3.4 Contraste et accessibilité

#### Contraste minimum (WCAG AA)

| Type | Contraste minimum | Exemple |
|------|-------------------|---------|
| **Texte normal** | 4.5:1 | `text-foreground` sur `bg-surface` (#F8FAFC / #141414 = 7.2:1) |
| **Texte large** | 3:1 | `text-foreground` sur `bg-surface` (#F8FAFC / #141414 = 7.2:1) |
| **Labels secondaires** | 4.5:1 | `text-muted-foreground/80` sur `bg-surface` (#94A3B8/80 / #141414 = 5.1:1) |
| **Tags et badges** | 4.5:1 | `text-lime/90` sur `bg-lime/5` (#C5F441/90 / #C5F441/5 = 9.5:1) |

### 3.5 Tokens CSS

```css
/* Fond */
--void: #0A0A0A;
--surface: #141414;
--elevated: #1A1A1A;
--border: #2A2A2A;
--card: #141414;

/* Texte */
--foreground: #F8FAFC;
--foreground-secondary: #94A3B8;
--foreground-muted: #64748B;

/* Accent */
--lime: #C5F441;
--lime-glow: rgba(197, 244, 65, 0.5);
--success: #22C55E;
--warning: #F59E0B;
--danger: #EF4444;
--info: #3B82F6;

/* Ombres */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
--shadow-lime: 0 0 20px rgba(197, 244, 65, 0.2);

/* Rayons */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
```

---

## 4. Typographie

### 4.1 Polices

| Police | Usage | Poids | Taille standard |
|--------|-------|-------|-----------------|
| **Sora** | Titres, headings, display | 400, 600, 700 | 24px - 48px |
| **Geist** | Corps de texte, labels | 400, 500, 600 | 14px - 16px |
| **Geist Mono** | Code, monospace, métadonnées | 400, 500, 600 | 12px - 14px |

### 4.2 Hiérarchie typographique

| Niveau | Taille | Poids | Usage | Exemple |
|--------|--------|-------|-------|---------|
| **Display** | 48px | 700 | Titres principaux, hero | "Admin Dashboard" |
| **H1** | 36px | 700 | Titres de section | "Vue d'ensemble" |
| **H2** | 28px | 600 | Sous-titres de section | "Statistiques globales" |
| **H3** | 20px | 600 | Titres de composant | "KPIs" |
| **H4** | 16px | 600 | Titres de sous-composant | "Par domaine" |
| **Body** | 16px | 400 | Texte principal | "3 membres validés" |
| **Small** | 14px | 400 | Texte secondaire | Labels, descriptions |
| **Mono** | 12px - 14px | 400 | Code, métadonnées | "ID: 123456" |

### 4.3 Utilisation des polices

#### Titres (Sora)

```css
/* Display - Titres principaux */
display-title: font-sora font-bold text-4xl text-foreground;

/* H1 - Titres de section */
section-title: font-sora font-semibold text-2xl text-foreground;

/* H2 - Sous-titres de section */
subsection-title: font-sora font-semibold text-xl text-foreground;

/* H3 - Titres de composant */
component-title: font-sora font-semibold text-lg text-foreground;
```

#### Corps de texte (Geist)

```css
/* Body - Texte principal */
body-text: font-geist font-normal text-base text-foreground;

/* Small - Texte secondaire */
small-text: font-geist font-normal text-sm text-foreground-secondary;

/* Mono - Code et métadonnées */
mono-text: font-geist-mono font-normal text-xs text-foreground-muted;
```

### 4.4 Espacements typographiques

| Élément | Espacement vertical | Espacement horizontal | Exemple |
|---------|---------------------|-----------------------|---------|
| **Titre + Paragraphe** | 12px | 0 | H1 + description |
| **Titre + Sous-titre** | 8px | 0 | H2 + H3 |
| **Paragraphe + Élément** | 8px | 0 | Texte + bouton |
| **Élément + Élément** | 16px | 16px | Carte + Carte |
| **Section + Section** | 24px | 0 | Section + Section |

### 4.5 Alignement

| Élément | Alignement | Justification |
|---------|------------|---------------|
| **Titres** | Gauche | - |
| **Labels** | Gauche | - |
| **Texte** | Gauche | - |
| **Centres** | Centre | - |
| **Droite** | Droite | - |

### 4.6 Gestion des mots longs

- Utiliser `hyphens: auto` pour les mots longs
- Utiliser `word-break: break-word` pour les textes très longs
- Utiliser `overflow-wrap: break-word` pour éviter les débordements

---

## 5. Layout général

### 5.1 Structure globale

```
┌─────────────────────────────────────────────────────────────┐
│  Header (Logo + Breadcrumbs + Actions globales)              │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Sidebar     │  Main Content                                │
│  (200px)     │  - Section Header                            │
│              │  - Section Content (stats/filters/list)       │
│  - Dashboard │                                              │
│  - Membres   │                                              │
│  - Activité  │                                              │
│  - Exports   │                                              │
│  - Settings  │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 5.2 Header

**Structure :**

| Élément | Contenu | Comportement | Dimensions |
|---------|---------|--------------|------------|
| **Logo** | "HASHCODE ADMIN" | Cliquer → Dashboard | 200px largeur |
| **Breadcrumbs** | "Admin > Vue d'ensemble" | Cliquer → Section parente | - |
| **Actions globales** | [Déconnexion] [Rafraîchir] | Cliquer → Action correspondante | - |

**Style :**

- **Logo** : `font-sora font-bold text-lg text-foreground` sur fond `bg-elevated`
- **Breadcrumbs** : `font-geist text-sm text-muted-foreground` sur fond `bg-surface`
- **Actions** : Boutons secondaires avec icônes

**Responsive behavior :**

- **Desktop** : Header fixe en haut, 200px de largeur
- **Tablet** : Header réduit (150px de largeur)
- **Mobile** : Header condensé (100px de largeur)

### 5.3 Sidebar (AdminSidebar)

**Structure :**

| Élément | Contenu | Comportement | Accessibilité |
|---------|---------|--------------|---------------|
| **Logo** | "HASHCODE ADMIN" | Cliquer → Dashboard | aria-label="Aller au dashboard" |
| **Navigation** | - Statistiques<br>- Membres<br>- Activité<br>- Exports<br>- Paramètres | Cliquer → Navigue vers la section | aria-label="Navigation vers [section]" |
| **Sous-sections** | - Par domaine<br>- Par pays<br>- Par statut | Sous-menu (accordéon) | aria-expanded, aria-controls |
| **Raccourcis clavier** | "?" | Ouvre le guide des raccourcis | aria-label="Ouvrir le guide des raccourcis" |
| **User info** | Avatar + Nom | Cliquer → Profil | aria-label="Profil utilisateur" |

**Labels explicites :**

- "Statistiques — Vue d'ensemble des métriques globales"
- "Membres — Gestion et validation des membres"
- "Activité — Historique et événements récents"
- "Exports — Télécharger des données"
- "Paramètres — Configuration de l'interface"

**Responsive behavior :**

- **Desktop** : Sidebar fixe (200px largeur, toujours visible)
- **Tablet** : Sidebar réduite (150px largeur, icônes uniquement)
- **Mobile** : Sidebar cachable (100% largeur, hamburger menu)

### 5.4 Breadcrumbs

**Structure :**

```
Admin > Vue d'ensemble
Admin > Membres > Par domaine
Admin > Activité > Funnel
Admin > Exports > CSV
```

**Composant :**

- **Format** : "Admin > [Section] > [Sous-section]"
- **Comportement** : Chaque niveau est cliquable
- **Style** : Minimaliste avec icônes (ChevronRight)
- **Accessibilité** : aria-label pour chaque niveau

**Exemples :**

- Dashboard : "Admin > Vue d'ensemble"
- Membres : "Admin > Membres > Par domaine"
- Activité : "Admin > Activité > Funnel"
- Exports : "Admin > Exports > CSV"

### 5.5 Main Content

**Structure :**

```
┌─────────────────────────────────────────────────────────────┐
│  Section Header                                             │
│  "Vue d'ensemble — Statistiques globales et filtres rapides" │
├─────────────────────────────────────────────────────────────┤
│  KPI Tier 1 (Opérationnel/Action)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Inscrits  │ │ Validés  │ │ En attente│ │ Waitlist │       │
│  │   (3)    │ │   (2)    │ │   (1)    │ │   (1)    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  Résumé rapide (Tier 2 - Pilotage/Contexte)                │
│  "3 membres validés, 1 en attente, 1 sur waitlist"         │
├─────────────────────────────────────────────────────────────┤
│  Breakdowns (Tier 3 - Analytique)                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Par domaine  │ │ Par pays     │ │ Par statut   │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  Funnel (Tier 3 - Analytique)                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   Funnel de conversion (4 étapes)                     │  │
│  │   [Inscrits] → [Validés] → [Membres actifs] → [Actifs]│  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Actions rapides                                            │
│  [Valider sélection] [Inviter sélection] [Exporter CSV]     │
└─────────────────────────────────────────────────────────────┘
```

**Section Header :**

| Élément | Contenu | Comportement |
|---------|---------|--------------|
| **Title** | "Vue d'ensemble" | - |
| **Subtitle** | "Statistiques globales et filtres rapides" | - |
| **Actions** | [Exporter CSV] [Rafraîchir] | Cliquer → Action correspondante |

**Style :**

- **Title** : `font-sora font-semibold text-xl text-foreground`
- **Subtitle** : `font-geist text-sm text-muted-foreground`
- **Actions** : Boutons primaires (fond lime, texte noir)

### 5.6 Section Content

Chaque section contient :

- **Section Header** : Titre + sous-titre + actions
- **Contenu** : KPIs, breakdowns, tableau, etc.
- **Pagination** : En bas du tableau
- **Bulk Actions** : En bas du tableau (si applicable)

---

## 6. Composants détaillés

### 6.1 Header

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Logo (200px)      Breadcrumbs           Actions            │
│  HASHCODE ADMIN    Admin > Vue d'ensemble   [Déconnexion]   │
└─────────────────────────────────────────────────────────────┘
```

#### Apparence visuelle

| Élément | Fond | Bordure | Texte | Rayon |
|---------|------|---------|-------|-------|
| **Logo** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-md` |
| **Breadcrumbs** | `bg-surface` | `border-border` | `text-muted-foreground` | `rounded-sm` |
| **Actions** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-md` |

#### Comportements

- **Logo** : Cliquer → Dashboard
- **Breadcrumbs** : Cliquer → Section parente
- **Actions** : Cliquer → Action correspondante

#### États

| État | Fond | Bordure | Texte | Comportement |
|------|------|---------|-------|--------------|
| **Default** | `bg-elevated` | `border-border` | `text-foreground` | - |
| **Hover** | `bg-elevated/80` | `border-lime/30` | `text-lime` | - |
| **Active** | `bg-elevated/100` | `border-lime/50` | `text-foreground` | - |
| **Disabled** | `bg-card/30` | `border-border` | `text-muted-foreground` | - |

#### Accessibilité

- **Logo** : `aria-label="Aller au dashboard"`
- **Breadcrumbs** : `aria-label="Navigation vers [section]"`
- **Actions** : `aria-label="[Action]"`
- **Focus** : `outline-lime outline-2 outline-offset-2`

#### Responsive behavior

- **Desktop** : Header fixe en haut, 200px de largeur
- **Tablet** : Header réduit (150px de largeur)
- **Mobile** : Header condensé (100px de largeur)

---

### 6.2 Sidebar (AdminSidebar)

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Logo (200px)                                               │
│  HASHCODE ADMIN                                             │
├─────────────────────────────────────────────────────────────┤
│  Navigation                                                 │
│  ┌─────────────┐                                           │
│  │ 📊 Statistiques │                                       │
│  └─────────────┘                                           │
│  ┌─────────────┐                                           │
│  │ 👥 Membres   │                                           │
│  └─────────────┘                                           │
│  ┌─────────────┐                                           │
│  │ 📜 Activité  │                                           │
│  └─────────────┘                                           │
│  ┌─────────────┐                                           │
│  │ 📤 Exports   │                                           │
│  └─────────────┘                                           │
│  ┌─────────────┐                                           │
│  │ ⚙️ Paramètres │                                           │
│  └─────────────┘                                           │
├─────────────────────────────────────────────────────────────┤
│  Raccourcis clavier                                         │
│  ? - Ouvrir le guide des raccourcis                         │
├─────────────────────────────────────────────────────────────┤
│  User info                                                  │
│  Avatar + Nom                                               │
└─────────────────────────────────────────────────────────────┘
```

#### Apparence visuelle

| Élément | Fond | Bordure | Texte | Rayon |
|---------|------|---------|-------|-------|
| **Logo** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-md` |
| **Navigation** | `bg-surface` | `border-border` | `text-foreground-secondary` | `rounded-sm` |
| **Raccourcis** | `bg-elevated` | `border-border` | `text-muted-foreground` | `rounded-sm` |
| **User info** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-md` |

#### Comportements

- **Logo** : Cliquer → Dashboard
- **Navigation** : Cliquer → Navigue vers la section
- **Sous-sections** : Accordéon (expand/collapse)
- **Raccourcis** : Ouvre le guide des raccourcis
- **User info** : Cliquer → Profil

#### États

| État | Fond | Bordure | Texte | Comportement |
|------|------|---------|-------|--------------|
| **Default** | `bg-surface` | `border-border` | `text-foreground-secondary` | - |
| **Hover** | `bg-elevated/80` | `border-lime/30` | `text-lime` | - |
| **Active** | `bg-lime/10` | `border-lime/50` | `text-lime` | - |
| **Disabled** | `bg-card/30` | `border-border` | `text-muted-foreground` | - |

#### Accessibilité

- **Navigation** : `aria-label="Navigation vers [section]"`
- **Sous-sections** : `aria-expanded`, `aria-controls`
- **Raccourcis** : `aria-label="Ouvrir le guide des raccourcis"`
- **User info** : `aria-label="Profil utilisateur"`
- **Focus** : `outline-lime outline-2 outline-offset-2`

#### Responsive behavior

- **Desktop** : Sidebar fixe (200px largeur, toujours visible)
- **Tablet** : Sidebar réduite (150px largeur, icônes uniquement)
- **Mobile** : Sidebar cachable (100% largeur, hamburger menu)

---

### 6.3 Dashboard

#### Section Header

| Élément | Contenu | Comportement |
|---------|---------|--------------|
| **Title** | "Vue d'ensemble" | - |
| **Subtitle** | "Statistiques globales et filtres rapides" | - |
| **Actions** | [Exporter CSV] [Rafraîchir] | Cliquer → Action correspondante |

**Style :**

- **Title** : `font-sora font-semibold text-xl text-foreground`
- **Subtitle** : `font-geist text-sm text-muted-foreground`
- **Actions** : Boutons primaires (fond lime, texte noir)

#### KPI Tier 1 (Opérationnel/Action)

**Structure :**

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Inscrits  │ │ Validés  │ │ En attente│ │ Waitlist │
│   (3)    │ │   (2)    │ │   (1)    │ │   (1)    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**Carte KPI :**

| Élément | Fond | Bordure | Texte | Rayon |
|---------|------|---------|-------|-------|
| **Label** | `bg-surface` | `border-border` | `text-foreground` | `rounded-md` |
| **Nombre** | `bg-lime/10` | `border-lime/30` | `text-lime` | `rounded-md` |
| **Preview** | `bg-surface` | `border-border` | `text-muted-foreground` | `rounded-md` |

**Comportement :**

- **Label** : Cliquer → Filtre les membres par statut
- **Nombre** : Cliquer → Filtre les membres par statut
- **Preview** : Cliquer → Filtre les membres par statut

**Preview indicators :**

- Chaque carte affiche le nombre de résultats filtrés (ex: "Inscrits (3)")
- Carte avec filtre actif : affiche l'indicateur visuel (cercle vert) + nombre de résultats

**État avec filtre actif :**

| Élément | Fond | Bordure | Texte | Indicateur |
|---------|------|---------|-------|------------|
| **Label** | `bg-lime/10` | `border-lime/50` | `text-lime` | Cercle vert |
| **Nombre** | `bg-lime/20` | `border-lime/50` | `text-lime` | Cercle vert |
| **Preview** | `bg-lime/10` | `border-lime/50` | `text-lime` | Cercle vert |

**Responsive behavior :**

- **Desktop** : 4 cartes en ligne
- **Tablet** : 4 cartes en ligne (condensées)
- **Mobile** : 2 cartes par ligne

#### Résumé rapide (Tier 2 - Pilotage/Contexte)

**Structure :**

```
"3 membres validés, 1 en attente, 1 sur waitlist"
```

**Composant :**

- **Label** : `font-geist text-xs text-muted-foreground`
- **Valeur** : `font-geist text-sm font-semibold text-foreground`
- **Indicateur de tendance** : Flèche vers le haut/bas + pourcentage

**Style :**

- **Label** : `font-geist text-xs text-muted-foreground`
- **Valeur** : `font-geist text-sm font-semibold text-foreground`
- **Tendance** : `font-geist text-xs text-success` (flèche + pourcentage)

#### Breakdowns (Tier 3 - Analytique)

**Structure :**

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Par domaine  │ │ Par pays     │ │ Par statut   │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Carte Breakdown :**

| Élément | Fond | Bordure | Texte | Rayon |
|---------|------|---------|-------|-------|
| **Label** | `bg-surface` | `border-border` | `text-foreground` | `rounded-md` |
| **Valeur** | `bg-lime/10` | `border-lime/30` | `text-lime` | `rounded-md` |
| **Pourcentage** | `bg-surface` | `border-border` | `text-muted-foreground` | `rounded-md` |

**Comportement :**

- **Label** : Cliquer → Filtre les membres par domaine
- **Valeur** : Cliquer → Filtre les membres par domaine
- **Pourcentage** : Cliquer → Filtre les membres par domaine

**Preview indicators :**

- Chaque breakdown affiche le nombre de membres par catégorie (ex: "Cyber : 2 (66%)")
- Carte avec filtre actif : affiche l'indicateur visuel (cercle vert) + nombre de résultats

**État avec filtre actif :**

| Élément | Fond | Bordure | Texte | Indicateur |
|---------|------|---------|-------|------------|
| **Label** | `bg-lime/10` | `border-lime/50` | `text-lime` | Cercle vert |
| **Valeur** | `bg-lime/20` | `border-lime/50` | `text-lime` | Cercle vert |
| **Pourcentage** | `bg-lime/10` | `border-lime/50` | `text-lime` | Cercle vert |

**Responsive behavior :**

- **Desktop** : 3 breakdowns en ligne
- **Tablet** : 2 breakdowns en ligne (1 en bas)
- **Mobile** : 1 breakdown par ligne

#### Funnel (Tier 3 - Analytique)

**Structure :**

```
[Inscrits] → [Validés] → [Membres actifs] → [Actifs]
  5        →    3        →        3        →    2
  (100%)    (60%)       (100%)       (66%)
```

**Composant :**

- **Étapes** : 4 étapes avec labels et nombres
- **Taux de complétion** : Affiché en haut du funnel (ex: "Taux de complétion global : 40%")
- **Clic sur étape** : Filtre les membres par cette étape

**Style :**

- **Étapes** : Barres verticales avec labels et nombres
- **Taux de complétion** : `font-geist text-sm font-bold text-lime`
- **Labels** : `font-geist text-xs text-muted-foreground`

**Responsive behavior :**

- **Desktop** : Funnel horizontal
- **Tablet** : Funnel condensé (2 lignes)
- **Mobile** : Funnel vertical (1 étape par ligne)

#### Actions rapides

**Structure :**

| Action | Comportement | Accessibilité |
|--------|--------------|---------------|
| **Valider sélection** | Si des membres sont sélectionnés → Valide les membres sélectionnés | aria-label="Valider les membres sélectionnés" |
| **Inviter sélection** | Si des membres sont sélectionnés → Prépare l'invitation | aria-label="Inviter les membres sélectionnés" |
| **Exporter CSV** | Ouvre la fenêtre de dialogue pour choisir les colonnes à exporter | aria-label="Exporter les données en CSV" |

**Style :**

- **Boutons primaires** : Fond lime, texte noir, bordure lime
- **Boutons secondaires** : Fond transparent, texte foreground, bordure border
- **Loading state** : Bouton désactivé avec icône de chargement

**Responsive behavior :**

- **Desktop** : 3 boutons en ligne
- **Tablet** : 2 boutons en ligne (1 en bas)
- **Mobile** : 1 bouton par ligne

---

### 6.4 Member Table (Tableau des membres)

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Section Header                                             │
│  "Membres — Gestion et validation des membres"              │
├─────────────────────────────────────────────────────────────┤
│  Filtres                                                     │
│  [Recherche] [Domaine ▼] [Pays ▼] [Statut ▼] [Niveau ▼]     │
│  [Réinitialiser] [Appliquer]                                │
├─────────────────────────────────────────────────────────────┤
│  Résultats                                                   │
│  "3 membres trouvés"                                        │
├─────────────────────────────────────────────────────────────┤
│  Tableau des membres                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ☐  Nom  │ Pays │ Domaine │ Statut │ Niveau │ Actions │  │  │
│  ├──────────────────────────────────────────────────────┤  │  │
│  │  ☐  M1   │  FR  │  Cyber  │ VALIDÉ │  L1   │ [👁️] [⋮] │  │  │
│  │  ☐  M2   │  CN  │  Web    │ PENDING│  L2   │ [👁️] [⋮] │  │  │
│  │  ☐  M3   │  CM  │  AI     │ INSCRIT│  L1   │ [👁️] [⋮] │  │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Pagination                                                 │
│  [←] 1 2 3 [→]                                              │
├─────────────────────────────────────────────────────────────┤
│  Bulk actions                                                │
│  [Valider] [Inviter] [Waitlist] [Rejeter] [Supprimer]      │
└─────────────────────────────────────────────────────────────┘
```

#### Section Header

| Élément | Contenu | Comportement |
|---------|---------|--------------|
| **Title** | "Membres" | - |
| **Subtitle** | "Gestion et validation des membres" | - |
| **Actions** | [Exporter CSV] [Rafraîchir] | Cliquer → Action correspondante |

**Style :**

- **Title** : `font-sora font-semibold text-xl text-foreground`
- **Subtitle** : `font-geist text-sm text-muted-foreground`
- **Actions** : Boutons primaires (fond lime, texte noir)

#### Filtres

| Élément | Contenu | Comportement | Accessibilité |
|---------|---------|--------------|---------------|
| **Recherche** | Champ de texte | Tape → Filtre en temps réel (debounce 300ms) | aria-label="Rechercher des membres" |
| **Domaine** | Select (Cyber, Web, AI, etc.) | Cliquer → Ouvre le dropdown | aria-label="Filtrer par domaine" |
| **Pays** | Select (FR, CN, CM, etc.) | Cliquer → Ouvre le dropdown | aria-label="Filtrer par pays" |
| **Statut** | Select (VALIDÉ, PENDING, INSCRIT, WAITLIST) | Cliquer → Ouvre le dropdown | aria-label="Filtrer par statut" |
| **Niveau** | Select (L1, L2, L3, etc.) | Cliquer → Ouvre le dropdown | aria-label="Filtrer par niveau" |
| **Réinitialiser** | Bouton | Cliquer → Réinitialise tous les filtres | aria-label="Réinitialiser les filtres" |
| **Appliquer** | Bouton | Cliquer → Applique les filtres | aria-label="Appliquer les filtres" |

**Placement :**

- Placé en haut de la page, juste après la section header
- Regroupé visuellement avec une bordure et un label clair
- Indicateur visuel du nombre de filtres actifs (ex: "3 filtres actifs")

**Style :**

- **Label** : `font-geist text-xs font-semibold text-muted-foreground`
- **Champs** : Fond card, texte foreground, bordure border
- **Boutons** : Boutons primaires/secondaires selon le rôle

**Loading state :**

- Champ de recherche : "Recherche…"
- Select : "Chargement…"
- Résultats : Skeleton ou spinner

**Responsive behavior :**

- **Desktop** : Tous les filtres en ligne
- **Tablet** : 3 filtres en ligne (2 en haut, 1 en bas)
- **Mobile** : 2 filtres par ligne (1 en haut, 1 en bas)

#### Résultats

**Structure :**

```
"3 membres trouvés"
```

**Composant :**

- **Label** : `font-geist text-xs text-muted-foreground`
- **Valeur** : `font-geist text-sm font-semibold text-foreground`
- **Indicateur de tendance** : Flèche vers le haut/bas + pourcentage

**Style :**

- **Label** : `font-geist text-xs text-muted-foreground`
- **Valeur** : `font-geist text-sm font-semibold text-foreground`
- **Tendance** : `font-geist text-xs text-success` (flèche + pourcentage)

#### Tableau des membres

**Structure :**

| Colonne | Contenu | Comportement | Accessibilité |
|---------|---------|--------------|---------------|
| **Sélection** | Checkbox | Cliquer → Sélectionne la ligne | aria-label="Sélectionner le membre" |
| **Nom** | Prénom + Nom (avec note interne si présente) | Cliquer → Ouvre la fenêtre de détails | aria-label="Voir les détails du membre" |
| **Pays** | Pays (avec drapeau) | - | aria-label="Pays du membre" |
| **Domaine** | Domaine (Cyber, Web, AI) | - | aria-label="Domaine du membre" |
| **Statut** | Statut (VALIDÉ, PENDING, INSCRIT, WAITLIST) | - | aria-label="Statut du membre" |
| **Niveau** | Niveau (L1, L2, L3) | - | aria-label="Niveau du membre" |
| **Actions** | [👁️] [⋮] | [👁️] → Ouvre la fenêtre de détails<br>[⋮] → Menu actions | aria-label="Actions pour le membre" |

**Labels explicites (tooltips) :**

- **Nom** : "Prénom + Nom (avec note interne si présente)"
- **Objectif** : "Objectif principal du membre"
- **Mentorat** : "Intérêt pour le mentorat (Oui/Peut-être/Non)"
- **Budget** : "Fourchette de budget exprimé en FCFA"

**Hover preview :**

- Au survol de la ligne → Affiche le nom, statut, et domaine dans une tooltip
- Pour les membres avec note interne → Affiche un indicateur visuel

**Style :**

- **En-têtes** : `font-geist text-xs font-semibold uppercase text-muted-foreground`
- **Lignes** : Fond card, texte foreground, bordure border
- **Ligne sélectionnée** : Fond lime/10, bordure lime
- **Ligne hover** : Fond lime/5

**Responsive behavior :**

- **Desktop** : Toutes les colonnes affichées
- **Tablet** : Colonnes condensées (Pays, Domaine, Statut, Niveau masquées par défaut)
- **Mobile** : Colonnes masquées, affichage en cartes (1 membre par carte)

#### Pagination

**Structure :**

```
[←] 1 2 3 [→]
```

**Composant :**

- **Éléments** : Boutons pour chaque page
- **Page active** : Fond lime, texte noir
- **Éléments désactivés** : Fond card, texte muted, non cliquable
- **Première/Last page** : Boutons spéciaux (ex: "««", "»»")

**Comportement :**

- Cliquer sur une page → Charge les membres de cette page
- Cliquer sur «« ou »» → Va à la première ou dernière page
- Cliquer sur ← ou → → Page précédente ou suivante

**Style :**

- **Boutons** : Fond card, texte foreground, bordure border
- **Bouton actif** : Fond lime, texte noir
- **Bouton désactivé** : Fond card, texte muted, non cliquable

**Responsive behavior :**

- **Desktop** : Pagination en bas du tableau
- **Tablet** : Pagination en bas du tableau (condensée)
- **Mobile** : Pagination en bas du tableau (1 page affichée)

#### Bulk actions

**Structure :**

| Action | Comportement | Accessibilité |
|--------|--------------|---------------|
| **Valider** | Valide les membres sélectionnés | aria-label="Valider les membres sélectionnés" |
| **Inviter** | Prépare l'invitation pour les membres sélectionnés | aria-label="Inviter les membres sélectionnés" |
| **Waitlist** | Met les membres sélectionnés sur waitlist | aria-label="Mettre les membres sur waitlist" |
| **Rejeter** | Rejette les membres sélectionnés | aria-label="Rejeter les membres sélectionnés" |
| **Supprimer** | Supprime les membres sélectionnés | aria-label="Supprimer les membres sélectionnés" |

**Confirmation :**

- Pour **Supprimer** : Double confirmation avec résumé des conséquences
- Pour **Valider/Inviter/Waitlist/Rejeter** : Confirmation avec résumé des membres concernés
- Pour toutes les actions : Bouton "Annuler" pour annuler l'action

**Style :**

- **Boutons destructifs** : Fond danger, texte blanc, bordure danger
- **Boutons primaires** : Fond lime, texte noir, bordure lime
- **Boutons secondaires** : Fond transparent, texte foreground, bordure border
- **Loading state** : Bouton désactivé avec icône de chargement

**Responsive behavior :**

- **Desktop** : Bulk actions en bas du tableau
- **Tablet** : Bulk actions en bas du tableau (condensés)
- **Mobile** : Bulk actions cachés (actions disponibles dans la fenêtre de détails)

#### Prévisualisation au survol

**Structure :**

- Au survol de la ligne → Affiche le nom, statut, et domaine dans une tooltip
- Pour les membres avec note interne → Affiche un indicateur visuel

**Style :**

- **Tooltip** : Fond card, texte foreground, bordure border
- **Nom** : `font-geist text-sm font-semibold text-foreground`
- **Statut** : `font-geist text-xs text-lime` (si VALIDÉ) ou `font-geist text-xs text-warning` (si PENDING)
- **Domaine** : `font-geist text-xs text-muted-foreground`

---

### 6.5 Member Detail (Fenêtre de détails)

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Modal                                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Titre du membre (Nom + ID)                           │  │
│  │  [Fermer] [✕]                                        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Section Informations                                  │  │
│  │  - Nom, Email, Téléphone, Pays, Domaine, Niveau      │  │
│  │  - Objectif, Mentorat, Budget                         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Section Statut                                        │  │
│  │  - Statut (VALIDÉ, PENDING, INSCRIT, WAITLIST)       │  │
│  │  - Voie (Immédiat, En traitement)                    │  │
│  │  - Bouton Valider/Inviter/Rejeter                    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Section Note interne                                  │  │
│  │  - Textarea pour note                                 │  │
│  │  - Bouton Enregistrer / Effacer                       │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Section Invitation                                    │  │
│  │  - Bouton Préparer l'invitation                        │  │
│  │  - Message copiable                                    │  │
│  │  - Bouton Envoyer via WhatsApp                        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Zone de danger                                        │  │
│  │  - Bouton Supprimer                                    │  │
│  │  - Confirmation de suppression                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Composant : Modal

| Élément | Fond | Bordure | Texte | Rayon |
|---------|------|---------|-------|-------|
| **Modal** | `bg-surface` | `border-border` | `text-foreground` | `rounded-lg` |
| **Header** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-t-lg` |
| **Body** | `bg-surface` | `border-border` | `text-foreground` | `rounded-b-lg` |
| **Footer** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-b-lg` |

#### Comportement

- **Fermer** : Cliquer sur le bouton [Fermer] ou la touche [Escape]
- **Enregistrer la note** : Cliquer sur le bouton "Enregistrer la note"
- **Effacer la note** : Cliquer sur le bouton "Effacer"
- **Préparer l'invitation** : Cliquer sur le bouton "Préparer l'invitation"
- **Envoyer via WhatsApp** : Cliquer sur le bouton "Envoyer via WhatsApp"
- **Supprimer** : Cliquer sur le bouton "Supprimer" (double confirmation)

#### États

| État | Fond | Bordure | Texte | Comportement |
|------|------|---------|-------|--------------|
| **Default** | `bg-surface` | `border-border` | `text-foreground` | - |
| **Hover** | `bg-elevated/80` | `border-lime/30` | `text-lime` | - |
| **Active** | `bg-elevated/100` | `border-lime/50` | `text-foreground` | - |
| **Disabled** | `bg-card/30` | `border-border` | `text-muted-foreground` | - |

#### Accessibilité

- **Modal** : `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`
- **Fermer** : `aria-label="Fermer"`
- **Enregistrer la note** : `aria-label="Enregistrer la note"`
- **Effacer la note** : `aria-label="Effacer la note"`
- **Préparer l'invitation** : `aria-label="Préparer l'invitation"`
- **Envoyer via WhatsApp** : `aria-label="Envoyer via WhatsApp"`
- **Supprimer** : `aria-label="Supprimer ce membre"`
- **Focus** : `outline-lime outline-2 outline-offset-2`

---

### 6.6 Bulk Actions Bar

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Bulk action bar                                             │
│  3 sélectionné(s)                                           │
│  [Valider] [Inviter] [Waitlist] [Rejeter] [Supprimer]       │
│  [✕ Annuler]                                                │
└─────────────────────────────────────────────────────────────┘
```

#### Composant

| Élément | Fond | Bordure | Texte | Rayon |
|---------|------|---------|-------|-------|
| **Bar** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-md` |
| **Compteur** | `bg-lime/10` | `border-lime/30` | `text-lime` | `rounded-md` |
| **Boutons** | `bg-surface` | `border-border` | `text-foreground` | `rounded-md` |

#### Comportement

- **Compteur** : Affiche le nombre de membres sélectionnés
- **Boutons** : Cliquer → Action correspondante
- **Annuler** : Cliquer → Annule l'action en cours

#### États

| État | Fond | Bordure | Texte | Comportement |
|------|------|---------|-------|--------------|
| **Default** | `bg-elevated` | `border-border` | `text-foreground` | - |
| **Hover** | `bg-elevated/80` | `border-lime/30` | `text-lime` | - |
| **Active** | `bg-elevated/100` | `border-lime/50` | `text-foreground` | - |
| **Disabled** | `bg-card/30` | `border-border` | `text-muted-foreground` | - |

#### Accessibilité

- **Bar** : `aria-label="Actions en masse : 3 membres sélectionnés"`
- **Boutons** : `aria-label="[Action]"`
- **Annuler** : `aria-label="Annuler les actions en masse"`
- **Focus** : `outline-lime outline-2 outline-offset-2`

---

### 6.7 Export/Import Dialog

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Modal                                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Titre (Export CSV / Import CSV)                      │  │
│  │  [Fermer] [✕]                                        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Section Colonnes                                      │  │
│  │  - Liste des colonnes avec checkboxes                  │  │
│  │  - Sélectionner tout / Désélectionner tout            │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Section Options                                       │  │
│  │  - Format (CSV, JSON)                                  │  │
│  │  - Séparateur (virgule, point-virgule)                │  │
│  │  - Encodage (UTF-8)                                    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Section Filtres                                        │  │
│  │  - Liste des filtres actifs                           │  │
│  │  - Bouton Appliquer les filtres                       │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Section Action                                         │  │
│  │  - Bouton Exporter / Importer                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Composant : Modal

| Élément | Fond | Bordure | Texte | Rayon |
|---------|------|---------|-------|-------|
| **Modal** | `bg-surface` | `border-border` | `text-foreground` | `rounded-lg` |
| **Header** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-t-lg` |
| **Body** | `bg-surface` | `border-border` | `text-foreground` | `rounded-b-lg` |
| **Footer** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-b-lg` |

#### Comportement

- **Fermer** : Cliquer sur le bouton [Fermer] ou la touche [Escape]
- **Exporter** : Cliquer sur le bouton "Exporter"
- **Importer** : Cliquer sur le bouton "Importer"
- **Sélectionner tout** : Cliquer sur le bouton "Sélectionner tout"
- **Désélectionner tout** : Cliquer sur le bouton "Désélectionner tout"

#### États

| État | Fond | Bordure | Texte | Comportement |
|------|------|---------|-------|--------------|
| **Default** | `bg-surface` | `border-border` | `text-foreground` | - |
| **Hover** | `bg-elevated/80` | `border-lime/30` | `text-lime` | - |
| **Active** | `bg-elevated/100` | `border-lime/50` | `text-foreground` | - |
| **Disabled** | `bg-card/30` | `border-border` | `text-muted-foreground` | - |

#### Accessibilité

- **Modal** : `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`
- **Fermer** : `aria-label="Fermer"`
- **Exporter** : `aria-label="Exporter les données en CSV"`
- **Importer** : `aria-label="Importer les données en CSV"`
- **Sélectionner tout** : `aria-label="Sélectionner toutes les colonnes"`
- **Désélectionner tout** : `aria-label="Désélectionner toutes les colonnes"`
- **Focus** : `outline-lime outline-2 outline-offset-2`

---

### 6.8 Command Palette (Palette de commandes)

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Command Palette                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  🔍 Rechercher des actions...                         │  │
│  │                                                       │  │
│  │  Actions                                               │  │
│  │  [Valider le membre sélectionné]                      │  │
│  │  [Inviter le membre sélectionné]                      │  │
│  │  [Rejeter le membre sélectionné]                      │  │
│  │  [Supprimer le membre sélectionné]                    │  │
│  │                                                       │  │
│  │  Filtres                                               │  │
│  │  [Filtrer par statut]                                 │  │
│  │  [Filtrer par domaine]                                 │  │
│  │                                                       │  │
│  │  Navigation                                            │  │
│  │  [Aller aux Statistiques]                              │  │
│  │  [Aller aux Membres]                                   │  │
│  │  [Aller à l'Activité]                                  │  │
│  │  [Aller aux Exports]                                   │  │
│  │                                                       │  │
│  │  [↑↓ pour naviguer, Entrée pour sélectionner]         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Composant : Modal

| Élément | Fond | Bordure | Texte | Rayon |
|---------|------|---------|-------|-------|
| **Modal** | `bg-surface` | `border-border` | `text-foreground` | `rounded-lg` |
| **Header** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-t-lg` |
| **Body** | `bg-surface` | `border-border` | `text-foreground` | `rounded-b-lg` |
| **Footer** | `bg-elevated` | `border-border` | `text-foreground` | `rounded-b-lg` |

#### Comportement

- **Ouvrir** : Cliquer sur [Ctrl+K] ou [Cmd+K]
- **Fermer** : Cliquer sur le bouton [Fermer] ou la touche [Escape]
- **Naviguer** : Utiliser [↑] et [↓]
- **Sélectionner** : Appuyer sur [Entrée]
- **Rechercher** : Tapez dans le champ de recherche

#### Actions disponibles

| Action | Description | Raccourci |
|--------|-------------|-----------|
| **Valider le membre sélectionné** | Valide les membres sélectionnés | `V` |
| **Inviter le membre sélectionné** | Prépare l'invitation pour les membres sélectionnés | `I` |
| **Rejeter le membre sélectionné** | Rejette les membres sélectionnés | `R` |
| **Supprimer le membre sélectionné** | Supprime les membres sélectionnés | `D` |
| **Filtrer par statut** | Ouvre le filtre par statut | `F` + `S` |
| **Filtrer par domaine** | Ouvre le filtre par domaine | `F` + `D` |
| **Exporter CSV** | Ouvre la fenêtre de dialogue pour choisir les colonnes à exporter | `E` + `C` |
| **Exporter JSON** | Ouvre la fenêtre de dialogue pour choisir les colonnes à exporter | `E` + `J` |
| **Rafraîchir les données** | Rafraîchit les données de l'interface | `R` |
| **Aller aux Statistiques** | Navigue vers la section Statistiques | `G` + `S` |
| **Aller aux Membres** | Navigue vers la section Membres | `G` + `M` |
| **Aller à l'Activité** | Navigue vers la section Activité | `G` + `A` |
| **Aller aux Exports** | Navigue vers la section Exports | `G` + `X` |

#### États

| État | Fond | Bordure | Texte | Comportement |
|------|------|---------|-------|--------------|
| **Default** | `bg-surface` | `border-border` | `text-foreground` | - |
| **Hover** | `bg-lime/10` | `border-lime/30` | `text-lime` | - |
| **Active** | `bg-lime/20` | `border-lime/50` | `text-lime` | - |
| **Disabled** | `bg-card/30` | `border-border` | `text-muted-foreground` | - |

#### Accessibilité

- **Modal** : `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`
- **Fermer** : `aria-label="Fermer"`
- **Rechercher** : `aria-label="Rechercher des actions"`
- **Focus** : `outline-lime outline-2 outline-offset-2`

---

### 6.9 Notifications/Toasts

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Toast                                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  📊 Statut mis à jour avec succès                     │  │
│  │  [Fermer]                                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Composant

| Élément | Fond | Bordure | Texte | Rayon |
|---------|------|---------|-------|-------|
| **Toast** | `bg-elevated` | `border-lime/30` | `text-foreground` | `rounded-md` |
| **Message** | `bg-surface` | `border-border` | `text-foreground` | `rounded-md` |
| **Bouton** | `bg-lime/10` | `border-lime/30` | `text-lime` | `rounded-md` |

#### Types de notifications

| Type | Fond | Bordure | Texte | Icône |
|------|------|---------|-------|-------|
| **Success** | `bg-success/10` | `border-success/20` | `text-success` | ✅ |
| **Error** | `bg-danger/10` | `border-danger/20` | `text-danger` | ❌ |
| **Warning** | `bg-warning/10` | `border-warning/20` | `text-warning` | ⚠️ |
| **Info** | `bg-info/10` | `border-info/20` | `text-info` | ℹ️ |

#### Comportement

- **Affichage** : Apparaît en bas à droite, dure 5 secondes
- **Fermer** : Cliquer sur le bouton [Fermer] ou attendre 5 secondes
- **Annulation** : Cliquer sur le bouton [Annuler]

#### États

| État | Fond | Bordure | Texte | Comportement |
|------|------|---------|-------|--------------|
| **Default** | `bg-elevated` | `border-lime/30` | `text-foreground` | - |
| **Hover** | `bg-lime/10` | `border-lime/50` | `text-lime` | - |
| **Active** | `bg-lime/20` | `border-lime/50` | `text-lime` | - |
| **Disabled** | `bg-card/30` | `border-border` | `text-muted-foreground` | - |

#### Accessibilité

- **Toast** : `role="alert"`, `aria-live="polite"`
- **Fermer** : `aria-label="Fermer"`
- **Focus** : `outline-lime outline-2 outline-offset-2`

---

## 7. États

### 7.1 States par section

| Section | Empty | Loading | Error | Success |
|---------|-------|---------|-------|---------|
| **Dashboard** | "Aucune donnée disponible" | Skeleton ou spinner | "Erreur de chargement des stats" | "Données mises à jour avec succès" |
| **Membres** | "Aucun membre ne correspond à ces filtres" | Skeleton ou spinner | "Erreur de chargement des membres" | "Membres filtrés avec succès" |
| **Activité** | "Aucune donnée analytics pour l'instant" | Skeleton ou spinner | "Erreur de chargement des analytics" | "Analytics mis à jour avec succès" |
| **Exports** | "Aucun export disponible" | Skeleton ou spinner | "Erreur de chargement des exports" | "Export téléchargé avec succès" |

### 7.2 Empty state

**Structure :**

```
┌─────────────────────────────────────────────────────────────┐
│  Empty State                                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  📊 Aucune donnée disponible                         │  │
│  │                                                      │  │
│  │  [Réinitialiser les filtres]                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Composant :**

- **Message** : "Aucune donnée disponible" ou "Aucun membre ne correspond à ces filtres"
- **Icône** : Icône appropriée (ex: 📊 pour stats, 👥 pour membres)
- **Action** : Bouton "Réinitialiser les filtres"

**Style :**

- **Message** : `font-geist text-center text-lg text-muted-foreground`
- **Icône** : `font-geist text-center text-4xl text-muted-foreground`
- **Bouton** : Bouton secondaire

### 7.3 Loading state

**Structure :**

```
┌─────────────────────────────────────────────────────────────┐
│  Loading State                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ⏳ Chargement…                                       │  │
│  │                                                      │  │
│  │  [Skeleton] [Skeleton] [Skeleton]                    │  │
│  │  [Skeleton] [Skeleton] [Skeleton]                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Composant :**

- **Message** : "Chargement…"
- **Skeleton** : Skeleton ou spinner

**Style :**

- **Message** : `font-geist text-center text-lg text-muted-foreground`
- **Skeleton** : Fond card, bordure border, animation pulse

### 7.4 Error state

**Structure :**

```
┌─────────────────────────────────────────────────────────────┐
│  Error State                                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ⚠️ Erreur de chargement des stats.                  │  │
│  │                                                      │  │
│  │  Vérifie ta connexion puis rafraîchis.               │  │
│  │                                                      │  │
│  │  [Rafraîchir]                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Composant :**

- **Message** : "Erreur de chargement des stats. Vérifie ta connexion puis rafraîchis."
- **Action** : Bouton "Rafraîchir"

**Style :**

- **Message** : `font-geist text-center text-lg text-danger`
- **Icône** : `font-geist text-center text-4xl text-danger`
- **Bouton** : Bouton secondaire

### 7.5 Success state

**Structure :**

```
┌─────────────────────────────────────────────────────────────┐
│  Success State                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ✅ Statut mis à jour avec succès                    │  │
│  │                                                      │  │
│  │  [Fermer]                                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Composant :**

- **Message** : "Statut mis à jour avec succès"
- **Action** : Bouton "Fermer"

**Style :**

- **Message** : `font-geist text-center text-lg font-semibold text-lime`
- **Icône** : `font-geist text-center text-4xl text-lime`
- **Bouton** : Bouton secondaire

### 7.6 States par action

| Action | Loading | Success | Error |
|--------|---------|---------|-------|
| **Valider un membre** | "En cours…" | "Statut mis à jour avec succès" | "Erreur lors de la validation" |
| **Inviter un membre** | "En cours…" | "Invitation prête à envoyer" | "Erreur lors de l'invitation" |
| **Supprimer un membre** | "En cours…" | "Membre supprimé" | "Erreur lors de la suppression" |
| **Ajouter une note** | "En cours…" | "Note enregistrée" | "Erreur lors de l'enregistrement" |

---

## 8. Responsive design

### 8.1 Desktop (full layout)

**Largeur minimum : 1024px**

**Structure :**

- Sidebar fixe (200px largeur, toujours visible)
- Contenu principal scrollable (reste du largeur)
- Tous les filtres affichés en ligne
- Tous les colonnes du tableau affichées
- Pagination en bas du tableau
- Bulk actions en bas du tableau

**Exemple :**

```
┌─────────────────────────────────────────────────────────────┐
│  Header                                                     │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │  Main Content                                    │
│  200px   │  [Section Header]                                │
│          │  [Filtres]                                       │
│          │  [Tableau]                                       │
│          │  [Pagination]                                    │
│          │  [Bulk Actions]                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### 8.2 Tablet (condensed layout)

**Largeur : 768px - 1023px**

**Structure :**

- Sidebar réduite (150px largeur, icônes uniquement)
- Contenu principal scrollable (reste du largeur)
- Filtres condensés (3 filtres en ligne, 1 en bas)
- Colonnes du tableau condensées (Pays, Domaine, Statut, Niveau masquées par défaut)
- Pagination en bas du tableau
- Bulk actions en bas du tableau

**Exemple :**

```
┌─────────────────────────────────────────────────────────────┐
│  Header                                                     │
├────────────┬────────────────────────────────────────────────┤
│ Sidebar    │  Main Content                                   │
│  150px     │  [Section Header]                               │
│            │  [Filtres condensés]                            │
│            │  [Tableau condensé]                             │
│            │  [Pagination]                                   │
│            │  [Bulk Actions]                                 │
└────────────┴────────────────────────────────────────────────┘
```

### 8.3 Mobile (essentiel layout)

**Largeur : < 768px**

**Structure :**

- Sidebar cachable (100% largeur, hamburger menu)
- Contenu principal scrollable (reste du largeur)
- Filtres condensés (2 filtres par ligne, 1 en bas)
- Colonnes du tableau masquées (affichage en cartes)
- Pagination en bas du tableau
- Bulk actions cachés (actions disponibles dans la fenêtre de détails)

**Exemple :**

```
┌─────────────────────────────────────────────────────────────┐
│  Header (Hamburger Menu)                                    │
├─────────────────────────────────────────────────────────────┤
│  Sidebar (Cachable)                                         │
├─────────────────────────────────────────────────────────────┤
│  Main Content                                               │
│  [Section Header]                                           │
│  [Filtres condensés]                                        │
│  [Cartes de membres]                                        │
│  [Pagination]                                               │
└─────────────────────────────────────────────────────────────┘
```

### 8.4 Responsive behavior par section

#### Dashboard

| Écran | Comportement |
|-------|--------------|
| Desktop | 4 KPIs en ligne, 3 breakdowns en ligne, funnel horizontal |
| Tablet | 4 KPIs en ligne (condensés), 2 breakdowns en ligne, funnel condensé |
| Mobile | 2 KPIs par ligne, 1 breakdown par ligne, funnel vertical |

#### Membres

| Écran | Comportement |
|-------|--------------|
| Desktop | Tous les filtres en ligne, toutes les colonnes affichées, tableau |
| Tablet | 3 filtres en ligne, colonnes condensées, tableau |
| Mobile | 2 filtres par ligne, colonnes masquées, cartes |

#### Activité

| Écran | Comportement |
|-------|--------------|
| Desktop | Funnel horizontal, historique détaillé |
| Tablet | Funnel condensé, historique condensé |
| Mobile | Funnel vertical, historique condensé |

#### Exports

| Écran | Comportement |
|-------|--------------|
| Desktop | Tous les formats affichés, colonnes sélectionnables |
| Tablet | Formats condensés, colonnes sélectionnables |
| Mobile | Formats en liste, colonnes sélectionnables |

---

## 9. Accessibilité

### 9.1 Navigation clavier

#### Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Tab` | Navigation entre les éléments focusables |
| `Shift+Tab` | Navigation inverse |
| `Enter` / `Space` | Sélectionner un filtre ou ouvrir une fenêtre de détails |
| `F` | Focus sur le champ de recherche |
| `Escape` | Fermer les fenêtres de détails |
| `?` | Ouvrir le panneau d'aide des raccourcis |
| `G` + `S` | Aller aux Statistiques |
| `G` + `M` | Aller aux Membres |
| `G` + `A` | Aller à l'Activité |
| `G` + `X` | Aller aux Exports |
| `Ctrl+K` / `Cmd+K` | Ouvrir la palette de commandes |

#### Attributs ARIA

- **Boutons** : `aria-label` pour les boutons sans texte visible
- **Checkbox** : `aria-checked` pour indiquer l'état
- **Select** : `aria-label` pour indiquer le rôle
- **Tooltip** : `aria-describedby` pour associer le tooltip au contrôl
- **Sidebar** : `aria-expanded`, `aria-controls` pour les sous-menus

### 9.2 Focus visuel

#### Style de focus

- **Boutons** : Outline coloré (lime) + ombre
- **Liens** : Soulignement + couleur différente
- **Filtres** : Outline clair quand focusé
- **Tableau** : Style de focus sur la ligne sélectionnée

#### Animation de focus

- Flash visuel pour les éléments interactifs (500ms)

### 9.3 Labels associés aux contrôles

#### Attributs `htmlFor`

- **Filtres Select** : `<label htmlFor="filter-domain">Domaine</label>` + `<Select id="filter-domain">`
- **Filtres Input** : `<label htmlFor="search">Recherche</label>` + `<input id="search">`
- **Checkbox** : `<label htmlFor="select-all">Sélectionner tout</label>` + `<input id="select-all">`

### 9.4 Contraste

#### Contraste minimum

- **Texte normal** : 4.5:1 (WCAG AA)
- **Texte large** : 3:1 (WCAG AA)
- **Labels secondaires** : 4.5:1
- **Tags et badges** : 4.5:1

#### Exemples

- **Texte normal** : `text-foreground` sur fond `SURFACE` (#F8FAFC / #141414 = 7.2:1)
- **Labels secondaires** : `text-muted-foreground/80` sur fond `SURFACE` (#94A3B8/80 / #141414 = 5.1:1)
- **Tags** : `text-lime/90` sur fond `bg-lime/5` (#C5F441/90 / #C5F441/5 = 9.5:1)

### 9.5 Rôles ARIA

#### Rôles ARIA pour les composants

| Composant | Rôle ARIA | Utilisation |
|-----------|-----------|-------------|
| Sidebar | `navigation` | Indique la section de navigation |
| Breadcrumbs | `navigation` | Indique la hiérarchie de navigation |
| Tableau | `table` | Indique la structure du tableau |
| Checkbox | `checkbox` | Indique le rôle du contrôl |
| Dialog | `dialog` | Indique la fenêtre de dialogue |
| Tooltip | `tooltip` | Indique le rôle du tooltip |

### 9.6 Raccourcis clavier accessibles

#### Guide des raccourcis

- Ouvrir le guide via `?`
- Afficher une liste des raccourcis clavier avec des descriptions
- Pour chaque raccourci : afficher la description de l'action

#### Palette de commandes

- Ouvrir via `Ctrl+K` ou `Cmd+K`
- Afficher une liste d'actions avec des descriptions
- Actions disponibles :
  - "Valider le membre sélectionné"
  - "Inviter le membre sélectionné"
  - "Rejeter le membre sélectionné"
  - "Supprimer le membre sélectionné"
  - "Filtrer par statut"
  - "Filtrer par domaine"
  - "Exporter CSV"
  - "Exporter JSON"
  - "Rafraîchir les données"
  - "Aller aux Statistiques"
  - "Aller aux Membres"
  - "Aller à l'Activité"
  - "Aller aux Exports"

---

## 10. Animations et transitions

### 10.1 Durées standard

| Élément | Durée | Easing |
|---------|-------|--------|
| **Hover** | 150ms | ease-out |
| **Focus** | 200ms | ease-out |
| **Modal** | 200ms | ease-out |
| **Toast** | 300ms | ease-in-out |
| **Skeleton** | 2s | infinite pulse |

### 10.2 Transitions

#### Hover

```css
transition: all 150ms ease-out;
```

#### Focus

```css
transition: all 200ms ease-out;
```

#### Modal

```css
transition: all 200ms ease-out;
```

#### Toast

```css
transition: all 300ms ease-in-out;
```

### 10.3 Animations

#### Pulse

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

#### Slide-in

```css
@keyframes slide-in {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 200ms ease-out;
}
```

#### Fade-in

```css
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-fade-in {
  animation: fade-in 200ms ease-out;
}
```

#### Slide-up

```css
@keyframes slide-up {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slide-up 200ms ease-out;
}
```

### 10.4 Micro-interactions

#### Hover sur les cartes KPI

- Fond : `bg-elevated/80`
- Bordure : `border-lime/30`
- Texte : `text-lime`
- Ombre : `shadow-md`

#### Hover sur les lignes du tableau

- Fond : `bg-lime/5`
- Bordure : `border-lime/20`

#### Hover sur les boutons

- Fond : `bg-lime/10`
- Bordure : `border-lime/30`
- Texte : `text-lime`

#### Focus sur les éléments

- Outline : `outline-lime outline-2 outline-offset-2`
- Ombre : `shadow-lime`

### 10.5 Animations de chargement

#### Skeleton

```css
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton {
  background: linear-gradient(to right, #2A2A2A 4%, #3A3A3A 25%, #2A2A2A 36%);
  background-size: 1000px 100%;
  animation: shimmer 2s infinite linear;
}
```

#### Spinner

```css
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

---

## 11. Contraintes techniques

### 11.1 Performance

#### Re-rendu inutile

- Utiliser `React.memo` pour les composants qui ne changent pas souvent
- Utiliser `useMemo` pour les calculs coûteux
- Utiliser `useCallback` pour les fonctions passées comme props

#### Surcharge API

- Cacher les données non nécessaires
- Utiliser `debounce` pour les recherches
- Utiliser `pagination` pour les listes longues
- Utiliser `lazy loading` pour les sections lourdes

#### Lazy loading

- Charger les sections lourdes en lazy loading
- Charger les données en chunks
- Utiliser `IntersectionObserver` pour déclencher le chargement

### 11.2 Compatibilité

#### Navigateurs

- Chrome/Edge : 90+
- Firefox : 88+
- Safari : 14+
- Mobile browsers : iOS 14+, Android 10+

#### Support

- CSS Grid : 2017+
- CSS Flexbox : 2012+
- CSS Variables : 2016+
- ES6+ : 2015+

### 11.3 Sécurité

#### XSS

- Utiliser `React` pour échapper le HTML
- Éviter `dangerouslySetInnerHTML` sauf si nécessaire
- Valider toutes les entrées utilisateur

#### CSRF

- Utiliser `SameSite=Lax` pour les cookies
- Utiliser `HttpOnly` pour les cookies sensibles
- Utiliser `CSRF tokens` pour les formulaires

#### Protection contre le clickjacking

- Utiliser `X-Frame-Options: DENY` ou `SAMEORIGIN`
- Utiliser `Content-Security-Policy` pour limiter les frames

### 11.4 Scalabilité

#### Architecture

- Utiliser une architecture modulaire
- Utiliser des composants réutilisables
- Utiliser des hooks personnalisés
- Utiliser des services séparés

#### Base de données

- Utiliser des indexes pour accélérer les requêtes
- Utiliser des transactions pour les opérations atomiques
- Utiliser des requêtes préparées pour éviter les injections SQL

#### Cache

- Utiliser `Cache-Control` pour le cache HTTP
- Utiliser `localStorage` pour le cache client
- Utiliser `Service Worker` pour le cache offline

---

## 12. Références

### 12.1 Design system

- **HASHCODE Design System** : Thème sombre, accents lime, style tech/cybersécurité
- **Tailwind CSS** : Utilisation de la palette de couleurs et des utilitaires
- **shadcn/ui** : Composants de base (buttons, cards, modals, etc.)

### 12.2 Guidelines

- **WCAG 2.1** : Guidelines pour l'accessibilité
- **Material Design** : Patterns de design
- **Fluent UI** : Patterns de design Microsoft

### 12.3 Ressources

- **MDN Web Docs** : Documentation pour les technologies web
- **React Documentation** : Documentation pour React
- **Tailwind CSS Documentation** : Documentation pour Tailwind CSS
- **shadcn/ui Documentation** : Documentation pour shadcn/ui

---

## 13. Glossaire

| Terme | Définition |
|-------|------------|
| **KPI** | Key Performance Indicator — Indicateur de performance clé |
| **Tier** | Niveau de profondeur des métriques (1, 2, 3, 4) |
| **Funnel** | Funnel de conversion — Parcours de conversion |
| **Breakdown** | Breakdown — Détail par dimension |
| **Bulk actions** | Actions en masse — Actions appliquées à plusieurs éléments |
| **Skeleton** | Skeleton — État de chargement |
| **Toast** | Toast — Notification de feedback |
| **Modal** | Modal — Fenêtre de dialogue |
| **Command Palette** | Palette de commandes — Interface de recherche d'actions |
| **Progressive disclosure** | Progressive disclosure — Affichage progressif de l'information |
| **Responsive** | Responsive — Adaptation aux différents écrans |

---

## 14. Conclusion

Cette spécification de design fournit une description détaillée et complète de l'interface admin HASHCODE REBOOT après le redesign. Elle couvre tous les aspects visuels et comportementaux de l'interface, y compris le layout, les composants, la typographie, la palette de couleurs, le responsive, l'accessibilité, les animations et les états.

Les principes de design guident la conception de l'interface :
- **KPI Tiers** : Classification des métriques selon 4 niveaux de profondeur
- **Insight → Action** : Chaque statistique/clique doit mener à une action réelle
- **Minimum clicks** : Optimiser les chemins critiques
- **Progressive disclosure** : Affichage progressif de l'information
- **Performance** : Pas de re-rendu inutile, pas de surcharge API
- **Accessibilité** : WCAG AA minimum (4.5:1 pour texte normal)
- **Responsive** : Desktop (full), Tablet (condensé), Mobile (essentiel)

Cette spécification peut être utilisée par les designers, les développeurs et les testeurs pour implémenter et valider l'interface admin redessinée.

---

**Document créé le :** 06 septembre 2026
**Version :** 1.0
**Auteur :** Phase 4 du projet de redesign HASHCODE REBOOT
**Statut :** Finalisé
