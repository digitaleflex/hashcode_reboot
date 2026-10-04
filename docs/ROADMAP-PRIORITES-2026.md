# HashCode Reboot — Roadmap de résolution et priorités

> Plan directeur issu de l'audit produit et technique du backlog HashCode Reboot.
>
> Objectif : transformer HashCode d'une plateforme disposant de plusieurs briques fonctionnelles en un système cohérent capable de **attirer → orienter → activer → faire agir → faire progresser → engager → faire revenir** ses membres.

## 1. Vision cible

```
VISITEUR
  ↓
COMPRÉHENSION
  ↓
ORIENTATION
  ↓
PROFILAGE
  ↓
INSCRIPTION
  ↓
ACTIVATION
  ↓
PREMIÈRE ACTION
  ↓
MISSION
  ↓
RÉALISATION
  ↓
VALIDATION
  ↓
PROGRESSION
  ↓
RECOMMANDATION
  ↓
COMMUNAUTÉ
  ↓
MENTORAT
  ↓
RETOUR
  ↓
PARRAINAGE
  ↺
```

La priorité n'est donc pas de multiplier les fonctionnalités. La priorité est de fermer cette boucle produit.

## 2. Niveaux de priorité

| Badge | Niveau | Définition |
|---|---|---|
| 🔴 P0 | Bloquant | Sécurité, stabilité ou fondation produit indispensable |
| 🟠 P1 | Critique | Indispensable pour un parcours réellement exploitable |
| 🟡 P2 | Important | Amélioration forte de l'expérience ou de la portée |
| 🟢 P3 | Optimisation | Croissance, expérimentation ou perfectionnement |

Les deadlines sont des **cibles de planification**, pas des engagements contractuels. Une issue ne doit être déclarée terminée qu'après validation du code, des critères d'acceptation, de la persistance des états/données, des tests et des preuves.

---

# M01 — FOUNDATION · Entry & Trust
**Priorité : 🔴 P0 / 🟠 P1**  
**Cible : 11 octobre 2026**

### Issues

- 🔴 #117 — Rotation et gestion des ADMIN_KEYS
- 🔴 #118 — Protection anti-abus / Turnstile
- 🔴 #121 — Gestion centralisée des erreurs
- 🟠 #141 — Localisation française complète
- 🔴 #145 — Confiance, sécurité et cadre d'utilisation
- 🟠 #154 — Inscription et activation de compte de bout en bout
- 🟠 #146 — États d'entrée : visiteur, nouveau membre, membre actif, session expirée
- 🟠 #158 — États globaux et machine à états utilisateur

### Apport

- réduction du risque de sécurité ;
- parcours d'entrée cohérent ;
- fondation linguistique française stable ;
- distinction claire entre inscription et activation ;
- comportement cohérent selon l'état du membre ;
- base de données/états exploitable par les milestones suivants.

### Definition of Done

Le parcours visiteur → profilage → compte → activation doit être déterministe, protégé, testable et récupérable.

---

# M02 — CORE · Member Journey
**Priorité : 🔴 P0 / 🟠 P1**  
**Cible : 18 octobre 2026**

### Issues

- 🔴 #142 — Parcours d'entrée complet : Visiteur → Profilage → Première action
- 🔴 #143 — Système d'orientation « Où commencer ? »
- 🟠 #144 — Première expérience membre : activation et checklist
- 🔴 #147 — Modèle de progression membre
- 🔴 #148 — Parcours pédagogique Apprendre → Pratiquer → Construire → Évoluer
- 🔴 #149 — Système de missions et validation des réalisations
- 🟠 #150 — Boucle de recommandation HashCode
- 🟠 #155 — Profil, compétences et évolution
- 🔴 #159 — Validation produit de bout en bout

### Apport

HashCode passe de « profil + communauté » à un véritable système de progression :

```
Profil
 ↓
Recommandation
 ↓
Mission
 ↓
Réalisation
 ↓
Validation
 ↓
Compétence
 ↓
Progression
 ↓
Prochaine action
```

C'est le cœur de la proposition de valeur HashCode.

---

# M03 — COMMUNITY · Community & Mentoring
**Priorité : 🟠 P1**  
**Cible : 25 octobre 2026**

### Issues

- 🟠 #107 — Parcours complet de mentoring
- 🟠 #108 — Annuaire des membres
- 🟠 #110 — Posts / actualités / interactions
- 🟠 #151 — Parcours d'engagement communautaire
- 🟠 #152 — Parcours mentor ↔ mentoré
- 🟠 #157 — Modération et signalement

### Apport

La communauté devient une partie du produit et non un simple canal externe :

```
Membre
 ↓
Découvre
 ↓
Rejoint
 ↓
Interagit
 ↓
Contribue
 ↓
Aide
 ↓
Devient mentor
```

Le clic WhatsApp ne doit pas être confondu avec l'activation communautaire.

---

# M04 — DATA · Analytics & Lifecycle
**Priorité : 🟠 P1**  
**Cible : 31 octobre 2026**

### Issues

- 🟠 #119 — Supervision de l'activité / alertes
- 🟠 #120 — Activation et engagement
- 🟠 #156 — Funnel produit et événements de parcours
- 🟠 #166 — Attribution acquisition UTM et campagnes
- 🟠 #167 — CRM et lifecycle marketing
- 🟠 #172 — Parcours post-conversion et activation

### Apport

Le parcours devient mesurable de bout en bout :

```
Visit
 ↓
CTA
 ↓
Orientation
 ↓
Profiling Started
 ↓
Profiling Completed
 ↓
Account Created
 ↓
Account Activated
 ↓
First Action
 ↓
Mission Started
 ↓
Mission Submitted
 ↓
Mission Validated
 ↓
Progression
 ↓
Community
 ↓
Retention
 ↓
Referral
```

Objectif : remplacer les hypothèses par des données observables. Aucun chiffre de conversion ou de preuve sociale ne doit être inventé.

---

# M05 — MARKETING · Acquisition Engine
**Priorité : 🟠 P1 / 🟡 P2**  
**Cible : 8 novembre 2026**

### Issues

- 🟠 #160 — Positionnement, promesse et proposition de valeur
- 🟠 #161 — Architecture de conversion de la landing
- 🟡 #162 — CTA et micro-conversions
- 🟡 #163 — Personas et segmentation
- 🟡 #164 — Preuves sociales et crédibilité
- 🟠 #165 — Stratégie de contenu et SEO
- 🟠 #168 — Conversion WhatsApp et sortie de tunnel
- 🟡 #169 — Boucle de recommandation et parrainage
- 🟡 #170 — Expérience d'acquisition par canal
- 🟠 #173 — Cohérence des promesses avec le produit réellement disponible
- 🟠 #174 — Trust marketing : confidentialité, consentement et copy

### Apport

HashCode pourra convertir plusieurs sources d'acquisition sans dépendre d'un seul parcours :

```
TikTok / Instagram / WhatsApp / LinkedIn / Google / Événements / Parrainage
                                  ↓
                           Landing adaptée
                                  ↓
                              Orientation
                                  ↓
                              Profilage
                                  ↓
                              Activation
```

---

# M06 — ADMIN · Operations
**Priorité : 🟠 P1**  
**Cible : 8 novembre 2026**

### Issues

- 🟠 #100
- 🟠 #101
- 🟠 #102
- 🟠 #103
- 🟠 #104
- 🟠 #105
- 🟠 #106
- 🟠 #122
- 🟠 #124

### Apport

Fournir à l'équipe HashCode un véritable back-office pour :

- membres ;
- profils ;
- activité ;
- mentorat ;
- contenu ;
- modération ;
- analytics ;
- opérations administratives ;
- supervision.

Les détails de chaque issue restent la source de vérité fonctionnelle.

---

# M07 — QA · Release Hardening
**Priorité : 🔴 P0**  
**Transversal à tous les milestones**

### Issues

- 🔴 #112 — Tests unitaires React
- 🔴 #113 — E2E
- 🔴 #139 — Landing E2E regression
- 🔴 #159 — Validation produit de bout en bout
- 🔴 #175 — Marketing QA et readiness avant acquisition publique
- 🟠 #115 — Optimisation des images
- 🟡 #138 — Performance et optimisation

### Definition of Done

Une fonctionnalité n'est pas considérée comme terminée uniquement parce que le code compile.

```
Code
 ↓
Tests
 ↓
Build
 ↓
E2E
 ↓
Security
 ↓
Product validation
 ↓
Evidence
 ↓
PR review
 ↓
Merge
```

---

# M08 — EXPERIENCE · Public UX V2
**Priorité : 🟡 P2**  
**Cible : 15 novembre 2026**

### Issues

- #127 — Design system
- #128 — Architecture landing
- #129 — Hero ecosystem
- #130 — Three tracks
- #131 — Learn → Practice → Build → Evolve
- #132 — Profile Engine
- #133 — Community activity
- #134 — Roadmap
- #135 — Responsive mobile
- #136 — Motion system
- #137 — Accessibility
- #138 — Performance
- #139 — Landing E2E
- #140 — Final visual QA

### Principe

Ne pas construire une interface magnifique autour d'un parcours produit incomplet.

La V2 doit mettre en scène un système fonctionnel et stable.

---

# M09 — GROWTH · Optimization & Monetization
**Priorité : 🟢 P3**  
**Cible : après stabilisation du cœur**

### Issues

- 🟢 #109 — Stripe / monétisation
- 🟢 #111 — PWA
- 🟢 #114 — Referral avancé
- 🟢 #171 — CRO et expérimentation contrôlée

### Apport

- monétisation ;
- croissance mesurable ;
- expérimentation ;
- distribution ;
- amélioration continue.

Ces éléments ne doivent pas précéder la validation du cœur produit.

---

# 3. Issues transversales

## #123 — Roadmap / Product Gap Analysis

**Priorité : 🟠 P1 — Control Tower**

Cette issue sert de référence pour :

```
Roadmap
 ↓
Priorisation
 ↓
Dépendances
 ↓
Agents
 ↓
Issues
 ↓
PR
 ↓
Validation
```

Elle ne doit pas être traitée comme une feature utilisateur isolée.

## #176 — GitHub Agent Team

**Type : infrastructure de delivery**

Le PR d'agents définit les rôles spécialisés :

- Architecture
- Core
- Localization
- UX
- Security
- Data/Growth
- Community
- QA
- Orchestration

Important : la désignation d'un agent dans un commentaire GitHub ne signifie pas que le Coding Agent a effectivement démarré. L'exécution effective dépend de l'intégration Copilot/Agents du dépôt.

---

# 4. Les 10 transformations à plus forte valeur

Si le backlog devait être drastiquement réduit, les priorités stratégiques sont :

1. 🔴 #147 — Modèle de progression
2. 🔴 #149 — Missions + validation
3. 🔴 #142 — Parcours d'entrée
4. 🔴 #143 — « Où commencer ? »
5. 🔴 #148 — Apprendre → Pratiquer → Construire → Évoluer
6. 🟠 #150 — Recommandation
7. 🟠 #155 — Profil + compétences + évolution
8. 🟠 #156 — Analytics produit
9. 🟠 #151 — Engagement communautaire
10. 🔴 #159 — E2E produit complet

---

# 5. Ordre de résolution recommandé

```
M01 Foundation
      ↓
M02 Core
      ↓
M03 Community
      ↓
M04 Data
      ↓
M05 Marketing
      ↓
M06 Admin
      ↓
M07 QA / Release
      ↓
M08 UX V2
      ↓
M09 Growth / Monetization
```

### Règle de dépendance

Ne pas lancer simultanément plusieurs agents qui modifient :

- le même modèle Prisma ;
- la même machine à états ;
- la même architecture de landing ;
- les mêmes fichiers de localisation ;
- les mêmes contrats API.

Le parallélisme est utile uniquement lorsque les périmètres sont indépendants.

---

# 6. Definition of Done globale

Chaque issue importante doit franchir quatre gates :

### Gate 1 — Technical
Code propre, typecheck, lint, build et tests pertinents.

### Gate 2 — Product
Le comportement utilisateur demandé fonctionne réellement.

### Gate 3 — Data
Les états, événements et données nécessaires sont persistés correctement.

### Gate 4 — Proof
E2E, traces, captures ou autres preuves permettant de vérifier l'acceptation.

Une issue sans preuve ne doit pas être considérée comme « done ».

---

# 7. Résultat cible

À la fin de cette roadmap, HashCode doit pouvoir fonctionner comme :

> **un système d'orientation et de progression technologique.**

Et non uniquement comme :

- une landing ;
- un questionnaire ;
- une communauté ;
- une collection de features.

Le produit cible est :

```
ORIENTATION
    +
PERSONNALISATION
    +
ACTION
    +
VALIDATION
    +
PROGRESSION
    +
COMMUNAUTÉ
    +
INTELLIGENCE
```

La boucle fondamentale devient :

**Comprendre → S'orienter → Commencer → Agir → Réaliser → Progresser → Revenir → Contribuer.**

---

## 8. Règle de pilotage

**Ne pas mesurer l'avancement au nombre d'issues fermées.**

Mesurer l'avancement par les capacités réellement disponibles :

- Un visiteur comprend-il HashCode ?
- Sait-il où commencer ?
- Peut-il créer et activer son compte ?
- Reçoit-il une prochaine action pertinente ?
- Peut-il réaliser une mission ?
- Sa réalisation peut-elle être validée ?
- Sa progression est-elle persistée ?
- Le système sait-il quoi lui recommander ensuite ?
- Peut-il rejoindre et utiliser la communauté ?
- Les administrateurs peuvent-ils superviser le système ?
- Le funnel complet est-il mesurable ?
- Les parcours critiques sont-ils couverts par des tests ?

**Le produit est prêt lorsque ces réponses sont vérifiables par des preuves, pas simplement lorsque les issues sont fermées.**
