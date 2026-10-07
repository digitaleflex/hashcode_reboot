# HASHCODE REBOOT — AUDIT DU SUPERR ALGORITHME D'ORIENTATION

Branche : `development`  
Référence : dépôt `digitaleflex/hashcode_reboot`  
Date : 2026-10-07

---

## DIAGNOSTIC

Le code actuel respecte une partie importante de la vision Reboot (collecte, profilage, auto-controles, communauté) mais **ne réalise pas encore le « Super Algorithme d'orientation »** comme cœur du produit.

Le dépôt est une **plateforme d'onboarding + collecte/profilage + gestion communautaire**, pas un **moteur intelligent d'orientation adaptative**.

---

## 1. ARCHITECTURE ACTUELLE (VÉRIFIÉE)

```
Landing → Profiling Flow (37 questions) → Profile Card → Auto-Controls → Community (WhatsApp / Email / Waitlist)
```

### Modules clés (fichiers vérifiés)

| Fichier | Responsabilité | État |
|---|---|---|
| `src/lib/profiling/types.ts` | Types partagés (ProfileAnswers, GeneratedProfile, Question, AutoControlsResult) | ✅ Complet |
| `src/lib/profiling/engine.ts` | `generateProfile()`, `archetypeFor()`, `tagsFor()` | ✅ Déterministe |
| `src/lib/profiling/auto-controls.ts` | `runAutoControls()` — branching immédiat/en attente | ✅ Binaire |
| `src/lib/profiling/engine.ts` | `validateAnswer()` — validation + messages | ✅ Complet |
| `src/lib/profiling/questions.ts` | 37 questions avec conditions, groupes | ✅ Complet |
| `src/lib/profiling/validate.ts` | Zod schema + serialization Prisma | ✅ Complet |
| `src/lib/profiling/labels.ts` | Labels des domaines/niveaux | ✅ Complet |
| `src/lib/profiling/countries.ts` | Liste mondiale des pays | ✅ Complet |
| `src/lib/matching.ts` | `scoreMatch()` — mentorat uniquement | ✅ Séparé |
| `src/lib/analytics.ts` | 27 types d'événements, beacon | ✅ Complet |
| `prisma/schema.prisma` | Modèle Member (tous champs profiling), Event, Workshop, Mentorship | ✅ Complet |

### Routes API

- `POST /api/profiling/draft` — sauvegarde brouillon (rate-limited)
- `POST /api/members` — soumission profil + `runAutoControls()` + `generateProfile()` + persistance + emails
- `GET/PATCH/DELETE /api/members/[id]` — admin
- **Aucun `/api/orientation`** — pas de route dédiée au moteur d'orientation

---

## 2. DONNÉES COLLECTÉES (FACT)

`ProfileAnswers` (25 champs, `src/lib/profiling/types.ts:35-75`) :

- **Identité** : `firstName`, `lastName`, `email`, `phone`, `country`, `city`, `gender?`
- **Domaine** : `primaryDomain`, `secondaryDomains`, `domainSpecialty`
- **Niveau** : `level` (beginner/practicing/autonomous/advanced)
- **Objectifs** : `goal`, `goalProjectStage`, `goalSituation`
- **Disponibilité** : `availability`, `availabilityTimes`
- **Apprentissage** : `learningStyle`
- **Mentorat** : `mentoringInterest`, `mentoringMaybeReason`, `mentoringTypes`, `mentoringFrequency`, `mentoringDomain`
- **Budget** : `budgetRange`
- **Vision** : `threeMonthGoal`

### Persistance
- Persiste dans `Member` (Prisma, champ par champ)
- `profileArchetype`, `tags` (JSON) stockés après `generateProfile()`
- `profileStatus` / `communityStatus` / `accessLane` après `runAutoControls()`

---

## 3. DONNÉES CALCULÉES (FACT)

### Profilage (`engine.ts:284-308`)
- `archetype` : `CYBER BUILDER`, `AI EXPLORER`, `WEB ARCHITECT`, `WEB BUILDER`, `HASHCODE BUILDER`
- `tags` : `WEB`, `BEGINNER`, `ADVANCED`, `PROJECT-FOCUSED`, `EMPLOYMENT-FOCUSED`, `HIGH-AVAILABILITY`, `LIGHT-RHYTHM`, `MENTORING-INTERESTED`, `MENTORING-CURIOUS`, `PROJECT-LEARNER`, `HIGH-BUDGET`, `COUNTRY:XX`, `GENDER:XX`

### Auto-controles (`auto-controls.ts:35-87`)
- `accessLane` : `immediate` / `pending`
- `profileStatus` : `APPROVED` / `PENDING`
- `communityStatus` : `INVITED` / `NOT_INVITED`
- `reasons` : 4 catégories (`missing-core`, `disposable-email`, `low-signal-goal`, `high-value-mentoring-lead`)

---

## 4. SCORING EXISTANT

### Auto-controles (binaire, 4 seuils)
- `coreComplete` : email valide + nom + domaine + objectif + niveau + disponibilité
- `isDisposable` : domaine dans `DISPOSABLE_DOMAINS`
- `goalMeaningful` : `threeMonthGoal.trim().length >= 4`
- `highValueLead` : `mentoringInterest === "yes"` + budget dans `HIGH_BUDGET_TIERS`

### Mentorat (0-100, séparé, `matching.ts:63-99`)
```
+30 même primaryDomain
+20 overlap domainSpecialty
+20 même mentoringFrequency
+10 même country
+20 budget concret
Capé à 100
Tri : score desc → charge asc → niveau desc
```

### Gaps de scoring
- **Aucun score numérique** pour orientation profil → activités
- **Aucun système de pondération** pour recommandations générales (seulement binaire accès)
- **Aucun score de confiance** explicite (seul le flag `pending`/`immediate`)

---

## 5. ARCHÉTYPES EXISTANTS

Définis dans `engine.ts:246-258` (fonction pure `archetypeFor()`):

```typescript
if d === "cybersecurity" → CYBER BUILDER (🛡️)
if d === "ai" → AI EXPLORER (🤖)
if d === "web" + niveau avancé/autonome → WEB ARCHITECT (🏛️)
if d === "web" + débutant → WEB BUILDER (🌐)
else → HASHCODE BUILDER (✦)
```

### Critique
- **Un seul archétype** sélectionné (pas de scores multiples)
- **Pas d'archétypes Builder/Strategist/Creator/Catalyst** avec confiance — ceux-ci sont dans la vision produit, pas dans le code
- **Pas d'évolution temporelle** — le profil est statique après soumission
- **Stockage** : `profileArchetype` string libre dans `Member` (pas d'énumération)

---

## 6. RECOMMANDATIONS EXISTANTES

### Next Best Action
- **Existant** : implicite via `accessLane`
  - Immédiat → WhatsApp + communauté + email bienvenue
  - En attente → email liste d'attente uniquement
- **Manquant** : recommandation personnalisée d'activité (challenge, workshop, parcours, communauté, projet, équipe)

### Suggestions explicites
- `suggestMentors()` (`matching.ts`) — mentorat uniquement
- `ProfileCard` — affiche l'archetype comme récompense (pas d'action)
- `tagsFor()` — tags utilisables pour filtrage (pas de recommandation)

### Manque critique
Le système ne répond pas : *"Quelle est la meilleure prochaine action pour cette personne dans HashCode ?"*

---

## 7. MATCHING EXISTANT

### Mentorat (`matching.ts`)
- `MenteeProfile` / `MentorProfile` / `MatchResult`
- Score 0-100 sur 5 dimensions
- `suggestMentors(mentee, mentors, limit=5)`

### Autres matching
- **Aucun.** Event/Workshop ciblage par `domain`/`level` uniquement (filtrage manuel, pas algorithmique)
- **Intérêt événement** — `event-interest` stocké dans `localStorage`, pas d'algorithme de recommandation
- **Pas de matching membre → activité**
- **Pas de matching membre → parcours d'apprentissage**

---

## 8. DONNÉES COMPORTEMENTALES EXISTANTES

### Tracking
- `src/lib/analytics.ts` : 27 types d'événements, `sendBeacon` + fallback fetch
- Événements profiling : `started`, `question_answered`, `question_timed` (durée max 10min), `abandoned`, `completed`, `resumed`
- Événements communauté : `cta_clicked`, `whatsapp_join_clicked`, `share_profile_clicked`
- Événements événement : `interest`, `rsvp`

### Persistance comportementale
- `AnalyticsEvent` (journal d'audit)
- `EventRsvp` (`going`/`maybe`/`cancelled`)
- `MemberEmailLog` (envoyé/ouvert/clické)
- `ProfilingDraft` (abandon avec relance J+7 via cron)
- `WorkshopSubmission` / `QuizAttempt` (progression dérivée)
- `MentorshipSession` (rating 1-5)

### Gaps comportementaux
- **Pas de ré-injection** des données comportementales dans le profil
- **Pas de boucles d'adaptation** : workshop terminé → pas de mise à jour du profil/archetype
- **Pas de re-scoring** après nouvelle activité
- **Relance** uniquement par email, pas par profil interne

---

## 9. GAPS (INVENTAIRE COMPLET)

| Domaine | Existe | Manquant | Risque |
|---|---|---|---|
| Profilage | ✅ | Pourrait enrichir avec multi-axes | Faible |
| Classification multi-scores | 🟡 | Pas de Builder/Strategist/Creator/Catalyst avec scores | **Moyen** — centrale |
| Scoring orientation | ❌ | Seul binaire auto-controles + mentorat séparé | **Élevé** |
| Confidence | ❌ | Aucun calcul de confiance | **Moyen** |
| Matching profil-activités | ❌ | Seulement mentorat | **Élevé** — fonctionnalité clé |
| Next Best Action | 🟡 | Seulement accès immédiat/en attente | **Élevé** — cœur du produit |
| Feedback / adaptation | 🟡 | Tracking + draft relance | **Élevé** — pas de boucle fermée |
| Challenge model | ❌ | Pas de modèle Challenge dans Prisma | **Moyen** |
| Profil dynamique | ❌ | Profil statique après soumission | **Moyen** |

---

## 10. RISQUES

1. **Paradoxe Minimum Viable** : si on construit trop, livraison lente ; si trop peu, produit ne gagne pas sa promesse d'orientation.
2. **Stagnation** : sans matching et sans recommandation, Reboot reste une landing avec formulaire — pas un moteur.
3. **Obsolescence du profil** : questionnaire initial = hypothèse ; sans feedback, profils deviennent faux au fil du temps.
4. **Confusion des systèmes** : mentorat (`matching.ts`) et orientation sont deux systèmes indépendants — risque de divergence.
5. **Sécurité** : données de profiling sensibles ; pas d'exposition des scores internes dans le frontend (à vérifier).

---

## 11. CE QUI DOIT ÊTRE CONSERVÉ (PRÉSERVÉ)

```
✅ src/lib/profiling/engine.ts         (génération profil — réutilisable)
✅ src/lib/profiling/auto-controls.ts  (gating d'accès — réutilisable)
✅ src/lib/profiling/types.ts          (schéma — réutilisable)
✅ src/lib/profiling/validate.ts       (sérialisation — réutilisable)
✅ src/lib/profiling/questions.ts      (surface — réutilisable)
✅ src/lib/matching.ts                (mentorat — séparé, conserver)
✅ Prisma Member + tous champs        (persistance — réutilisable)
✅ ProfileCard UI                      (récompense — réutilisable)
✅ ProfilingFlow UI                    (parcours — réutilisable)
✅ Analytics tracking                  (données — réutilisable)
✅ Event/Workshop targeting            (base — réutilisable)
✅ Workshop progression (derived)     (avancement — réutilisable)
```

---

## 12. CE QUI DOIT ÊTRE REFACTORÉ (MODIFIÉ)

| Composant | Raison | Impact |
|---|---|---|
| `archetypeFor()` → `scoreArchetypes()` | Un seul archétype statique → scores multiples avec confiance | Central — débloque le reste |
| `runAutoControls()` → `computeAccessAndConfidence()` | Binaire → graduation + confiance | Meilleure segmentation |
| `generateProfile()` → enrichi | Ajouter scores, confiance, domaines, recommandations | Permet nouveau moteur |
| `ProfileAnswers` / `GeneratedProfile` | Ajouter champs de confiance, scores, recommandations | Cohérence du modèle |

---

## 13. CE QUI DOIT ÊTRE CRÉÉ

### Architecture proposée : `src/lib/orientation/`

```text
orientation/
├── 01_features.ts             // Définition des caractéristiques
├── 02_normalization.ts        // Standardisation des données
├── 03_archetypeScoring.ts     // Scores Builder/Strategist/Creator/Catalyst
├── 04_scoringEngine.ts        // Moteur de pondération déterministe
├── 05_confidenceCalculator.ts // Confiance basée sur données + qualité
├── 06_profileMatching.ts      // Profil ↔ activités (challenges, workshops, parcours, communauté)
├── 07_recommendationEngine.ts // Next best action + alternatives explicables
├── 08_feedbackLoop.ts         // Observer → Profil → Re-scoring
├── 09_engine.ts              // API publique : evaluate(profile) → orientationResult
├── 10_types.ts               // Types d'orientation (score, confiance, recommandation)
└── 11_tests/                 // Cas : débutant/Web, stratège, créateur, ambigu, insuffisant, contradictoire
```

### Résultat V1 conceptuel (`orientationResult`)

```json
{
  "profile": {
    "primary": "BUILDER",
    "secondary": "STRATEGIST",
    "scores": { "builder": 0.82, "strategist": 0.67, "creator": 0.41, "catalyst": 0.35 }
  },
  "confidence": 0.81,
  "domains": ["WEB", "AI"],
  "level": "BEGINNER",
  "recommendations": [
    { "type": "CHALLENGE", "id": "challenge-03", "score": 0.92 },
    { "type": "WORKSHOP", "id": "git-foundations", "score": 0.84 }
  ],
  "nextBestAction": {
    "type": "CHALLENGE",
    "id": "challenge-03",
    "reason": "Profil Builder + faible expérience GitHub → meilleur parcours pour pratiquer"
  }
}
```

---

## 14. PROPOSITION DU SUPER ALGO V1

### Principes
1. **Déterministe d'abord** — règles explicables, pas d'IA/ML initialement
2. **Score multi-axes** — 4 archétypes avec scores 0-1 + confiance
3. **Matching profil-activités** — compare profil avec activités disponibles
4. **Next Best Action actionnable** — une seule action claire avec raisons
5. **Boucle feedback** — observer → reprofilage

### Phases

| Phase | Durée | Contenu |
|---|---|---|
| **0 — Audit/Spéc** | 1 semaine | Documents `docs/orientation-engine/` ; valider règles de scoring |
| **1 — Core** | 4 semaines | `archetypeScoring.ts`, `scoringEngine.ts`, `confidenceCalculator.ts`, `profileMatching.ts` |
| **2 — Recommandation** | 3 semaines | `recommendationEngine.ts`, `feedbackLoop.ts`, hooks d'intégration |
| **3 — Tests** | 2 semaines | Tests unitaires + intégration + 10 cas de profil (A-J) |
| **4 — Intégration** | 2 semaines | API `/api/orientation/evaluate` ; brancher à `runAutoControls` |

---

## 15. PLAN D'IMPLÉMENTATION (PHASES)

### Semaine 1-2 : Spécification (Phase 0)
- Finaliser `docs/orientation-engine/00-vision.md` → `11-test-cases.md`
- Définir règles de scoring (poids, conditions)
- Définir modèle d'activités (challenge/workshop/parcours/communauté)
- Valider avec produit : quels archétypes, quelles actions, quelles données sont nécessaires

### Semaine 3-6 : Noyau (Phase 1)
- `archetypeScoring.ts` : calcul des scores Builder/Strategist/Creator/Catalyst à partir de `ProfileAnswers` (domain, level, goal, learningStyle, availability, mentoringInterest, budgetRange, threeMonthGoal)
- `scoringEngine.ts` : normalisation + pondération
- `confidenceCalculator.ts` : confiance basée sur nombre de réponses, cohérence, fraîcheur
- `profileMatching.ts` : matching minimal (domain/level/availability → activités disponibles)

### Semaine 7-9 : Recommandations (Phase 2)
- `recommendationEngine.ts` : sélection top N recommandations + détermination `nextBestAction`
- `feedbackLoop.ts` : observer workshop/quiz/participation → ajustement scores
- Intégration : `orientationEngine.evaluate()` appelé depuis `generateProfile()` et `runAutoControls()`

### Semaine 10-11 : Tests (Phase 3)
- Tests pour chaque module
- Tests d'intégration : pipeline `ProfileAnswers` → `orientationResult`
- 10 cas représentatifs (débutant Web, stratège, créateur, ambigu, données insuffisantes, contradictoire, ancien, activité récente, pas de match, etc.)

### Semaine 12 : Déploiement (Phase 4)
- Route API `/api/orientation/evaluate`
- Monitoring : scores de confiance, taux de réponse next best action, corrections de feedback

---

## 16. TEST STRATEGY (CAS REPRÉSENTATIFS)

| Cas | Profil | Objectif de test | Résultat attendu |
|---|---|---|---|
| **A** | Débutant Web, intérêt développement | Valider archetype Web builder | Next best action = Challenge Web |
| **B** | Profil stratège fort (business, path) | Valider Strategist dominant | Next best action = Parcours structuré |
| **C** | Profil Creator (projet, business) | Valider Creator | Next best action = Projet/Workshop |
| **D** | Profil Catalyst (group, mentor, communauté) | Valider Catalyst | Next best action = Communauté / Équipe |
| **E** | Ambigu (scores proches) | Valider comportement par défaut | Next best action = Équilibré + compléter profil |
| **F** | Données insuffisantes | Valider gestion de données manquantes | Status = INSUFFICIENT_DATA |
| **G** | Profils contradictoires | Valider résolution des conflits | Recommandation cohérente avec priorité |
| **H** | Profil ancien (>6 mois) | Valider re-scoring | Nouvelle recommandation différente |
| **I** | Activité récente (challenge complété) | Valider feedback loop | Profil mis à jour → nouvelle recommandation |
| **J** | Aucune activité disponible | Valider absence de match | NO_MATCH + action générique explicite |

### Critères de succès
- **Explicabilité** : chaque recommandation a une raison lisible (pas opaque)
- **Déterminisme** : même profil → même résultat (versionnage du moteur)
- **Fiabilité** : score de confiance >0.7 → recommandation stable ; <0.4 → demande complétion
- **Actionnable** : next best action est une action concrète (pas "continue à apprendre")
- **Mesurable** : toutes les évaluations loguées, comparables dans le temps

---

## ANNEXE — EVIDENCE VÉRIFIÉE (FICHIERS, LIGNES)

```
Profiling core        : src/lib/profiling/engine.ts:284-308 (generateProfile)
Archetype rules       : src/lib/profiling/engine.ts:246-258 (archetypeFor)
Tags generation       : src/lib/profiling/engine.ts:261-282 (tagsFor)
Auto-controls         : src/lib/profiling/auto-controls.ts:35-87 (runAutoControls)
Questions             : src/lib/profiling/questions.ts (37 questions)
Types                 : src/lib/profiling/types.ts:1-148
Matching mentorat     : src/lib/matching.ts (scoreMatch, suggestMentors)
Analytics             : src/lib/analytics.ts (27 EVENT_TYPES)
Profile card UI       : src/components/reboot/profile-card.tsx
Profiling flow        : src/components/reboot/profiling-flow.tsx
Engine section        : src/components/reboot/landing/engine.tsx (demo)
API members           : src/app/api/members/route.ts
API draft             : src/app/api/profiling/draft/route.ts
Prisma schema        : prisma/schema.prisma (Member:15-120, Event:393-443, Workshop:580-600)
Tests profiling       : tests/profiling.test.cjs (44 suites)
```

---

## CONCLUSION

Le dépôt `development` constitue **une base technique solide et cohérente** pour le système de profilage de Reboot. Les fondations (collecte, validation, persistance, profilage statique, auto-controles, analytics, mentorat, progression dérivée) sont bien construites et réutilisables.

Le **Super Algorithme d'orientation** — le moteur central qui transforme le profil en compréhension puis en action — **est absent comme système unifié**. Il doit être construit par-dessus l'existant, sans casser le fonctionnement actuel, en commençant par une spécification technique puis une implémentation progressive (déterministe d'abord, itérative ensuite, mesurable toujours).

**Prochaine action recommandée :** créer `docs/orientation-engine/` (spécification) et `src/lib/orientation/` (noyau V1) en parallèle avec la préservation de tout le système existant.
