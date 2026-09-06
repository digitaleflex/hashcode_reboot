# DATA EXPERIENCE AUDIT — Interface Admin HASHCODE REBOOT

> **Phase 3 du projet de redesign** — Analyse de l'expérience des données dans l'interface admin.
>
> **Base de référence** : AUDIT_EXISTANT.md (inventaire technique) + UX_UI_AUDIT.md (analyse des problèmes UX/UI) + ADMIN_INFORMATION_ARCHITECTURE.md (architecture de l'information).
>
> **Objectif** : Définir une expérience de données claire, cohérente et actionnable qui permet aux administrateurs de comprendre rapidement l'état global de l'application et de prendre des décisions basées sur les données.

---

## 📋 Table des matières

1. [Principes fondamentaux](#1-principes-fondamentaux)
2. [KPIs](#2-kpis)
3. [Dimensions](#3-dimensions)
4. [Qualité des données](#4-qualité-des-données)
5. [Calculs](#5-calculs)
6. [Insight → Action](#6-insight-action)
7. [Actions requises](#7-actions-requises)
8. [Data Health](#8-data-health)
9. [Funnel Honesty](#9-funnel-honesty)
10. [Données manquantes](#10-données-manquantes)

---

## 1. Principes fondamentaux

### 1.1 KPI Tiers — Classification des métriques

L'interface admin doit présenter des métriques classées selon 4 niveaux de profondeur :

| Niveau | Type | Objectif | Présentation | Actions possibles |
|--------|------|----------|--------------|-------------------|
| **Tier 1** | Opérationnel/Action | Actions immédiates, pilotage direct | Cartes cliquables, prévisualisation des résultats, indicateurs de tendance | Filtrer les membres, ouvrir les détails |
| **Tier 2** | Pilotage/Contexte | Compréhension de l'état global | Résumés rapides, indicateurs de tendance, comparaisons | Naviguer vers les sections, exporter les données |
| **Tier 3** | Analytique | Profondeur d'analyse | Breakdowns détaillés, funnel, comparaisons historiques | Télécharger les données, filtrer par dimension |
| **Tier 4** | Décoratif | Esthétique uniquement | **À supprimer** (surcharge visuelle, pas d'action) | - |

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
| Valider un membre | Membres → Cliquer membre → Fenêtre détails → Bouton Valider | Membres → Cliquer membre → Fenêtre détails → Bouton Valider | - |
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

## 2. KPIs

### 2.1 KPIs Tier 1 — Opérationnel/Action

#### KPI-01 : Inscrits

| Élément | Contenu |
|---------|---------|
| **Nom** | Inscrits |
| **Label** | Inscrits (3) |
| **Tier** | Tier 1 (Opérationnel/Action) |
| **Formule de calcul** | COUNT(membres WHERE statut = 'INSCRIT') |
| **Source de données** | Table `members`, colonne `status` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Insight → Action** | Cliquer sur la carte → Filtre la liste des membres par statut INSCRIT |
| **Preview** | Affiche le nombre de membres filtrés (ex: "3 membres trouvés") |
| **Accessibilité** | aria-label="Filtrer les membres par statut INSCRIT (3 résultats)" |

**Style :**
- Label : `text-foreground text-sm font-semibold`
- Nombre : `text-lime text-lg font-bold`
- Preview : `text-muted-foreground text-xs` (ex: "(3)")

---

#### KPI-02 : Validés

| Élément | Contenu |
|---------|---------|
| **Nom** | Validés |
| **Label** | Validés (2) |
| **Tier** | Tier 1 (Opérationnel/Action) |
| **Formule de calcul** | COUNT(membres WHERE statut = 'VALIDÉ') |
| **Source de données** | Table `members`, colonne `status` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Insight → Action** | Cliquer sur la carte → Filtre la liste des membres par statut VALIDÉ |
| **Preview** | Affiche le nombre de membres filtrés (ex: "2 membres trouvés") |
| **Accessibilité** | aria-label="Filtrer les membres par statut VALIDÉ (2 résultats)" |

**Style :**
- Label : `text-foreground text-sm font-semibold`
- Nombre : `text-lime text-lg font-bold`
- Preview : `text-muted-foreground text-xs` (ex: "(2)")

---

#### KPI-03 : En attente

| Élément | Contenu |
|---------|---------|
| **Nom** | En attente |
| **Label** | En attente (1) |
| **Tier** | Tier 1 (Opérationnel/Action) |
| **Formule de calcul** | COUNT(membres WHERE statut = 'EN ATTENTE') |
| **Source de données** | Table `members`, colonne `status` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Insight → Action** | Cliquer sur la carte → Filtre la liste des membres par statut EN ATTENTE |
| **Preview** | Affiche le nombre de membres filtrés (ex: "1 membre trouvé") |
| **Accessibilité** | aria-label="Filtrer les membres par statut EN ATTENTE (1 résultat)" |

**Style :**
- Label : `text-foreground text-sm font-semibold`
- Nombre : `text-yellow text-lg font-bold`
- Preview : `text-muted-foreground text-xs` (ex: "(1)")

---

#### KPI-04 : Waitlist

| Élément | Contenu |
|---------|---------|
| **Nom** | Waitlist |
| **Label** | Waitlist (1) |
| **Tier** | Tier 1 (Opérationnel/Action) |
| **Formule de calcul** | COUNT(membres WHERE statut = 'WAITLIST') |
| **Source de données** | Table `members`, colonne `status` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Insight → Action** | Cliquer sur la carte → Filtre la liste des membres par statut WAITLIST |
| **Preview** | Affiche le nombre de membres filtrés (ex: "1 membre trouvé") |
| **Accessibilité** | aria-label="Filtrer les membres par statut WAITLIST (1 résultat)" |

**Style :**
- Label : `text-foreground text-sm font-semibold`
- Nombre : `text-blue text-lg font-bold`
- Preview : `text-muted-foreground text-xs` (ex: "(1)")

---

### 2.2 KPIs Tier 2 — Pilotage/Contexte

#### KPI-05 : Résumé global

| Élément | Contenu |
|---------|---------|
| **Nom** | Résumé global |
| **Label** | 3 membres validés, 1 en attente, 1 sur waitlist |
| **Tier** | Tier 2 (Pilotage/Contexte) |
| **Formule de calcul** | Combiné des KPIs Tier 1 |
| **Source de données** | Agrégation des données membres |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Insight → Action** | Navigue vers la section Membres pour voir la liste complète |
| **Preview** | Affiche le nombre total de membres (ex: "5 membres au total") |
| **Accessibilité** | aria-label="Résumé global : 3 membres validés, 1 en attente, 1 sur waitlist" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-foreground text-sm font-semibold`
- Tendance : `text-green text-xs` (flèche + pourcentage)

---

#### KPI-06 : Taux de conversion (Inscription → Validation)

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de conversion |
| **Label** | Taux de conversion : 60% (2/3) |
| **Tier** | Tier 2 (Pilotage/Contexte) |
| **Formule de calcul** | (COUNT(membres WHERE statut = 'VALIDÉ') / COUNT(membres WHERE statut IN ('INSCRIT', 'VALIDÉ'))) × 100 |
| **Source de données** | Table `members`, colonne `status` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Insight → Action** | Cliquer sur le label → Affiche le breakdown par statut |
| **Preview** | Affiche le nombre de membres validés vs inscrits |
| **Accessibilité** | aria-label="Taux de conversion : 60% (2/3 membres validés)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-lime text-sm font-bold`
- Pourcentage : `text-muted-foreground text-xs` (ex: "60%")

---

#### KPI-07 : Taux de complétion du profil moyen

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de complétion du profil moyen |
| **Label** | Taux de complétion : 72% |
| **Tier** | Tier 2 (Pilotage/Contexte) |
| **Formule de calcul** | (SUM(nombre de champs remplis) / SUM(nombre total de champs)) × 100 |
| **Source de données** | Table `members`, agrégation des champs (nom, email, pays, domaine, niveau, etc.) |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Insight → Action** | Cliquer sur le label → Affiche les profils incomplets |
| **Preview** | Affiche le nombre de membres avec profil incomplet (ex: "1 membre sur 5") |
| **Accessibilité** | aria-label="Taux de complétion du profil moyen : 72%" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-lime text-sm font-bold`
- Pourcentage : `text-muted-foreground text-xs` (ex: "72%")

---

### 2.3 KPIs Tier 3 — Analytique

#### KPI-08 : Taux de complétion du funnel global

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de complétion du funnel |
| **Label** | Taux de complétion global : 40% (2/5) |
| **Tier** | Tier 3 (Analytique) |
| **Formule de calcul** | (COUNT(membres WHERE statut = 'ACTIF') / COUNT(membres WHERE statut = 'INSCRIT')) × 100 |
| **Source de données** | Table `members`, colonne `status` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Insight → Action** | Cliquer sur le label → Ouvre le funnel détaillé |
| **Preview** | Affiche le nombre de membres par étape du funnel |
| **Accessibilité** | aria-label="Taux de complétion du funnel global : 40%" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-lime text-sm font-bold`
- Pourcentage : `text-muted-foreground text-xs` (ex: "40%")

---

#### KPI-09 : Membres actifs

| Élément | Contenu |
|---------|---------|
| **Nom** | Membres actifs |
| **Label** | Membres actifs : 3 |
| **Tier** | Tier 3 (Analytique) |
| **Formule de calcul** | COUNT(membres WHERE statut = 'ACTIF') |
| **Source de données** | Table `members`, colonne `status` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Insight → Action** | Cliquer sur le label → Filtre la liste des membres par statut ACTIF |
| **Preview** | Affiche le nombre de membres actifs (ex: "3 membres actifs") |
| **Accessibilité** | aria-label="Filtrer les membres par statut ACTIF (3 résultats)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-foreground text-sm font-semibold`
- Pourcentage : `text-muted-foreground text-xs` (ex: "3")

---

#### KPI-10 : Taux de conversion mensuel

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de conversion mensuel |
| **Label** | Taux de conversion mensuel : 45% (2/4) |
| **Tier** | Tier 3 (Analytique) |
| **Formule de calcul** | (COUNT(membres WHERE statut = 'VALIDÉ' AND date_inscription_mois = mois_courant) / COUNT(membres WHERE statut IN ('INSCRIT', 'VALIDÉ') AND date_inscription_mois = mois_courant)) × 100 |
| **Source de données** | Table `members`, colonne `status` + colonne `date_inscription` |
| **Fréquence de mise à jour** | Quotidien (calcul du mois en cours) |
| **Insight → Action** | Cliquer sur le label → Affiche les breakdowns mensuels |
| **Preview** | Affiche le nombre de validations ce mois |
| **Accessibilité** | aria-label="Taux de conversion mensuel : 45%" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-lime text-sm font-bold`
- Pourcentage : `text-muted-foreground text-xs` (ex: "45%")

---

### 2.4 KPIs Tier 4 — Décoratif

**À supprimer** — Ces KPIs n'ont pas d'action possible et ne fournissent pas d'insight utile :

- Statistiques décoratives sans lien vers des actions
- Graphiques qui ne sont pas interactifs
- Métriques qui ne sont pas liées à des décisions

---

## 3. Dimensions

### 3.1 Dimension : Domaine

| Élément | Contenu | Filtre | Action |
|---------|---------|--------|--------|
| **Label** | Domaine | Domaine | Cliquer → Filtre les membres par domaine |
| **Options** | Cyber, Web, AI, etc. | Domaine | Clic → Affiche les membres du domaine |
| **Preview** | "Cyber : 2 (66%)" | Domaine | Affiche le nombre de membres par domaine |
| **Accessibilité** | aria-label="Filtrer par domaine" |

**Formule de calcul :**
```
COUNT(membres WHERE domaine = X)
```

**Source de données :** Table `members`, colonne `domain`

---

### 3.2 Dimension : Pays

| Élément | Contenu | Filtre | Action |
|---------|---------|--------|--------|
| **Label** | Pays | Pays | Cliquer → Filtre les membres par pays |
| **Options** | FR, CN, CM, etc. | Pays | Clic → Affiche les membres du pays |
| **Preview** | "FR : 2 (66%)" | Pays | Affiche le nombre de membres par pays |
| **Accessibilité** | aria-label="Filtrer par pays" |

**Formule de calcul :**
```
COUNT(membres WHERE pays = X)
```

**Source de données :** Table `members`, colonne `country`

---

### 3.3 Dimension : Statut

| Élément | Contenu | Filtre | Action |
|---------|---------|--------|--------|
| **Label** | Statut | Statut | Cliquer → Filtre les membres par statut |
| **Options** | VALIDÉ, PENDING, INSCRIT, WAITLIST, ACTIF | Statut | Clic → Affiche les membres du statut |
| **Preview** | "VALIDÉ : 2 (40%)" | Statut | Affiche le nombre de membres par statut |
| **Accessibilité** | aria-label="Filtrer par statut" |

**Formule de calcul :**
```
COUNT(membres WHERE statut = X)
```

**Source de données :** Table `members`, colonne `status`

---

### 3.4 Dimension : Niveau

| Élément | Contenu | Filtre | Action |
|---------|---------|--------|--------|
| **Label** | Niveau | Niveau | Cliquer → Filtre les membres par niveau |
| **Options** | L1, L2, L3, etc. | Niveau | Clic → Affiche les membres du niveau |
| **Preview** | "L1 : 3 (60%)" | Niveau | Affiche le nombre de membres par niveau |
| **Accessibilité** | aria-label="Filtrer par niveau" |

**Formule de calcul :**
```
COUNT(membres WHERE niveau = X)
```

**Source de données :** Table `members`, colonne `level`

---

### 3.5 Dimension : Date d'inscription

| Élément | Contenu | Filtre | Action |
|---------|---------|--------|--------|
| **Label** | Date d'inscription | Date_inscription | Cliquer → Filtre les membres par date |
| **Options** | Cette semaine, Ce mois-ci, Cette année, etc. | Date_inscription | Clic → Affiche les membres de la période |
| **Preview** | "Ce mois : 2 membres" | Date_inscription | Affiche le nombre de membres par période |
| **Accessibilité** | aria-label="Filtrer par date d'inscription" |

**Formule de calcul :**
```
COUNT(membres WHERE date_inscription_mois = X)
```

**Source de données :** Table `members`, colonne `date_inscription`

---

### 3.6 Dimension : Mentorat

| Élément | Contenu | Filtre | Action |
|---------|---------|--------|--------|
| **Label** | Intérêt pour le mentorat | Mentorat | Cliquer → Filtre les membres par intérêt |
| **Options** | Oui, Peut-être, Non | Mentorat | Clic → Affiche les membres avec intérêt |
| **Preview** | "Oui : 1 membre" | Mentorat | Affiche le nombre de membres avec intérêt |
| **Accessibilité** | aria-label="Filtrer par intérêt pour le mentorat" |

**Formule de calcul :**
```
COUNT(membres WHERE mentorat = X)
```

**Source de données :** Table `members`, colonne `mentorship_interest`

---

### 3.7 Dimension : Objectif

| Élément | Contenu | Filtre | Action |
|---------|---------|--------|--------|
| **Label** | Objectif principal | Objectif | Cliquer → Filtre les membres par objectif |
| **Options** | Chaque option définie dans la table | Objectif | Clic → Affiche les membres de l'objectif |
| **Preview** | "Recherche de stage : 2 membres" | Objectif | Affiche le nombre de membres par objectif |
| **Accessibilité** | aria-label="Filtrer par objectif principal" |

**Formule de calcul :**
```
COUNT(membres WHERE objectif = X)
```

**Source de données :** Table `members`, colonne `objective`

---

### 3.8 Dimension : Budget

| Élément | Contenu | Filtre | Action |
|---------|---------|--------|--------|
| **Label** | Budget | Budget | Cliquer → Filtre les membres par budget |
| **Options** | < 500k, 500k-1M, 1M-5M, > 5M FCFA | Budget | Clic → Affiche les membres du budget |
| **Preview** | "500k-1M : 1 membre" | Budget | Affiche le nombre de membres par budget |
| **Accessibilité** | aria-label="Filtrer par budget" |

**Formule de calcul :**
```
COUNT(membres WHERE budget = X)
```

**Source de données :** Table `members`, colonne `budget`

---

## 4. Qualité des données

### 4.1 Indicateurs de complétude

#### Indicateur 01 : Complétude globale des profils

| Élément | Contenu |
|---------|---------|
| **Nom** | Complétude globale des profils |
| **Formule de calcul** | (SUM(nombre de champs remplis) / SUM(nombre total de champs)) × 100 |
| **Source de données** | Table `members`, agrégation des champs (nom, email, pays, domaine, niveau, etc.) |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Complétude globale des profils : 72%" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-lime text-sm font-bold`
- Pourcentage : `text-muted-foreground text-xs` (ex: "72%")

---

#### Indicateur 02 : Complétude par champ

| Champ | Complétude | Formule de calcul |
|-------|------------|-------------------|
| **Nom** | 100% | COUNT(membres WHERE nom != '') / COUNT(membres) × 100 |
| **Email** | 100% | COUNT(membres WHERE email != '') / COUNT(membres) × 100 |
| **Pays** | 100% | COUNT(membres WHERE pays != '') / COUNT(membres) × 100 |
| **Domaine** | 100% | COUNT(membres WHERE domaine != '') / COUNT(membres) × 100 |
| **Niveau** | 100% | COUNT(membres WHERE niveau != '') / COUNT(membres) × 100 |
| **Objectif** | 80% | COUNT(membres WHERE objectif != '') / COUNT(membres) × 100 |
| **Mentorat** | 60% | COUNT(membres WHERE mentorat != '') / COUNT(membres) × 100 |
| **Budget** | 40% | COUNT(membres WHERE budget != '') / COUNT(membres) × 100 |

**Source de données :** Table `members`, agrégation par champ

---

### 4.2 Champs manquants fréquents

#### Champ 01 : Budget

| Élément | Contenu |
|---------|---------|
| **Nom** | Budget manquant |
| **Formule de calcul** | COUNT(membres WHERE budget = '' OR budget IS NULL) |
| **Source de données** | Table `members`, colonne `budget` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Budget manquant : 2 membres" |
| **Action requise** | Voir les membres avec budget manquant |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-yellow text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "2 membres")

---

#### Champ 02 : Objectif

| Élément | Contenu |
|---------|---------|
| **Nom** | Objectif manquant |
| **Formule de calcul** | COUNT(membres WHERE objectif = '' OR objectif IS NULL) |
| **Source de données** | Table `members`, colonne `objective` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Objectif manquant : 1 membre" |
| **Action requise** | Voir les membres avec objectif manquant |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-yellow text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "1 membre")

---

#### Champ 03 : Mentorat

| Élément | Contenu |
|---------|---------|
| **Nom** | Intérêt pour le mentorat manquant |
| **Formule de calcul** | COUNT(membres WHERE mentorat = '' OR mentorat IS NULL) |
| **Source de données** | Table `members`, colonne `mentorship_interest` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Intérêt pour le mentorat manquant : 2 membres" |
| **Action requise** | Voir les membres avec intérêt pour le mentorat manquant |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-yellow text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "2 membres")

---

### 4.3 Profils incomplets détectables

#### Profil 01 : Profil partiel

| Élément | Contenu |
|---------|---------|
| **Nom** | Profil partiel |
| **Critère** | Moins de 50% de champs remplis |
| **Formule de calcul** | SUM(CASE WHEN complétude < 50% THEN 1 ELSE 0 END) |
| **Source de données** | Table `members`, agrégation des champs |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Profils partiel : 1 membre" |
| **Action requise** | Voir les profils partiellement remplis |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-yellow text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "1 membre")

---

#### Profil 02 : Profil très partiel

| Élément | Contenu |
|---------|---------|
| **Nom** | Profil très partiel |
| **Critère** | Moins de 25% de champs remplis |
| **Formule de calcul** | SUM(CASE WHEN complétude < 25% THEN 1 ELSE 0 END) |
| **Source de données** | Table `members`, agrégation des champs |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Profils très partiel : 0 membre" |
| **Action requise** | Voir les profils très partiellement remplis |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-red text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "0 membre")

---

## 5. Calculs

### 5.1 Formules de calcul des KPIs

#### KPI-01 : Inscrits

```
COUNT(membres WHERE statut = 'INSCRIT')
```

**Détails :**
- Source : Table `members`, colonne `status`
- Type : Compteur
- Direction : Croissant (plus d'inscrits = plus de membres)

---

#### KPI-02 : Validés

```
COUNT(membres WHERE statut = 'VALIDÉ')
```

**Détails :**
- Source : Table `members`, colonne `status`
- Type : Compteur
- Direction : Croissant (plus de validations = plus de membres actifs)

---

#### KPI-03 : En attente

```
COUNT(membres WHERE statut = 'EN ATTENTE')
```

**Détails :**
- Source : Table `members`, colonne `status`
- Type : Compteur
- Direction : Décroissant (moins d'attente = meilleure expérience)

---

#### KPI-04 : Waitlist

```
COUNT(membres WHERE statut = 'WAITLIST')
```

**Détails :**
- Source : Table `members`, colonne `status`
- Type : Compteur
- Direction : Décroissant (moins de waitlist = meilleure expérience)

---

#### KPI-05 : Taux de conversion (Inscription → Validation)

```
(COUNT(membres WHERE statut = 'VALIDÉ') / COUNT(membres WHERE statut IN ('INSCRIT', 'VALIDÉ'))) × 100
```

**Détails :**
- Source : Table `members`, colonne `status`
- Type : Pourcentage
- Direction : Croissant (plus de conversion = meilleure expérience)

---

#### KPI-06 : Taux de complétion du profil moyen

```
(SUM(nombre de champs remplis) / SUM(nombre total de champs)) × 100
```

**Détails :**
- Source : Table `members`, agrégation des champs (nom, email, pays, domaine, niveau, etc.)
- Type : Pourcentage
- Direction : Croissant (plus de complétude = meilleure expérience)

---

#### KPI-07 : Taux de complétion du funnel global

```
(COUNT(membres WHERE statut = 'ACTIF') / COUNT(membres WHERE statut = 'INSCRIT')) × 100
```

**Détails :**
- Source : Table `members`, colonne `status`
- Type : Pourcentage
- Direction : Croissant (plus de complétion = meilleure expérience)

---

#### KPI-08 : Membres actifs

```
COUNT(membres WHERE statut = 'ACTIF')
```

**Détails :**
- Source : Table `members`, colonne `status`
- Type : Compteur
- Direction : Croissant (plus de membres actifs = meilleure activité)

---

#### KPI-09 : Taux de conversion mensuel

```
(COUNT(membres WHERE statut = 'VALIDÉ' AND date_inscription_mois = mois_courant) / COUNT(membres WHERE statut IN ('INSCRIT', 'VALIDÉ') AND date_inscription_mois = mois_courant)) × 100
```

**Détails :**
- Source : Table `members`, colonne `status` + colonne `date_inscription`
- Type : Pourcentage
- Direction : Croissant (plus de conversion = meilleure expérience)

---

### 5.2 Formules de calcul des dimensions

#### Dimension : Domaine

```
COUNT(membres WHERE domaine = X)
```

**Détails :**
- Source : Table `members`, colonne `domain`
- Type : Compteur
- Direction : Croissant (plus de membres dans le domaine = plus d'activité)

---

#### Dimension : Pays

```
COUNT(membres WHERE pays = X)
```

**Détails :**
- Source : Table `members`, colonne `country`
- Type : Compteur
- Direction : Croissant (plus de membres dans le pays = plus d'activité)

---

#### Dimension : Statut

```
COUNT(membres WHERE statut = X)
```

**Détails :**
- Source : Table `members`, colonne `status`
- Type : Compteur
- Direction : Croissant (plus de membres validés = meilleure expérience)

---

#### Dimension : Niveau

```
COUNT(membres WHERE niveau = X)
```

**Détails :**
- Source : Table `members`, colonne `level`
- Type : Compteur
- Direction : Croissant (plus de membres L1 = meilleure activité)

---

#### Dimension : Date d'inscription

```
COUNT(membres WHERE date_inscription_mois = X)
```

**Détails :**
- Source : Table `members`, colonne `date_inscription`
- Type : Compteur
- Direction : Croissant (plus de membres inscrits ce mois = meilleure activité)

---

#### Dimension : Mentorat

```
COUNT(membres WHERE mentorat = X)
```

**Détails :**
- Source : Table `members`, colonne `mentorship_interest`
- Type : Compteur
- Direction : Croissant (plus de membres intéressés = meilleure activité)

---

#### Dimension : Objectif

```
COUNT(membres WHERE objectif = X)
```

**Détails :**
- Source : Table `members`, colonne `objective`
- Type : Compteur
- Direction : Croissant (plus de membres avec objectif = meilleure organisation)

---

#### Dimension : Budget

```
COUNT(membres WHERE budget = X)
```

**Détails :**
- Source : Table `members`, colonne `budget`
- Type : Compteur
- Direction : Croissant (plus de membres avec budget = meilleure organisation)

---

### 5.3 Formules de calcul des indicateurs de qualité

#### Complétude globale des profils

```
(SUM(nombre de champs remplis) / SUM(nombre total de champs)) × 100
```

**Détails :**
- Source : Table `members`, agrégation des champs
- Type : Pourcentage
- Direction : Croissant (plus de complétude = meilleure expérience)

---

#### Complétude par champ

```
COUNT(membres WHERE champ != '') / COUNT(membres) × 100
```

**Détails :**
- Source : Table `members`, agrégation par champ
- Type : Pourcentage
- Direction : Croissant (plus de complétude = meilleure expérience)

---

#### Budget manquant

```
COUNT(membres WHERE budget = '' OR budget IS NULL)
```

**Détails :**
- Source : Table `members`, colonne `budget`
- Type : Compteur
- Direction : Décroissant (moins de budget manquant = meilleure expérience)

---

#### Objectif manquant

```
COUNT(membres WHERE objectif = '' OR objectif IS NULL)
```

**Détails :**
- Source : Table `members`, colonne `objective`
- Type : Compteur
- Direction : Décroissant (moins d'objectif manquant = meilleure expérience)

---

#### Intérêt pour le mentorat manquant

```
COUNT(membres WHERE mentorat = '' OR mentorat IS NULL)
```

**Détails :**
- Source : Table `members`, colonne `mentorship_interest`
- Type : Compteur
- Direction : Décroissant (moins d'intérêt pour le mentorat manquant = meilleure expérience)

---

#### Profil partiel

```
SUM(CASE WHEN complétude < 50% THEN 1 ELSE 0 END)
```

**Détails :**
- Source : Table `members`, agrégation des champs
- Type : Compteur
- Direction : Décroissant (moins de profils partiels = meilleure expérience)

---

#### Profil très partiel

```
SUM(CASE WHEN complétude < 25% THEN 1 ELSE 0 END)
```

**Détails :**
- Source : Table `members`, agrégation des champs
- Type : Compteur
- Direction : Décroissant (moins de profils très partiels = meilleure expérience)

---

## 6. Insight → Action

### 6.1 Insight → Action pour les KPIs Tier 1

| Insight | Action | Résultat |
|---------|--------|----------|
| "Inscrits (3)" | Cliquer sur la carte | Affiche les 3 membres inscrits filtrés |
| "Validés (2)" | Cliquer sur la carte | Affiche les 2 membres validés filtrés |
| "En attente (1)" | Cliquer sur la carte | Affiche le membre en attente |
| "Waitlist (1)" | Cliquer sur la carte | Affiche le membre sur waitlist |

---

### 6.2 Insight → Action pour les KPIs Tier 2

| Insight | Action | Résultat |
|---------|--------|----------|
| "3 membres validés, 1 en attente, 1 sur waitlist" | Naviguer vers la section Membres | Affiche la liste complète des membres |
| "Taux de conversion : 60% (2/3)" | Cliquer sur le label | Affiche le breakdown par statut |
| "Taux de complétion : 72%" | Cliquer sur le label | Affiche les profils incomplets |

---

### 6.3 Insight → Action pour les KPIs Tier 3

| Insight | Action | Résultat |
|---------|--------|----------|
| "Taux de complétion global : 40%" | Cliquer sur le label | Ouvre le funnel détaillé |
| "Membres actifs : 3" | Cliquer sur le label | Filtre la liste des membres par statut ACTIF |
| "Taux de conversion mensuel : 45%" | Cliquer sur le label | Affiche les breakdowns mensuels |

---

### 6.4 Insight → Action pour les dimensions

| Insight | Action | Résultat |
|---------|--------|----------|
| "Cyber : 2 (66%)" | Cliquer sur la carte | Filtre la liste des membres par domaine Cyber |
| "FR : 2 (66%)" | Cliquer sur la carte | Filtre la liste des membres par pays FR |
| "VALIDÉ : 2 (40%)" | Cliquer sur la carte | Filtre la liste des membres par statut VALIDÉ |
| "L1 : 3 (60%)" | Cliquer sur la carte | Filtre la liste des membres par niveau L1 |

---

### 6.5 Insight → Action pour les indicateurs de qualité

| Insight | Action | Résultat |
|---------|--------|----------|
| "Budget manquant : 2 membres" | Cliquer sur le label | Affiche les membres avec budget manquant |
| "Objectif manquant : 1 membre" | Cliquer sur le label | Affiche les membres avec objectif manquant |
| "Intérêt pour le mentorat manquant : 2 membres" | Cliquer sur le label | Affiche les membres avec intérêt pour le mentorat manquant |
| "Profil partiel : 1 membre" | Cliquer sur le label | Affiche les profils partiellement remplis |

---

## 7. Actions requises

### 7.1 Actions requises par état

#### Action 01 : Profils incomplets

| Élément | Contenu |
|---------|---------|
| **Titre** | Profils incomplets |
| **Raison** | Les profils ont moins de 50% de champs remplis |
| **Compteur** | 1 membre |
| **Priorité** | Moyenne |
| **CTA** | Voir les profils incomplets |
| **Destination** | Section Membres avec filtre "Profil partiel" |
| **Accessibilité** | aria-label="Voir les profils incomplets (1 membre)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Titre : `text-yellow text-sm font-semibold`
- Compteur : `text-yellow text-lg font-bold`
- CTA : Bouton secondaire avec icône

---

#### Action 02 : Membres en attente

| Élément | Contenu |
|---------|---------|
| **Titre** | Membres en attente |
| **Raison** | Les membres sont en attente de validation |
| **Compteur** | 1 membre |
| **Priorité** | Haute |
| **CTA** | Valider maintenant |
| **Destination** | Section Membres avec filtre "En attente" |
| **Accessibilité** | aria-label="Valider les membres en attente (1 membre)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Titre : `text-yellow text-sm font-semibold`
- Compteur : `text-yellow text-lg font-bold`
- CTA : Bouton primaire avec icône

---

#### Action 03 : Membres sur waitlist

| Élément | Contenu |
|---------|---------|
| **Titre** | Membres sur waitlist |
| **Raison** | Les membres sont sur la liste d'attente |
| **Compteur** | 1 membre |
| **Priorité** | Moyenne |
| **CTA** | Voir la waitlist |
| **Destination** | Section Membres avec filtre "Waitlist" |
| **Accessibilité** | aria-label="Voir les membres sur waitlist (1 membre)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Titre : `text-blue text-sm font-semibold`
- Compteur : `text-blue text-lg font-bold`
- CTA : Bouton secondaire avec icône

---

#### Action 04 : Emails jetables

| Élément | Contenu |
|---------|---------|
| **Titre** | Emails jetables détectés |
| **Raison** | Les emails semblent être des emails jetables (temporaire) |
| **Compteur** | 0 membre |
| **Priorité** | Faible |
| **CTA** | Voir les emails jetables |
| **Destination** | Section Membres avec filtre "Email jetable" |
| **Accessibilité** | aria-label="Voir les emails jetables (0 membre)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Titre : `text-red text-sm font-semibold`
- Compteur : `text-red text-lg font-bold`
- CTA : Bouton secondaire avec icône

---

#### Action 05 : Membres avec budget manquant

| Élément | Contenu |
|---------|---------|
| **Titre** | Budget manquant |
| **Raison** | Les profils n'ont pas de budget renseigné |
| **Compteur** | 2 membres |
| **Priorité** | Moyenne |
| **CTA** | Voir les membres sans budget |
| **Destination** | Section Membres avec filtre "Budget manquant" |
| **Accessibilité** | aria-label="Voir les membres sans budget (2 membres)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Titre : `text-yellow text-sm font-semibold`
- Compteur : `text-yellow text-lg font-bold`
- CTA : Bouton secondaire avec icône

---

#### Action 06 : Membres avec objectif manquant

| Élément | Contenu |
|---------|---------|
| **Titre** | Objectif manquant |
| **Raison** | Les profils n'ont pas d'objectif renseigné |
| **Compteur** | 1 membre |
| **Priorité** | Faible |
| **CTA** | Voir les membres sans objectif |
| **Destination** | Section Membres avec filtre "Objectif manquant" |
| **Accessibilité** | aria-label="Voir les membres sans objectif (1 membre)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Titre : `text-yellow text-sm font-semibold`
- Compteur : `text-yellow text-lg font-bold`
- CTA : Bouton secondaire avec icône

---

#### Action 07 : Membres avec intérêt pour le mentorat manquant

| Élément | Contenu |
|---------|---------|
| **Titre** | Intérêt pour le mentorat manquant |
| **Raison** | Les profils n'ont pas d'intérêt pour le mentorat renseigné |
| **Compteur** | 2 membres |
| **Priorité** | Faible |
| **CTA** | Voir les membres sans intérêt pour le mentorat |
| **Destination** | Section Membres avec filtre "Mentorat manquant" |
| **Accessibilité** | aria-label="Voir les membres sans intérêt pour le mentorat (2 membres)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Titre : `text-yellow text-sm font-semibold`
- Compteur : `text-yellow text-lg font-bold`
- CTA : Bouton secondaire avec icône

---

#### Action 08 : Profils très partiel

| Élément | Contenu |
|---------|---------|
| **Titre** | Profils très partiel |
| **Raison** | Les profils ont moins de 25% de champs remplis |
| **Compteur** | 0 membre |
| **Priorité** | Haute |
| **CTA** | Voir les profils très partiellement remplis |
| **Destination** | Section Membres avec filtre "Profil très partiel" |
| **Accessibilité** | aria-label="Voir les profils très partiellement remplis (0 membre)" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Titre : `text-red text-sm font-semibold`
- Compteur : `text-red text-lg font-bold`
- CTA : Bouton destructif avec icône

---

## 8. Data Health

### 8.1 Indicateurs de qualité des données

#### Indicateur 01 : Intégrité des données

| Élément | Contenu |
|---------|---------|
| **Nom** | Intégrité des données |
| **Formule de calcul** | (1 - (nombre d'erreurs / nombre total de membres)) × 100 |
| **Source de données** | Table `members`, vérification des contraintes |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Intégrité des données : 100%" |

**Détails :**
- Nombre d'erreurs : Membres sans nom, sans email, email invalide, etc.
- Source : Table `members`, vérification des contraintes
- Type : Pourcentage
- Direction : Croissant (plus d'intégrité = meilleure expérience)

---

#### Indicateur 02 : Cohérence des données

| Élément | Contenu |
|---------|---------|
| **Nom** | Cohérence des données |
| **Formule de calcul** | (nombre de membres cohérents / nombre total de membres) × 100 |
| **Source de données** | Table `members`, vérification des contraintes |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Cohérence des données : 100%" |

**Détails :**
- Membres cohérents : Membres avec nom, email, pays, domaine, statut valides
- Source : Table `members`, vérification des contraintes
- Type : Pourcentage
- Direction : Croissant (plus de cohérence = meilleure expérience)

---

#### Indicateur 03 : Consistance des données

| Élément | Contenu |
|---------|---------|
| **Nom** | Consistance des données |
| **Formule de calcul** | (nombre de membres cohérents / nombre total de membres) × 100 |
| **Source de données** | Table `members`, vérification des contraintes |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Consistance des données : 100%" |

**Détails :**
- Membres cohérents : Membres avec statut valide, niveau valide, domaine valide
- Source : Table `members`, vérification des contraintes
- Type : Pourcentage
- Direction : Croissant (plus de consistance = meilleure expérience)

---

#### Indicateur 04 : Fiabilité des données

| Élément | Contenu |
|---------|---------|
| **Nom** | Fiabilité des données |
| **Formule de calcul** | (nombre de membres vérifiés / nombre total de membres) × 100 |
| **Source de données** | Table `members`, vérification des données |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Fiabilité des données : 100%" |

**Détails :**
- Membres vérifiés : Membres avec email vérifié, téléphone vérifié, etc.
- Source : Table `members`, vérification des données
- Type : Pourcentage
- Direction : Croissant (plus de fiabilité = meilleure expérience)

---

### 8.2 Champs manquants fréquents

#### Champ 01 : Budget

| Élément | Contenu |
|---------|---------|
| **Nom** | Budget manquant |
| **Formule de calcul** | COUNT(membres WHERE budget = '' OR budget IS NULL) |
| **Source de données** | Table `members`, colonne `budget` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Budget manquant : 2 membres" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-yellow text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "2 membres")

---

#### Champ 02 : Objectif

| Élément | Contenu |
|---------|---------|
| **Nom** | Objectif manquant |
| **Formule de calcul** | COUNT(membres WHERE objectif = '' OR objectif IS NULL) |
| **Source de données** | Table `members`, colonne `objective` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Objectif manquant : 1 membre" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-yellow text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "1 membre")

---

#### Champ 03 : Mentorat

| Élément | Contenu |
|---------|---------|
| **Nom** | Intérêt pour le mentorat manquant |
| **Formule de calcul** | COUNT(membres WHERE mentorat = '' OR mentorat IS NULL) |
| **Source de données** | Table `members`, colonne `mentorship_interest` |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Intérêt pour le mentorat manquant : 2 membres" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-yellow text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "2 membres")

---

### 8.3 Profils incomplets détectables

#### Profil 01 : Profil partiel

| Élément | Contenu |
|---------|---------|
| **Nom** | Profil partiel |
| **Critère** | Moins de 50% de champs remplis |
| **Formule de calcul** | SUM(CASE WHEN complétude < 50% THEN 1 ELSE 0 END) |
| **Source de données** | Table `members`, agrégation des champs |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Profil partiel : 1 membre" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-yellow text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "1 membre")

---

#### Profil 02 : Profil très partiel

| Élément | Contenu |
|---------|---------|
| **Nom** | Profil très partiel |
| **Critère** | Moins de 25% de champs remplis |
| **Formule de calcul** | SUM(CASE WHEN complétude < 25% THEN 1 ELSE 0 END) |
| **Source de données** | Table `members`, agrégation des champs |
| **Fréquence de mise à jour** | En temps réel (sur mutation) |
| **Accessibilité** | aria-label="Profil très partiel : 0 membre" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Valeur : `text-red text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "0 membre")

---

## 9. Funnel Honesty

### 9.1 Analyse des étapes séquentielles

L'interface admin ne présente pas un funnel strictement séquentiel (un membre passe d'une étape à l'autre de manière linéaire). Au lieu d'un funnel, nous devons utiliser un **parcours d'activation** ou un **engagement path**.

### 9.2 Parcours d'activation — Membre

Le parcours d'activation d'un membre dans l'interface admin suit ces étapes :

#### Étape 01 : Inscription

| Élément | Contenu |
|---------|---------|
| **Label** | Inscrit |
| **Compteur** | 3 membres |
| **Formule de calcul** | COUNT(membres WHERE statut = 'INSCRIT') |
| **Source de données** | Table `members`, colonne `status` |
| **Accessibilité** | aria-label="Inscrit : 3 membres" |
| **Action** | Cliquer → Filtre les membres par statut INSCRIT |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "3 membres")

---

#### Étape 02 : Validation

| Élément | Contenu |
|---------|---------|
| **Label** | En attente |
| **Compteur** | 1 membre |
| **Formule de calcul** | COUNT(membres WHERE statut = 'EN ATTENTE') |
| **Source de données** | Table `members`, colonne `status` |
| **Accessibilité** | aria-label="En attente : 1 membre" |
| **Action** | Cliquer → Filtre les membres par statut EN ATTENTE |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-yellow text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "1 membre")

---

#### Étape 03 : Validation réussie

| Élément | Contenu |
|---------|---------|
| **Label** | Validés |
| **Compteur** | 2 membres |
| **Formule de calcul** | COUNT(membres WHERE statut = 'VALIDÉ') |
| **Source de données** | Table `members`, colonne `status` |
| **Accessibilité** | aria-label="Validés : 2 membres" |
| **Action** | Cliquer → Filtre les membres par statut VALIDÉ |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "2 membres")

---

#### Étape 04 : Activation

| Élément | Contenu |
|---------|---------|
| **Label** | Membres actifs |
| **Compteur** | 3 membres |
| **Formule de calcul** | COUNT(membres WHERE statut = 'ACTIF') |
| **Source de données** | Table `members`, colonne `status` |
| **Accessibilité** | aria-label="Membres actifs : 3 membres" |
| **Action** | Cliquer → Filtre les membres par statut ACTIF |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "3 membres")

---

### 9.3 Parcours d'activation — Workflow de validation

Le workflow de validation des membres dans l'interface admin suit ces étapes :

#### Étape 01 : Sélection du membre

| Élément | Contenu |
|---------|---------|
| **Label** | Sélectionner un membre |
| **Compteur** | Sélectionné : 1 membre |
| **Source de données** | Table `members`, sélection |
| **Accessibilité** | aria-label="Sélectionner un membre" |
| **Action** | Cliquer sur la ligne du membre dans le tableau |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "Sélectionné : 1 membre")

---

#### Étape 02 : Vérification des informations

| Élément | Contenu |
|---------|---------|
| **Label** | Vérifier les informations |
| **Compteur** | Informations vérifiées : 100% |
| **Source de données** | Table `members`, vérification des champs |
| **Accessibilité** | aria-label="Vérifier les informations" |
| **Action** | Cliquer sur le membre pour ouvrir la fenêtre de détails |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "Informations vérifiées : 100%")

---

#### Étape 03 : Définition du statut

| Élément | Contenu |
|---------|---------|
| **Label** | Définir le statut |
| **Compteur** | Statut défini : APPROVED |
| **Source de données** | Table `members`, colonne `status` |
| **Accessibilité** | aria-label="Définir le statut" |
| **Action** | Cliquer sur le bouton "Valider" dans la fenêtre de détails |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "Statut défini : APPROVED")

---

#### Étape 04 : Confirmation

| Élément | Contenu |
|---------|---------|
| **Label** | Confirmer la validation |
| **Compteur** | Validation confirmée : 1 membre |
| **Source de données** | Table `members`, mutation |
| **Accessibilité** | aria-label="Confirmer la validation" |
| **Action** | Cliquer sur le bouton "Confirmer" dans la confirmation |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "Validation confirmée : 1 membre")

---

### 9.4 Engagement Path — Membre actif

Le parcours d'engagement des membres actifs dans l'interface admin suit ces étapes :

#### Étape 01 : Consultation du tableau

| Élément | Contenu |
|---------|---------|
| **Label** | Consultation du tableau |
| **Compteur** | Tableau consulté : 3 membres |
| **Source de données** | Table `members`, consultation |
| **Accessibilité** | aria-label="Consultation du tableau" |
| **Action** | Cliquer sur la ligne du membre dans le tableau |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "Tableau consulté : 3 membres")

---

#### Étape 02 : Consultation des détails

| Élément | Contenu |
|---------|---------|
| **Label** | Consultation des détails |
| **Compteur** | Détails consultés : 3 membres |
| **Source de données** | Table `members`, consultation des détails |
| **Accessibilité** | aria-label="Consultation des détails" |
| **Action** | Cliquer sur le bouton "Voir détails" dans la ligne |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "Détails consultés : 3 membres")

---

#### Étape 03 : Filtrage par dimension

| Élément | Contenu |
|---------|---------|
| **Label** | Filtrage par dimension |
| **Compteur** | Filtres appliqués : 1 filtre |
| **Source de données** | Table `members`, filtrage |
| **Accessibilité** | aria-label="Filtrage par dimension" |
| **Action** | Cliquer sur un filtre (domaine, pays, statut, etc.) |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "Filtres appliqués : 1 filtre")

---

#### Étape 04 : Export des données

| Élément | Contenu |
|---------|---------|
| **Label** | Export des données |
| **Compteur** | Données exportées : 1 membre |
| **Source de données** | Table `members`, export |
| **Accessibilité** | aria-label="Export des données" |
| **Action** | Cliquer sur le bouton "Exporter CSV" |

**Style :**
- Label : `text-muted-foreground text-xs`
- Compteur : `text-lime text-sm font-bold`
- Nombre : `text-muted-foreground text-xs` (ex: "Données exportées : 1 membre")

---

### 9.5 Funnel vs Parcours d'activation

| Critère | Funnel | Parcours d'activation |
|---------|--------|----------------------|
| **Séquentialité** | Étapes linéaires et obligatoires | Étapes non linéaires, options multiples |
| **Comportement** | Un membre passe d'une étape à l'autre | Un membre peut passer d'une étape à une autre à tout moment |
| **Objectif** | Mesurer la conversion entre étapes | Mesurer l'engagement et les actions possibles |
| **Application** | Conversion de vente | Activation, onboarding, engagement |
| **Utilisation** | Non applicable | **À utiliser** pour l'interface admin HASHCODE |

**Conclusion :** L'interface admin HASHCODE ne présente pas un funnel séquentiel. Nous devons utiliser un **parcours d'activation** ou un **engagement path** pour mesurer les étapes réelles des membres.

---

## 10. Données manquantes

### 10.1 Données manquantes dans l'interface actuelle

#### Donnée 01 : Analytics détaillés

| Élément | Contenu |
|---------|---------|
| **Nom** | Analytics détaillés |
| **Description** | L'interface admin n'affiche pas d'analytics détaillés (graphiques, données historiques, comparaisons) |
| **Impact** | Les administrateurs ne peuvent pas analyser les tendances et les performances |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonnes `date_inscription`, `date_validation`, etc. |
| **Action requise** | Ajouter une section Analytics avec graphiques et données historiques |

---

#### Donnée 02 : Comparaisons historiques

| Élément | Contenu |
|---------|---------|
| **Nom** | Comparaisons historiques |
| **Description** | L'interface admin n'affiche pas de comparaisons historiques (mois précédent, année précédente) |
| **Impact** | Les administrateurs ne peuvent pas analyser les tendances et les performances |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonnes `date_inscription`, `date_validation`, etc. |
| **Action requise** | Ajouter des graphiques de comparaison historique |

---

#### Donnée 03 : Tendances temporelles

| Élément | Contenu |
|---------|---------|
| **Nom** | Tendances temporelles |
| **Description** | L'interface admin n'affiche pas de tendances temporelles (inscriptions par jour/semaine/mois) |
| **Impact** | Les administrateurs ne peuvent pas analyser les tendances et les performances |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `date_inscription` |
| **Action requise** | Ajouter des graphiques de tendances temporelles |

---

#### Donnée 04 : Statistiques par région

| Élément | Contenu |
|---------|---------|
| **Nom** | Statistiques par région |
| **Description** | L'interface admin n'affiche pas de statistiques par région (Afrique de l'Ouest, Afrique Centrale, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser les performances par région |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `pays` |
| **Action requise** | Ajouter des breakdowns par région géographique |

---

#### Donnée 05 : Statistiques par secteur

| Élément | Contenu |
|---------|---------|
| **Nom** | Statistiques par secteur |
| **Description** | L'interface admin n'affiche pas de statistiques par secteur (Tech, Éducation, Santé, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser les performances par secteur |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `objectif` |
| **Action requise** | Ajouter des breakdowns par secteur |

---

#### Donnée 06 : Statistiques par niveau de participation

| Élément | Contenu |
|---------|---------|
| **Nom** | Statistiques par niveau de participation |
| **Description** | L'interface admin n'affiche pas de statistiques par niveau de participation (actif, inactif, suspendu) |
| **Impact** | Les administrateurs ne peuvent pas analyser les performances par niveau de participation |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `level` |
| **Action requise** | Ajouter des breakdowns par niveau de participation |

---

#### Donnée 07 : Statistiques par statut de mentorat

| Élément | Contenu |
|---------|---------|
| **Nom** | Statistiques par statut de mentorat |
| **Description** | L'interface admin n'affiche pas de statistiques par statut de mentorat (mentor, mentoré, non intéressé) |
| **Impact** | Les administrateurs ne peuvent pas analyser les performances par statut de mentorat |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `mentorship_status` |
| **Action requise** | Ajouter des breakdowns par statut de mentorat |

---

#### Donnée 08 : Statistiques par niveau d'expérience

| Élément | Contenu |
|---------|---------|
| **Nom** | Statistiques par niveau d'expérience |
| **Description** | L'interface admin n'affiche pas de statistiques par niveau d'expérience (Junior, Senior, Expert) |
| **Impact** | Les administrateurs ne peuvent pas analyser les performances par niveau d'expérience |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `experience_level` |
| **Action requise** | Ajouter des breakdowns par niveau d'expérience |

---

#### Donnée 09 : Statistiques par niveau de budget

| Élément | Contenu |
|---------|---------|
| **Nom** | Statistiques par niveau de budget |
| **Description** | L'interface admin n'affiche pas de statistiques par niveau de budget (< 500k, 500k-1M, 1M-5M, > 5M FCFA) |
| **Impact** | Les administrateurs ne peuvent pas analyser les performances par niveau de budget |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `budget` |
| **Action requise** | Ajouter des breakdowns par niveau de budget |

---

#### Donnée 10 : Statistiques par date de validation

| Élément | Contenu |
|---------|---------|
| **Nom** | Statistiques par date de validation |
| **Description** | L'interface admin n'affiche pas de statistiques par date de validation (inscriptions validées ce mois, ce trimestre, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser les performances par date de validation |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `date_validation` |
| **Action requise** | Ajouter des breakdowns par date de validation |

---

### 10.2 Données manquantes dans les filtres

#### Filtre 01 : Date de validation

| Élément | Contenu |
|---------|---------|
| **Nom** | Date de validation |
| **Description** | Les filtres ne permettent pas de filtrer par date de validation (mois, trimestre, année) |
| **Impact** | Les administrateurs ne peuvent pas analyser les validations par période |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonne `date_validation` |
| **Action requise** | Ajouter un filtre par date de validation |

---

#### Filtre 02 : Date d'inscription

| Élément | Contenu |
|---------|---------|
| **Nom** | Date d'inscription |
| **Description** | Les filtres ne permettent pas de filtrer par date d'inscription (mois, trimestre, année) |
| **Impact** | Les administrateurs ne peuvent pas analyser les inscriptions par période |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonne `date_inscription` |
| **Action requise** | Ajouter un filtre par date d'inscription |

---

#### Filtre 03 : Date de dernière activité

| Élément | Contenu |
|---------|---------|
| **Nom** | Date de dernière activité |
| **Description** | Les filtres ne permettent pas de filtrer par date de dernière activité (7 jours, 30 jours, 90 jours) |
| **Impact** | Les administrateurs ne peuvent pas analyser les membres actifs par période |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `last_activity` |
| **Action requise** | Ajouter un filtre par date de dernière activité |

---

#### Filtre 04 : Niveau d'expérience

| Élément | Contenu |
|---------|---------|
| **Nom** | Niveau d'expérience |
| **Description** | Les filtres ne permettent pas de filtrer par niveau d'expérience (Junior, Senior, Expert) |
| **Impact** | Les administrateurs ne peuvent pas analyser les membres par niveau d'expérience |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `experience_level` |
| **Action requise** | Ajouter un filtre par niveau d'expérience |

---

#### Filtre 05 : Statut de mentorat

| Élément | Contenu |
|---------|---------|
| **Nom** | Statut de mentorat |
| **Description** | Les filtres ne permettent pas de filtrer par statut de mentorat (mentor, mentoré, non intéressé) |
| **Impact** | Les administrateurs ne peuvent pas analyser les membres par statut de mentorat |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `mentorship_status` |
| **Action requise** | Ajouter un filtre par statut de mentorat |

---

#### Filtre 06 : Secteur d'intérêt

| Élément | Contenu |
|---------|---------|
| **Nom** | Secteur d'intérêt |
| **Description** | Les filtres ne permettent pas de filtrer par secteur d'intérêt (Tech, Éducation, Santé, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser les membres par secteur d'intérêt |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `objective` |
| **Action requise** | Ajouter un filtre par secteur d'intérêt |

---

#### Filtre 07 : Rôle dans le projet

| Élément | Contenu |
|---------|---------|
| **Nom** | Rôle dans le projet |
| **Description** | Les filtres ne permettent pas de filtrer par rôle dans le projet (chef de projet, membre, collaborateur, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser les membres par rôle dans le projet |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `role` |
| **Action requise** | Ajouter un filtre par rôle dans le projet |

---

#### Filtre 08 : Niveau de responsabilité

| Élément | Contenu |
|---------|---------|
| **Nom** | Niveau de responsabilité |
| **Description** | Les filtres ne permettent pas de filtrer par niveau de responsabilité (Leader, Manager, Contributor) |
| **Impact** | Les administrateurs ne peuvent pas analyser les membres par niveau de responsabilité |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `responsibility_level` |
| **Action requise** | Ajouter un filtre par niveau de responsabilité |

---

#### Filtre 09 : Niveau de budget

| Élément | Contenu |
|---------|---------|
| **Nom** | Niveau de budget |
| **Description** | Les filtres ne permettent pas de filtrer par niveau de budget (< 500k, 500k-1M, 1M-5M, > 5M FCFA) |
| **Impact** | Les administrateurs ne peuvent pas analyser les membres par niveau de budget |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `budget` |
| **Action requise** | Ajouter un filtre par niveau de budget |

---

#### Filtre 10 : Statut de paiement

| Élément | Contenu |
|---------|---------|
| **Nom** | Statut de paiement |
| **Description** | Les filtres ne permettent pas de filtrer par statut de paiement (payé, en attente, échoué) |
| **Impact** | Les administrateurs ne peuvent pas analyser les membres par statut de paiement |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `payment_status` |
| **Action requise** | Ajouter un filtre par statut de paiement |

---

### 10.3 Données manquantes dans les exports

#### Export 01 : Export par période

| Élément | Contenu |
|---------|---------|
| **Nom** | Export par période |
| **Description** | L'export CSV ne permet pas de choisir la période d'export (mois, trimestre, année) |
| **Impact** | Les administrateurs ne peuvent pas exporter les données par période |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonnes `date_inscription`, `date_validation` |
| **Action requise** | Ajouter une option de sélection de période dans l'export CSV |

---

#### Export 02 : Export par statut

| Élément | Contenu |
|---------|---------|
| **Nom** | Export par statut |
| **Description** | L'export CSV ne permet pas de choisir le statut des membres à exporter (VALIDÉ, PENDING, INSCRIT, WAITLIST) |
| **Impact** | Les administrateurs ne peuvent pas exporter les données filtrées par statut |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonne `status` |
| **Action requise** | Ajouter une option de sélection de statut dans l'export CSV |

---

#### Export 03 : Export par domaine

| Élément | Contenu |
|---------|---------|
| **Nom** | Export par domaine |
| **Description** | L'export CSV ne permet pas de choisir le domaine des membres à exporter (Cyber, Web, AI, etc.) |
| **Impact** | Les administrateurs ne peuvent pas exporter les données filtrées par domaine |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonne `domain` |
| **Action requise** | Ajouter une option de sélection de domaine dans l'export CSV |

---

#### Export 04 : Export par pays

| Élément | Contenu |
|---------|---------|
| **Nom** | Export par pays |
| **Description** | L'export CSV ne permet pas de choisir le pays des membres à exporter (FR, CN, CM, etc.) |
| **Impact** | Les administrateurs ne peuvent pas exporter les données filtrées par pays |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonne `country` |
| **Action requise** | Ajouter une option de sélection de pays dans l'export CSV |

---

#### Export 05 : Export par niveau

| Élément | Contenu |
|---------|---------|
| **Nom** | Export par niveau |
| **Description** | L'export CSV ne permet pas de choisir le niveau des membres à exporter (L1, L2, L3, etc.) |
| **Impact** | Les administrateurs ne peuvent pas exporter les données filtrées par niveau |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `level` |
| **Action requise** | Ajouter une option de sélection de niveau dans l'export CSV |

---

#### Export 06 : Export par date

| Élément | Contenu |
|---------|---------|
| **Nom** | Export par date |
| **Description** | L'export CSV ne permet pas de choisir la date des membres à exporter (date d'inscription, date de validation) |
| **Impact** | Les administrateurs ne peuvent pas exporter les données par date |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonnes `date_inscription`, `date_validation` |
| **Action requise** | Ajouter une option de sélection de date dans l'export CSV |

---

#### Export 07 : Export par objectif

| Élément | Contenu |
|---------|---------|
| **Nom** | Export par objectif |
| **Description** | L'export CSV ne permet pas de choisir l'objectif des membres à exporter |
| **Impact** | Les administrateurs ne peuvent pas exporter les données filtrées par objectif |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `objective` |
| **Action requise** | Ajouter une option de sélection d'objectif dans l'export CSV |

---

#### Export 08 : Export par mentorat

| Élément | Contenu |
|---------|---------|
| **Nom** | Export par mentorat |
| **Description** | L'export CSV ne permet pas de choisir l'intérêt pour le mentorat des membres à exporter |
| **Impact** | Les administrateurs ne peuvent pas exporter les données filtrées par intérêt pour le mentorat |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `mentorship_interest` |
| **Action requise** | Ajouter une option de sélection d'intérêt pour le mentorat dans l'export CSV |

---

#### Export 09 : Export par budget

| Élément | Contenu |
|---------|---------|
| **Nom** | Export par budget |
| **Description** | L'export CSV ne permet pas de choisir le budget des membres à exporter |
| **Impact** | Les administrateurs ne peuvent pas exporter les données filtrées par budget |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `budget` |
| **Action requise** | Ajouter une option de sélection de budget dans l'export CSV |

---

#### Export 10 : Export avec notes internes

| Élément | Contenu |
|---------|---------|
| **Nom** | Export avec notes internes |
| **Description** | L'export CSV ne permet pas d'inclure les notes internes des membres |
| **Impact** | Les administrateurs ne peuvent pas exporter les notes internes |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `internal_notes` |
| **Action requise** | Ajouter une option d'inclusion des notes internes dans l'export CSV |

---

### 10.4 Données manquantes dans les statistiques

#### Statistique 01 : Taux de rétention

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de rétention |
| **Description** | L'interface admin n'affiche pas de taux de rétention des membres (membres actifs après X mois) |
| **Impact** | Les administrateurs ne peuvent pas analyser la fidélité des membres |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `date_inscription` |
| **Action requise** | Ajouter un indicateur de taux de rétention |

---

#### Statistique 02 : Taux de désabonnement

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de désabonnement |
| **Description** | L'interface admin n'affiche pas de taux de désabonnement des membres |
| **Impact** | Les administrateurs ne peuvent pas analyser la fidélité des membres |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `status` |
| **Action requise** | Ajouter un indicateur de taux de désabonnement |

---

#### Statistique 03 : Taux d'engagement

| Élément | Contenu |
|---|---|
| **Nom** | Taux d'engagement |
| **Description** | L'interface admin n'affiche pas de taux d'engagement des membres (nombre de membres actifs / nombre total de membres) |
| **Impact** | Les administrateurs ne peuvent pas analyser l'engagement des membres |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `status` |
| **Action requise** | Ajouter un indicateur de taux d'engagement |

---

#### Statistique 04 : Taux de conversion par canal

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de conversion par canal |
| **Description** | L'interface admin n'affiche pas de taux de conversion par canal d'acquisition (LinkedIn, WhatsApp, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser l'efficacité des canaux d'acquisition |
| **Priorité** | Haute |
| **Source de données** | Table `members`, colonne `acquisition_channel` |
| **Action requise** | Ajouter des indicateurs de taux de conversion par canal |

---

#### Statistique 05 : Taux de conversion par source

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de conversion par source |
| **Description** | L'interface admin n'affiche pas de taux de conversion par source (référent, lien, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser l'efficacité des sources d'acquisition |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `acquisition_source` |
| **Action requise** | Ajouter des indicateurs de taux de conversion par source |

---

#### Statistique 06 : Taux de conversion par mot-clé

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de conversion par mot-clé |
| **Description** | L'interface admin n'affiche pas de taux de conversion par mot-clé de recherche |
| **Impact** | Les administrateurs ne peuvent pas analyser l'efficacité des mots-clés |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `search_keyword` |
| **Action requise** | Ajouter des indicateurs de taux de conversion par mot-clé |

---

#### Statistique 07 : Taux de conversion par type de page

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de conversion par type de page |
| **Description** | L'interface admin n'affiche pas de taux de conversion par type de page (page d'accueil, page de destination, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser l'efficacité des pages |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `landing_page` |
| **Action requise** | Ajouter des indicateurs de taux de conversion par type de page |

---

#### Statistique 08 : Taux de conversion par appareil

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de conversion par appareil |
| **Description** | L'interface admin n'affiche pas de taux de conversion par appareil (mobile, desktop, tablet) |
| **Impact** | Les administrateurs ne peuvent pas analyser l'efficacité des appareils |
| **Priorité** | Moyenne |
| **Source de données** | Table `members`, colonne `device_type` |
| **Action requise** | Ajouter des indicateurs de taux de conversion par appareil |

---

#### Statistique 09 : Taux de conversion par navigateur

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de conversion par navigateur |
| **Description** | L'interface admin n'affiche pas de taux de conversion par navigateur (Chrome, Firefox, Safari, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser l'efficacité des navigateurs |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `browser_type` |
| **Action requise** | Ajouter des indicateurs de taux de conversion par navigateur |

---

#### Statistique 10 : Taux de conversion par système d'exploitation

| Élément | Contenu |
|---------|---------|
| **Nom** | Taux de conversion par système d'exploitation |
| **Description** | L'interface admin n'affiche pas de taux de conversion par système d'exploitation (Windows, macOS, Linux, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser l'efficacité des systèmes d'exploitation |
| **Priorité** | Faible |
| **Source de données** | Table `members`, colonne `os_type` |
| **Action requise** | Ajouter des indicateurs de taux de conversion par système d'exploitation |

---

### 10.5 Données manquantes dans les fenêtres de détails

#### Détail 01 : Historique des changements de statut

| Élément | Contenu |
|---------|---------|
| **Nom** | Historique des changements de statut |
| **Description** | La fenêtre de détails d'un membre n'affiche pas l'historique des changements de statut |
| **Impact** | Les administrateurs ne peuvent pas analyser l'évolution du statut d'un membre |
| **Priorité** | Moyenne |
| **Source de données** | Table `member_status_history` |
| **Action requise** | Ajouter une section "Historique des changements de statut" dans la fenêtre de détails |

---

#### Détail 02 : Historique des modifications

| Élément | Contenu |
|---------|---------|
| **Nom** | Historique des modifications |
| **Description** | La fenêtre de détails d'un membre n'affiche pas l'historique des modifications des champs |
| **Impact** | Les administrateurs ne peuvent pas analyser l'évolution du profil d'un membre |
| **Priorité** | Moyenne |
| **Source de données** | Table `member_history` |
| **Action requise** | Ajouter une section "Historique des modifications" dans la fenêtre de détails |

---

#### Détail 03 : Notes internes partagées

| Élément | Contenu |
|---------|---------|
| **Nom** | Notes internes partagées |
| **Description** | La fenêtre de détails d'un membre n'affiche pas les notes internes partagées par d'autres administrateurs |
| **Impact** | Les administrateurs ne peuvent pas collaborer sur les notes internes |
| **Priorité** | Faible |
| **Source de données** | Table `internal_notes` |
| **Action requise** | Ajouter une section "Notes internes partagées" dans la fenêtre de détails |

---

#### Détail 04 : Activité récente

| Élément | Contenu |
|---------|---------|
| **Nom** | Activité récente |
| **Description** | La fenêtre de détails d'un membre n'affiche pas l'activité récente du membre |
| **Impact** | Les administrateurs ne peuvent pas analyser l'engagement du membre |
| **Priorité** | Moyenne |
| **Source de données** | Table `member_activity` |
| **Action requise** | Ajouter une section "Activité récente" dans la fenêtre de détails |

---

#### Détail 05 : Statistiques globales du membre

| Élément | Contenu |
|---------|---------|
| **Nom** | Statistiques globales du membre |
| **Description** | La fenêtre de détails d'un membre n'affiche pas les statistiques globales du membre (nombre d'événements, nombre de commentaires, etc.) |
| **Impact** | Les administrateurs ne peuvent pas analyser l'activité globale du membre |
| **Priorité** | Faible |
| **Source de données** | Table `member_stats` |
| **Action requise** | Ajouter une section "Statistiques globales" dans la fenêtre de détails |

---

#### Détail 06 : Liens vers les événements

| Élément | Contenu |
|---------|---------|
| **Nom** | Liens vers les événements |
| **Description** | La fenêtre de détails d'un membre n'affiche pas les liens vers les événements associés au membre |
| **Impact** | Les administrateurs ne peuvent pas accéder rapidement aux événements du membre |
| **Priorité** | Moyenne |
| **Source de données** | Table `member_events` |
| **Action requise** | Ajouter une section "Événements associés" dans la fenêtre de détails |

---

#### Détail 07 : Liens vers les commentaires

| Élément | Contenu |
|---------|---------|
| **Nom** | Liens vers les commentaires |
| **Description** | La fenêtre de détails d'un membre n'affiche pas les liens vers les commentaires associés au membre |
| **Impact** | Les administrateurs ne peuvent pas accéder rapidement aux commentaires du membre |
| **Priorité** | Faible |
| **Source de données** | Table `member_comments` |
| **Action requise** | Ajouter une section "Commentaires associés" dans la fenêtre de détails |

---

#### Détail 08 : Liens vers les messages

| Élément | Contenu |
|---------|---------|
| **Nom** | Liens vers les messages |
| **Description** | La fenêtre de détails d'un membre n'affiche pas les liens vers les messages associés au membre |
| **Impact** | Les administrateurs ne peuvent pas accéder rapidement aux messages du membre |
| **Priorité** | Faible |
| **Source de données** | Table `member_messages` |
| **Action require** | Ajouter une section "Messages associés" dans la fenêtre de détails |

---

#### Détail 09 : Liens vers les invitations

| Élément | Contenu |
|---------|---------|
| **Nom** | Liens vers les invitations |
| **Description** | La fenêtre de détails d'un membre n'affiche pas les liens vers les invitations associées au membre |
| **Impact** | Les administrateurs ne peuvent pas accéder rapidement aux invitations du membre |
| **Priorité** | Faible |
| **Source de données** | Table `member_invitations` |
| **Action requise** | Ajouter une section "Invitations associées" dans la fenêtre de détails |

---

#### Détail 10 : Liens vers les notifications

| Élément | Contenu |
|---------|---------|
| **Nom** | Liens vers les notifications |
| **Description** | La fenêtre de détails d'un membre n'affiche pas les liens vers les notifications associées au membre |
| **Impact** | Les administrateurs ne peuvent pas accéder rapidement aux notifications du membre |
| **Priorité** | Faible |
| **Source de données** | Table `member_notifications` |
| **Action requise** | Ajouter une section "Notifications associées" dans la fenêtre de détails |

---

## Conclusion

Ce document définit une expérience de données claire, cohérente et actionnable pour l'interface admin HASHCODE. Les KPIs sont classés selon 4 niveaux (Tier 1-4), chaque statistique/clique mène à une action réelle, et les données manquantes sont documentées explicitement.

Les principes fondamentaux (KPI Tiers, Insight → Action, Minimum clicks, Progressive disclosure, Design system HASHCODE, Performance, Accessibilité WCAG, Responsive) guident l'implémentation des fonctionnalités de données dans l'interface admin.

Les dimensions d'analyse (domaine, pays, statut, niveau, date d'inscription, mentorat, objectif, budget) permettent de filtrer et d'analyser les données de manière granulaire.

Les indicateurs de qualité des données (complétude, champs manquants, profils incomplets) permettent aux administrateurs de surveiller la qualité des données et de prendre des actions corrective si nécessaire.

Les parcours d'activation (membre, workflow de validation, engagement path) remplacent le funnel qui n'est pas applicable dans ce contexte.

Les données manquantes sont documentées explicitement pour guider l'implémentation des fonctionnalités futures.

---

**Document généré le** : 2026-09-06
**Phase** : Phase 3 — Data Experience Audit
**Projet** : HASHCODE REBOOT — Redesign de l'interface admin
