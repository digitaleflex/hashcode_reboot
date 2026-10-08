# HashCode Reboot — Execution Order V2

Date: 2026-10-08

## Objective

Exécuter Reboot comme couche d'acquisition, sans recréer JoinHashCode.

## Rule

**Reboot qualifie. JoinHashCode oriente et transforme.**

## Phase 0 — Boundary Reset

### #209 — M0
Statut réel : le travail de reset a été exécuté dans le repository.

Preuves :
- frontière architecture Reboot / JoinHashCode ;
- roadmap V2 ;
- prompt agent réaligné ;
- anciennes issues d'orientation déplacées/fermées ;
- nouvelles issues M0→M6 créées ;
- contrat JoinHashCode #394 créé.

**Action : fermer #209 comme completed.**

---

# Phase 1 — Fondations

## P0 — Bloquants

### #210 — M1 Acquisition Foundation
**Premier chantier de code.**

Dépend de : #209.

Doit définir :
- Lead ;
- AcquisitionSession ;
- LeadSource ;
- Qualification ;
- Consent ;
- Conversion ;
- AcquisitionEvent ;
- états ;
- normalisation ;
- sécurité.

### #158 — Machine à états d'acquisition
À traiter immédiatement avec #210.

### #153 — Gouvernance des données
À traiter avec #210 avant d'élargir la collecte.

### #145 — Trust / finalité de collecte
À traiter avant mise en production de nouveaux champs.

### #118 — Protection anti-abus
À traiter avant exposition importante des endpoints publics.

### #117 — Secrets admin
À traiter avant production.

---

# Phase 2 — Qualification

## P1

### #211 — M2 Lead Qualification V1
Dépend de :
- #210
- #158
- #153

Implémente uniquement :
- qualification ;
- score d'acquisition ;
- raisons ;
- segmentation ;
- états QUALIFIED / DISQUALIFIED / INSUFFICIENT_DATA.

**Interdit :**
- psychométrie complète ;
- archetypes comme moteur principal ;
- orientation ;
- matching ;
- Next Best Action.

### #103 — Doublons de leads
Dépend de #210.

À faire avant d'importer ou multiplier les leads.

### #124 — Import CSV
Dépend de #103 et #210.

---

# Phase 3 — Conversion

## P1

### #212 — M3 Conversion & Handoff
Dépend de :
- #210
- #211
- JoinHashCode #394

C'est le point de jonction officiel entre les deux produits.

Le contrat est :

Reboot
→ AcquisitionContext
→ JoinHashCode
→ Profil / Orientation / CORE

### JoinHashCode #394
Doit être traité en parallèle côté plateforme centrale.

---

# Phase 4 — Mesure

## P1

### #213 — M4 Acquisition Analytics
Dépend de #210, #211 et #212.

### #156 — Funnel acquisition → conversion
Sous-ensemble opérationnel de #213.

### #106 — Pipeline acquisition
Dépend de #210 et #211.

### #105 — Dashboard qualité des leads
Dépend de données réelles produites par #210/#211.

### #104 — Segments d'acquisition
Dépend de #211 et #213.

### #101 — Export filtré
À faire après stabilisation des données et permissions.

---

# Phase 5 — UX

## P2

### #214 — M5 UX / Trust / Optimization
Milestone de coordination.

Ordre recommandé :

1. #127 Design system
2. #128 Architecture landing
3. #129 Hero
4. #130 Trois axes
5. #132 Diagnostic
6. #133 Preuves réelles
7. #134 Roadmap publique
8. #141 I18N
9. #135 Responsive
10. #136 Motion
11. #137 Accessibility
12. #138 Performance
13. #139 E2E
14. #140 Visual QA

### Important

Ne pas refaire l'UX avant d'avoir figé le nouveau message produit.

Le message est :

> Reboot est la porte d'entrée de HashCode. Il comprend ton contexte, qualifie ton intention et te fait entrer dans la plateforme adaptée.

---

# Phase 6 — QA / Production

## P3

### #112 — Tests composants
À renforcer progressivement, puis finaliser avant release.

### #113 — E2E acquisition → handoff
Doit couvrir le funnel réel.

### #122 — Documentation API
À maintenir pendant le développement ; finalisation avant release.

### #159 — QA produit globale
Dernière validation transverse.

### #215 — M6 Production Readiness
Gate finale.

---

# Ordre global recommandé

```
209
 ↓
210 + 158 + 153 + 145 + 117 + 118
 ↓
211
 ↓
103
 ↓
124
 ↓
212 ↔ JoinHashCode #394
 ↓
213 + 156
 ↓
106
 ↓
105 + 104
 ↓
101
 ↓
214
 ↓
112 + 113 + 122
 ↓
159
 ↓
215
```

## Parallélisation possible

### Track A — Core technique
210 → 158 → 211 → 212

### Track B — Trust/Security
153 → 145 → 117 → 118

### Track C — Acquisition admin
103 → 124 → 106 → 105 → 104 → 101

### Track D — UX
127 → 128 → 129 → 130 → 132 → 133 → 134 → 135/136/137/138 → 139 → 140

### Track E — Quality
112 → 113 → 122 → 159 → 215

## Ce qui ne doit PAS être fait maintenant

Ne pas lancer :
- CORE dans Reboot ;
- orientation ;
- archetypes psychométriques comme moteur central ;
- matching ;
- recommandations ;
- Next Best Action ;
- boucle comportementale ;
- progression ;
- mentorat ;
- communauté native ;
- Evidence ;
- Portfolio ;
- Vivier.

Ces capacités appartiennent à JoinHashCode.

## Gate de passage M3

Reboot ne doit être considéré comme correctement intégré que lorsque :

1. un visiteur peut devenir un lead ;
2. le lead peut être qualifié ;
3. le score est explicable ;
4. le consentement est traçable ;
5. le lead peut être converti ;
6. le handoff est idempotent ;
7. JoinHashCode reçoit un AcquisitionContext valide ;
8. JoinHashCode peut reprendre le parcours sans recollecte inutile ;
9. les événements acquisition sont mesurables ;
10. aucune logique CORE n'est dupliquée dans Reboot.

## Résultat attendu

À la fin de cette roadmap :

**Reboot = acquisition intelligente.**

**JoinHashCode = intelligence de parcours.**

Les deux systèmes sont complémentaires et non concurrents.
