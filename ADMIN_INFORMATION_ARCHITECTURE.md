# ADMIN_INFORMATION_ARCHITECTURE — Interface Admin HASHCODE REBOOT

> **Phase 2 du projet de redesign** — Architecture de l'information de l'interface admin.
>
> **Base de référence** : AUDIT_EXISTANT.md (inventaire technique) + UX_UI_AUDIT.md (analyse des problèmes UX/UI).
>
> **Objectif** : Définir l'architecture de l'information pour créer une interface admin cohérente, efficace et accessible qui résout les problèmes identifiés dans l'audit UX/UI.

---

## 📋 Table des matières

1. [Principes fondamentaux](#1-principes-fondamentaux)
2. [Navigation](#2-navigation)
3. [Dashboard](#3-dashboard)
4. [Structure membres](#4-structure-membres)
5. [Analytics](#5-analytics)
6. [Progressive disclosure](#6-progressivedisclosure)
7. [Règles de navigation](#7-règles-de-navigation)
8. [Responsive behavior](#8-responsivebehavior)
9. [Accessibilité](#9-accessibilité)
10. [Gestion des états](#10-gestion-des-états)

---

## 1. Principes fondamentaux

### 1.1 KPI Tiers — Classification des métriques

L'interface admin doit présenter des métriques classées selon 4 niveaux de profondeur :

| Niveau | Type | Objectif | Présentation |
|--------|------|----------|--------------|
| **Tier 1** | Opérationnel/Action | Actions immédiates, pilotage direct | Cartes cliquables, prévisualisation des résultats, indicateurs de tendance |
| **Tier 2** | Pilotage/Contexte | Compréhension de l'état global | Résumés rapides, indicateurs de tendance, comparaisons |
| **Tier 3** | Analytique | Profondeur d'analyse | Breakdowns détaillés, funnel, comparaisons historiques |
| **Tier 4** | Décoratif | Esthétique uniquement | **À supprimer** (surcharge visuelle, pas d'action)

**Exemples de KPIs par niveau :**
- **Tier 1** : "Inscrits (3)" — Clic → filtre la liste des membres
- **Tier 2** : "3 membres validés, 1 en attente, 1 sur waitlist" — Résumé global
- **Tier 3** : "Taux de complétion du funnel : 45%" — Analyse détaillée
- **Tier 4** : "Statistiques décoratives" — À supprimer

### 1.2 Insight → Action

Chaque statistique/clique doit mener à une action réelle :

| Insight | Action | Résultat |
|---------|--------|----------|
| "Inscrits (3)" | Cliquer sur la carte | Affiche les 3 membres inscrits filtrés |
| "Validés (2)" | Cliquer sur la carte | Affiche les 2 membres validés filtrés |
| "Taux de complétion : 45%" | Cliquer sur le breakdown | Ouvre le funnel détaillé |
| "Waitlist (1)" | Cliquer sur la carte | Affiche le membre sur waitlist |

### 1.3 Minimum clicks

Optimiser les chemins critiques pour réduire le nombre de clics nécessaires :

| Action critique | Chemin actuel | Chemin cible | Économie |
|-----------------|---------------|--------------|----------|
| Voir les membres Cyber | Dashboard → Membres → Filtre Cyber | Dashboard → Clic carte "Cyber" | 2 clics → 1 clic |
| Valider un membre | Membres → Cliquer membre → Fenêtre détails → Bouton Valider | Membres → Cliquer membre → Fenêtre détails → Bouton Valider (inchangé) | - |
| Exporter CSV | Exports → Cliquer bouton Exporter | Exports → Cliquer bouton Exporter (inchangé) | - |
| Aller aux statistiques | Sidebar → Statistiques | Sidebar → Clic "Statistiques" (inchangé) | - |

### 1.4 Progressive disclosure

Ne pas tout afficher d'un coup. L'information doit être présentée de manière hiérarchique :

- **L1 (Essentiel)** : Affiché par défaut (stats globales, liste des membres, filtres principaux)
- **L2 (Détail)** : Accessible via clic ou hover (prévisualisation des détails, tooltips, breakdowns)
- **L3 (Avancé)** : Accessible via actions supplémentaires (fenêtre de détails, exports avancés, analytics détaillés)

### 1.5 Design system HASHCODE

- **Thème** : Sombre (#141414 pour SURFACE)
- **Accents** : Lime (#84cc16) pour les actions positives, Vert (#22c55e) pour succès
- **Style** : Tech/cybersécurité (polices monospaced, bordures fines, icônes tech)
- **Contraste** : WCAG AA minimum (4.5:1 pour texte normal)

### 1.6 Performance

- Pas de re-rendu inutile (optimiser les composants React)
- Pas de surcharge API (cacher les données non nécessaires)
- Lazy loading pour les sections lourdes (analytics détaillés)

### 1.7 Accessibilité WCAG

- Navigation clavier complète (Tab, Shift+Tab, Enter/Space, Escape, ?)
- Focus visuel explicite (outline coloré + ombre)
- Labels associés aux contrôles (htmlFor)
- Contraste suffisant (4.5:1 pour texte normal)

### 1.8 Responsive

- **Desktop** : Full layout (sidebar fixe, contenu principal scrollable)
- **Tablet** : Layout condensé (sidebar réduite, contenu plus compact)
- **Mobile** : Layout essentiel (sidebar cachable, contenu scrollable)

---

## 2. Navigation

### 2.1 Structure globale

```
┌─────────────────────────────────────────────────────────────┐
│  Header (Logo + Breadcrumbs + Actions globales)              │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Sidebar     │  Main Content                                │
│              │                                              │
│  - Dashboard │  - Section Header (title + description)      │
│  - Membres   │  - Section Content (stats/filters/list)       │
│  - Activité  │                                              │
│  - Exports   │                                              │
│  - Paramètres│                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 2.2 Sidebar (AdminSidebar)

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

### 2.3 Breadcrumbs

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

### 2.4 Navigation entre sections

**Chemins de navigation :**

| Section actuelle | Cible | Chemin | Clics |
|------------------|-------|--------|-------|
| Dashboard | Membres | Sidebar > Membres | 1 |
| Dashboard | Activité | Sidebar > Activité | 1 |
| Dashboard | Exports | Sidebar > Exports | 1 |
| Membres | Dashboard | Breadcrumb > Admin | 1 |
| Membres | Activité | Breadcrumb > Admin > Activité | 2 |
| Membres | Exports | Breadcrumb > Admin > Exports | 2 |

### 2.5 Navigation clavier

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

---

## 3. Dashboard

### 3.1 Organisation des sections

```
┌─────────────────────────────────────────────────────────────┐
│  Header (Breadcrumbs + Actions globales)                    │
├─────────────────────────────────────────────────────────────┤
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

### 3.2 Section Header

**Structure :**

| Élément | Contenu | Comportement |
|---------|---------|--------------|
| **Title** | "Vue d'ensemble" | - |
| **Subtitle** | "Statistiques globales et filtres rapides" | - |
| **Actions** | [Exporter CSV] [Rafraîchir] | Cliquer → Action correspondante |

**Style :**

- **Title** : `text-foreground text-lg font-semibold`
- **Subtitle** : `text-muted-foreground text-sm`
- **Actions** : Boutons primaires (fond lime, texte noir)

### 3.3 KPI Tier 1 (Opérationnel/Action)

**Structure :**

| Carte | Contenu | Comportement | Accessibilité |
|-------|---------|--------------|---------------|
| **Inscrits** | "Inscrits (3)" | Cliquer → Filtre les membres par statut INSCRIT | aria-label="Filtrer les membres par statut INSCRIT (3 résultats)" |
| **Validés** | "Validés (2)" | Cliquer → Filtre les membres par statut VALIDÉ | aria-label="Filtrer les membres par statut VALIDÉ (2 résultats)" |
| **En attente** | "En attente (1)" | Cliquer → Filtre les membres par statut EN ATTENTE | aria-label="Filtrer les membres par statut EN ATTENTE (1 résultat)" |
| **Waitlist** | "Waitlist (1)" | Cliquer → Filtre les membres par statut WAITLIST | aria-label="Filtrer les membres par statut WAITLIST (1 résultat)" |

**Preview indicators :**

- Chaque carte affiche le nombre de résultats filtrés (ex: "Inscrits (3)")
- Carte avec filtre actif : affiche l'indicateur visuel (cercle vert) + nombre de résultats

**Style :**

- **Label** : `text-foreground text-sm font-semibold`
- **Nombre** : `text-lime text-lg font-bold`
- **Preview** : `text-muted-foreground text-xs` (ex: "(3)")

**Responsive behavior :**

- **Desktop** : 4 cartes en ligne
- **Tablet** : 4 cartes en ligne (condensées)
- **Mobile** : 2 cartes par ligne

### 3.4 Résumé rapide (Tier 2 - Pilotage/Contexte)

**Structure :**

```
"3 membres validés, 1 en attente, 1 sur waitlist"
```

**Composant :**

- **Label** : `text-muted-foreground text-sm`
- **Valeur** : `text-foreground text-sm font-semibold`
- **Indicateur de tendance** : Flèche vers le haut/bas + pourcentage

**Style :**

- **Label** : `text-muted-foreground text-xs`
- **Valeur** : `text-foreground text-sm font-semibold`
- **Tendance** : `text-green text-xs` (flèche + pourcentage)

### 3.5 Breakdowns (Tier 3 - Analytique)

**Structure :**

| Breakdown | Contenu | Comportement |
|-----------|---------|--------------|
| **Par domaine** | Barres ou cartes avec pourcentage par domaine | Cliquer → Filtre les membres par domaine |
| **Par pays** | Barres ou cartes avec pourcentage par pays | Cliquer → Filtre les membres par pays |
| **Par statut** | Barres ou cartes avec pourcentage par statut | Cliquer → Filtre les membres par statut |

**Preview indicators :**

- Chaque breakdown affiche le nombre de membres par catégorie (ex: "Cyber : 2 (66%)")
- Carte avec filtre actif : affiche l'indicateur visuel (cercle vert) + nombre de résultats

**Style :**

- **Label** : `text-foreground text-sm font-semibold`
- **Valeur** : `text-lime text-sm font-bold`
- **Pourcentage** : `text-muted-foreground text-xs` (ex: "66%")

**Responsive behavior :**

- **Desktop** : 3 breakdowns en ligne
- **Tablet** : 2 breakdowns en ligne (1 en bas)
- **Mobile** : 1 breakdown par ligne

### 3.6 Funnel (Tier 3 - Analytique)

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
- **Taux de complétion** : `text-lime text-sm font-bold`
- **Labels** : `text-muted-foreground text-xs`

**Responsive behavior :**

- **Desktop** : Funnel horizontal
- **Tablet** : Funnel condensé (2 lignes)
- **Mobile** : Funnel vertical (1 étape par ligne)

### 3.7 Actions rapides

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

## 4. Structure membres

### 4.1 Liste des membres

**Structure :**

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
│  │  Nom  │ Pays │ Domaine │ Statut │ Niveau │ Actions │  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  M1   │  FR  │  Cyber  │ VALIDÉ │  L1   │ [👁️] [⋮] │  │  │
│  │  M2   │  CN  │  Web    │ PENDING│  L2   │ [👁️] [⋮] │  │  │
│  │  M3   │  CM  │  AI     │ INSCRIT│  L1   │ [👁️] [⋮] │  │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Pagination                                                 │
│  [←] 1 2 3 [→]                                              │
├─────────────────────────────────────────────────────────────┤
│  Bulk actions                                                │
│  [Valider] [Inviter] [Waitlist] [Rejeter] [Supprimer]      │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Filtres

**Structure :**

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

- **Label** : `text-muted-foreground text-xs font-semibold`
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

### 4.3 Résultats

**Structure :**

```
"3 membres trouvés"
```

**Composant :**

- **Label** : `text-muted-foreground text-xs`
- **Valeur** : `text-foreground text-sm font-semibold`
- **Indicateur de tendance** : Flèche vers le haut/bas + pourcentage

**Style :**

- **Label** : `text-muted-foreground text-xs`
- **Valeur** : `text-foreground text-sm font-semibold`
- **Tendance** : `text-green text-xs` (flèche + pourcentage)

### 4.4 Tableau des membres

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

- **En-têtes** : `text-muted-foreground text-xs font-semibold uppercase`
- **Lignes** : Fond card, texte foreground, bordure border
- **Ligne sélectionnée** : Fond lime/10, bordure lime
- **Ligne hover** : Fond lime/5

**Responsive behavior :**

- **Desktop** : Toutes les colonnes affichées
- **Tablet** : Colonnes condensées (Pays, Domaine, Statut, Niveau masquées par défaut)
- **Mobile** : Colonnes masquées, affichage en cartes (1 membre par carte)

### 4.5 Pagination

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

### 4.6 Bulk actions

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

- **Boutons destructifs** : Fond destructive, texte blanc, bordure destructive
- **Boutons primaires** : Fond lime, texte noir, bordure lime
- **Boutons secondaires** : Fond transparent, texte foreground, bordure border
- **Loading state** : Bouton désactivé avec icône de chargement

**Responsive behavior :**

- **Desktop** : Bulk actions en bas du tableau
- **Tablet** : Bulk actions en bas du tableau (condensés)
- **Mobile** : Bulk actions cachés (actions disponibles dans la fenêtre de détails)

### 4.7 Prévisualisation au survol

**Structure :**

- Au survol de la ligne → Affiche le nom, statut, et domaine dans une tooltip
- Pour les membres avec note interne → Affiche un indicateur visuel

**Style :**

- **Tooltip** : Fond card, texte foreground, bordure border
- **Nom** : `text-foreground text-sm font-semibold`
- **Statut** : `text-lime text-xs` (si VALIDÉ) ou `text-yellow text-xs` (si PENDING)
- **Domaine** : `text-muted-foreground text-xs`

---

## 5. Analytics

### 5.1 KPIs analytiques

**Structure :**

| KPI | Contenu | Comportement | Accessibilité |
|-----|---------|--------------|---------------|
| **Taux de complétion** | "Taux de complétion global : 45%" | Cliquer → Ouvre le funnel détaillé | aria-label="Ouvrir le funnel détaillé" |
| **Membres actifs** | "Membres actifs : 3" | Cliquer → Filtre les membres par statut ACTIF | aria-label="Filtrer les membres par statut ACTIF (3 résultats)" |
| **Taux de conversion** | "Taux de conversion : 60%" | Cliquer → Affiche le breakdown par statut | aria-label="Afficher le breakdown par statut" |

**Style :**

- **Label** : `text-muted-foreground text-xs`
- **Valeur** : `text-foreground text-sm font-semibold`
- **Pourcentage** : `text-lime text-sm font-bold`

### 5.2 Breakdowns

**Structure :**

| Breakdown | Contenu | Comportement | Accessibilité |
|-----------|---------|--------------|---------------|
| **Par domaine** | Barres ou cartes avec pourcentage par domaine | Cliquer → Filtre les membres par domaine | aria-label="Filtrer par domaine" |
| **Par pays** | Barres ou cartes avec pourcentage par pays | Cliquer → Filtre les membres par pays | aria-label="Filtrer par pays" |
| **Par statut** | Barres ou cartes avec pourcentage par statut | Cliquer → Filtre les membres par statut | aria-label="Filtrer par statut" |

**Preview indicators :**

- Chaque breakdown affiche le nombre de membres par catégorie (ex: "Cyber : 2 (66%)")
- Carte avec filtre actif : affiche l'indicateur visuel (cercle vert) + nombre de résultats

**Style :**

- **Label** : `text-foreground text-sm font-semibold`
- **Valeur** : `text-lime text-sm font-bold`
- **Pourcentage** : `text-muted-foreground text-xs` (ex: "66%")

**Responsive behavior :**

- **Desktop** : 3 breakdowns en ligne
- **Tablet** : 2 breakdowns en ligne (1 en bas)
- **Mobile** : 1 breakdown par ligne

### 5.3 Funnel

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
- **Taux de complétion** : `text-lime text-sm font-bold`
- **Labels** : `text-muted-foreground text-xs`

**Responsive behavior :**

- **Desktop** : Funnel horizontal
- **Tablet** : Funnel condensé (2 lignes)
- **Mobile** : Funnel vertical (1 étape par ligne)

### 5.4 Comparaisons

**Structure :**

| Comparaison | Contenu | Comportement |
|-------------|---------|--------------|
| **Comparaison mensuelle** | Graphique avec barres pour le mois en cours et le mois précédent | Cliquer → Affiche les données détaillées |
| **Comparaison annuelle** | Graphique avec barres pour l'année en cours et l'année précédente | Cliquer → Affiche les données détaillées |

**Style :**

- **Graphique** : Barres avec légende (mois en cours, mois précédent)
- **Légende** : Fond card, texte foreground, bordure border
- **Clic sur barre** : Affiche les données détaillées

**Responsive behavior :**

- **Desktop** : Graphique horizontal
- **Tablet** : Graphique condensé
- **Mobile** : Graphique vertical

---

## 6. Progressive disclosure

### 6.1 Niveaux d'information

| Niveau | Présentation | Accès |
|--------|--------------|-------|
| **L1 (Essentiel)** | Affiché par défaut | - |
| **L2 (Détail)** | Accessible via clic ou hover | Clic, hover, prévisualisation |
| **L3 (Avancé)** | Accessible via actions supplémentaires | Fenêtre de détails, exports avancés, analytics détaillés |

### 6.2 L1 — Essentiel

**Affiché par défaut :**

- KPIs globaux (Tier 1)
- Liste des membres
- Filtres principaux
- Pagination
- Bulk actions

**Exemples :**

- Carte "Inscrits (3)" — Affiché par défaut
- Tableau des membres — Affiché par défaut
- Champ de recherche — Affiché par défaut

### 6.3 L2 — Détail

**Accessible via clic ou hover :**

- Prévisualisation des détails au survol de la ligne
- Tooltips pour les en-têtes de tableau
- Breakdowns (par domaine, par pays, par statut)
- Funnel (téléchargement)

**Exemples :**

- Tooltip au survol de la ligne → Affiche le nom, statut, et domaine
- Clic sur la carte "Validés (2)" → Affiche les 2 membres validés filtrés
- Clic sur le breakdown "Par domaine" → Affiche les membres filtrés par domaine

### 6.4 L3 — Avancé

**Accessible via actions supplémentaires :**

- Fenêtre de détails du membre (MemberDetailDialog)
- Exports avancés (choix des colonnes)
- Analytics détaillés (graphiques, données historiques)
- Palette de commandes

**Exemples :**

- Clic sur le nom d'un membre → Ouvre la fenêtre de détails
- Clic sur "Exporter CSV" → Ouvre la fenêtre de dialogue pour choisir les colonnes
- Clic sur "Analytics détaillés" → Affiche les graphiques et données historiques

### 6.5 Progressive disclosure pour les filtres

**L1 (Essentiel) :**

- Recherche
- Domaine
- Pays
- Statut

**L2 (Détail) :**

- Niveau
- Objectif
- Mentorat

**L3 (Avancé) :**

- Budget
- Date d'inscription
- Autres filtres avancés

**Accès :**

- Filtres L1 : Affichés par défaut
- Filtres L2 : Accessibles via clic sur "Afficher plus de filtres"
- Filtres L3 : Accessibles via clic sur "Afficher tous les filtres"

---

## 7. Règles de navigation

### 7.1 Minimum de clics

**Optimiser les chemins critiques :**

| Action critique | Chemin actuel | Chemin cible | Économie |
|-----------------|---------------|--------------|----------|
| Voir les membres Cyber | Dashboard → Membres → Filtre Cyber | Dashboard → Clic carte "Cyber" | 2 clics → 1 clic |
| Valider un membre | Membres → Cliquer membre → Fenêtre détails → Bouton Valider | Membres → Cliquer membre → Fenêtre détails → Bouton Valider | - |
| Exporter CSV | Exports → Cliquer bouton Exporter | Exports → Cliquer bouton Exporter | - |
| Aller aux statistiques | Sidebar → Statistiques | Sidebar → Clic "Statistiques" | - |

### 7.2 Hiérarchie claire

**Structure hiérarchique :**

```
Admin (Niveau 0)
├── Dashboard (Niveau 1)
├── Membres (Niveau 1)
│   ├── Par domaine (Niveau 2)
│   ├── Par pays (Niveau 2)
│   ├── Par statut (Niveau 2)
├── Activité (Niveau 1)
│   ├── Funnel (Niveau 2)
│   ├── Historique (Niveau 2)
├── Exports (Niveau 1)
│   ├── CSV (Niveau 2)
│   ├── JSON (Niveau 2)
└── Paramètres (Niveau 1)
```

**Navigation :**

- **Niveau 0 → Niveau 1** : Sidebar
- **Niveau 1 → Niveau 2** : Breadcrumbs ou sous-menu
- **Niveau 2 → Niveau 1** : Breadcrumbs
- **Niveau 2 → Niveau 0** : Breadcrumbs

### 7.3 Retour facile

**Retour vers la section précédente :**

- **Breadcrumbs** : Cliquer sur le niveau précédent
- **Sidebar** : Cliquer sur la section parente
- **Navigation clavier** : `Shift+Tab` pour revenir en arrière

**Retour vers la page précédente :**

- **Navigation clavier** : `Alt+Left` ou `Alt+Right`
- **Historique du navigateur** : `Ctrl+H` ou `Cmd+H`

### 7.4 Navigation contextuelle

**Navigation basée sur le contexte :**

- Si l'utilisateur est sur la page "Membres" et clique sur "Validés (2)" → Filtre les membres par statut VALIDÉ
- Si l'utilisateur est sur la page "Dashboard" et clique sur "Membres" → Navigue vers la page "Membres"
- Si l'utilisateur est sur la page "Membres" et clique sur "Dashboard" → Navigue vers la page "Dashboard"

### 7.5 Navigation sans perte

**Prévenir la perte de données :**

- **Filtres actifs** : Garder les filtres actifs après navigation entre les sections
- **Sélection** : Garder la sélection des membres après navigation entre les pages
- **Progression** : Garder la progression (page courante) après navigation entre les pages

---

## 8. Responsive behavior

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

**Dashboard :**

| Écran | Comportement |
|-------|--------------|
| Desktop | 4 KPIs en ligne, 3 breakdowns en ligne, funnel horizontal |
| Tablet | 4 KPIs en ligne (condensés), 2 breakdowns en ligne, funnel condensé |
| Mobile | 2 KPIs par ligne, 1 breakdown par ligne, funnel vertical |

**Membres :**

| Écran | Comportement |
|-------|--------------|
| Desktop | Tous les filtres en ligne, toutes les colonnes affichées, tableau |
| Tablet | 3 filtres en ligne, colonnes condensées, tableau |
| Mobile | 2 filtres par ligne, colonnes masquées, cartes |

**Activité :**

| Écran | Comportement |
|-------|--------------|
| Desktop | Funnel horizontal, historique détaillé |
| Tablet | Funnel condensé, historique condensé |
| Mobile | Funnel vertical, historique condensé |

**Exports :**

| Écran | Comportement |
|-------|--------------|
| Desktop | Tous les formats affichés, colonnes sélectionnables |
| Tablet | Formats condensés, colonnes sélectionnables |
| Mobile | Formats en liste, colonnes sélectionnables |

---

## 9. Accessibilité

### 9.1 Navigation clavier

**Raccourcis clavier :**

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

**Attributs ARIA :**

- **Boutons** : `aria-label` pour les boutons sans texte visible
- **Checkbox** : `aria-checked` pour indiquer l'état
- **Select** : `aria-label` pour indiquer le rôle
- **Tooltip** : `aria-describedby` pour associer le tooltip au contrôl
- **Sidebar** : `aria-expanded`, `aria-controls` pour les sous-menus

### 9.2 Focus visuel

**Style de focus :**

- **Boutons** : Outline coloré (lime) + ombre
- **Liens** : Soulignement + couleur différente
- **Filtres** : Outline clair quand focusé
- **Tableau** : Style de focus sur la ligne sélectionnée

**Animation de focus :**

- Flash visuel pour les éléments interactifs (500ms)

### 9.3 Labels associés aux contrôles

**Attributs `htmlFor` :**

- **Filtres Select** : `<label htmlFor="filter-domain">Domaine</label>` + `<Select id="filter-domain">`
- **Filtres Input** : `<label htmlFor="search">Recherche</label>` + `<input id="search">`
- **Checkbox** : `<label htmlFor="select-all">Sélectionner tout</label>` + `<input id="select-all">`

### 9.4 Contraste

**Contraste minimum :**

- **Texte normal** : 4.5:1 (WCAG AA)
- **Texte large** : 3:1 (WCAG AA)
- **Labels secondaires** : 4.5:1
- **Tags et badges** : 4.5:1

**Exemples :**

- **Texte normal** : `text-foreground` sur fond `SURFACE` (#141414) → Contraste OK
- **Labels secondaires** : `text-muted-foreground/80` sur fond `SURFACE` → Contraste OK
- **Tags** : `text-lime/90` sur fond `bg-lime/5` → Contraste OK

### 9.5 Rôles ARIA

**Rôles ARIA pour les composants :**

| Composant | Rôle ARIA | Utilisation |
|-----------|-----------|-------------|
| Sidebar | `navigation` | Indique la section de navigation |
| Breadcrumbs | `navigation` | Indique la hiérarchie de navigation |
| Tableau | `table` | Indique la structure du tableau |
| Checkbox | `checkbox` | Indique le rôle du contrôl |
| Dialog | `dialog` | Indique la fenêtre de dialogue |
| Tooltip | `tooltip` | Indique le rôle du tooltip |

### 9.6 Raccourcis clavier accessibles

**Guide des raccourcis :**

- Ouvrir le guide via `?`
- Afficher une liste des raccourcis clavier avec des descriptions
- Pour chaque raccourci : afficher la description de l'action

**Palette de commandes :**

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

## 10. Gestion des états

### 10.1 States par section

| Section | Empty | Loading | Error | Success |
|---------|-------|---------|-------|---------|
| **Dashboard** | "Aucune donnée disponible" | Skeleton ou spinner | "Erreur de chargement des stats" | "Données mises à jour avec succès" |
| **Membres** | "Aucun membre ne correspond à ces filtres" | Skeleton ou spinner | "Erreur de chargement des membres" | "Membres filtrés avec succès" |
| **Activité** | "Aucune donnée analytics pour l'instant" | Skeleton ou spinner | "Erreur de chargement des analytics" | "Analytics mis à jour avec succès" |
| **Exports** | "Aucun export disponible" | Skeleton ou spinner | "Erreur de chargement des exports" | "Export téléchargé avec succès" |

### 10.2 Empty state

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

- **Message** : `text-muted-foreground text-center text-lg`
- **Icône** : `text-muted-foreground text-4xl`
- **Bouton** : Bouton secondaire

### 10.3 Loading state

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

- **Message** : `text-muted-foreground text-center text-lg`
- **Skeleton** : Fond card, bordure border, animation pulse

### 10.4 Error state

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

- **Message** : `text-destructive text-center text-lg`
- **Icône** : `text-destructive text-4xl`
- **Bouton** : Bouton secondaire

### 10.5 Success state

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

- **Message** : `text-lime text-center text-lg font-semibold`
- **Icône** : `text-lime text-4xl`
- **Bouton** : Bouton secondaire

### 10.6 States par action

| Action | Loading | Success | Error |
|--------|---------|---------|-------|
| **Valider un membre** | "En cours…" | "Statut mis à jour avec succès" | "Erreur lors de la validation" |
| **Inviter un membre** | "En cours…" | "Invitation prête à envoyer" | "Erreur lors de l'invitation" |
| **Supprimer un membre** | "En cours…" | "Membre supprimé" | "Erreur lors de la suppression" |
| **Filtrer les membres** | "Chargement…" | "Membres filtrés avec succès" | "Erreur lors du filtrage" |
| **Exporter CSV** | "En cours…" | "Export téléchargé avec succès" | "Erreur lors de l'export" |

### 10.7 Feedback immédiat

**Structure :**

- **Toast** : Message de succès/erreur
- **Message** : Affiché en haut de la page ou dans une fenêtre de dialogue
- **Icône** : Icône appropriée (✅ pour succès, ❌ pour erreur)
- **Action** : Bouton "Fermer" pour fermer le toast

**Style :**

- **Toast** : Fond card, texte foreground, bordure border
- **Succès** : Couleur lime, icône de succès
- **Erreur** : Couleur destructive, icône d'erreur
- **Message** : `text-foreground text-sm font-semibold`

---

## 11. Résumé des recommandations

### 11.1 Navigation

- [x] Implémenter un menu latéral fixe (AdminSidebar) avec liens cliquables vers les sections
- [x] Ajouter des labels explicites pour chaque section
- [x] Ajouter des breadcrumbs pour montrer la hiérarchie de navigation
- [x] Ajouter des raccourcis clavier pour toutes les actions courantes
- [x] Ajouter une palette de commandes (Command Palette)

### 11.2 Dashboard

- [x] Organiser les sections (Stats, Membres, Activité, Exports)
- [x] Ajouter des KPIs Tier 1 (Opérationnel/Action)
- [x] Ajouter un résumé rapide des données clés (Tier 2)
- [x] Ajouter des breakdowns (Tier 3)
- [x] Ajouter un funnel de conversion
- [x] Ajouter des actions rapides

### 11.3 Structure membres

- [x] Placer les filtres en haut de la page
- [x] Ajouter des labels explicites pour les en-têtes de tableau
- [x] Ajouter des tooltips pour les en-têtes de tableau
- [x] Ajouter une prévisualisation au survol
- [x] Optimiser la pagination
- [x] Ajouter des bulk actions avec confirmation

### 11.4 Analytics

- [x] Présenter les KPIs analytiques
- [x] Ajouter des breakdowns détaillés
- [x] Ajouter un funnel de conversion
- [x] Ajouter des comparaisons historiques

### 11.5 Progressive disclosure

- [x] Définir les niveaux d'information (L1, L2, L3)
- [x] Afficher par défaut les éléments L1
- [x] Accessible via clic ou hover pour les éléments L2
- [x] Accessible via actions supplémentaires pour les éléments L3

### 11.6 Règles de navigation

- [x] Optimiser les chemins critiques (minimum de clics)
- [x] Définir une hiérarchie claire
- [x] Faciliter le retour facile
- [x] Optimiser la navigation contextuelle
- [x] Prévenir la perte de données

### 11.7 Responsive

- [x] Définir le layout pour desktop (full)
- [x] Définir le layout pour tablet (condensé)
- [x] Définir le layout pour mobile (essentiel)
- [x] Adapter chaque section au responsive

### 11.8 Accessibilité

- [x] Ajouter une navigation clavier complète
- [x] Améliorer le style de focus visuel
- [x] Ajouter des labels associés aux contrôles
- [x] Vérifier le contraste des textes
- [x] Ajouter des rôles ARIA
- [x] Ajouter un guide des raccourcis clavier

### 11.9 Gestion des états

- [x] Ajouter des states "empty" pour chaque section
- [x] Ajouter des states "loading" pour chaque section
- [x] Ajouter des states "error" pour chaque section
- [x] Ajouter des states "success" pour les actions
- [x] Ajouter un feedback immédiat pour chaque action

---

## 12. Conclusion

Cette architecture de l'information pour l'interface admin HASHCODE vise à créer une interface cohérente, efficace et accessible qui résout les problèmes identifiés dans l'audit UX/UI.

**Principaux objectifs :**

1. **KPI Tiers** : Classer les métriques selon 4 niveaux de profondeur (Tier 1, Tier 2, Tier 3, Tier 4)
2. **Insight → Action** : Chaque statistique/clique doit mener à une action réelle
3. **Minimum clicks** : Optimiser les chemins critiques pour réduire le nombre de clics nécessaires
4. **Progressive disclosure** : Ne pas tout afficher d'un coup. L'information doit être présentée de manière hiérarchique
5. **Design system HASHCODE** : Thème sombre, accents lime/vert, style tech/cybersécurité
6. **Performance** : Pas de re-rendu inutile, pas de surcharge API
7. **Accessibilité WCAG** : Navigation clavier complète, focus visuel explicite, labels associés aux contrôles, contraste suffisant
8. **Responsive** : Desktop (full), Tablet (condensé), Mobile (essentiel)

**Prochaines étapes :**

1. **Phase 3 (Data Experience)** : Définir l'expérience des données (schema, types, validation, cache)
2. **Phase 4 (Design Spec)** : Définir les spécifications de design (components, tokens, patterns)
3. **Phase 5 (Implementation)** : Implémenter le design system et l'interface admin

---

**Document généré le :** 2026-09-06
**Version :** 1.0
**Auteur :** worker-zhipu (GLM 4.7 Flash, FREE)
**Projet :** HASHCODE REBOOT — Redesign de l'interface admin
