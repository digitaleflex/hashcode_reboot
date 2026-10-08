# HashCode Reboot — Boundary & Integration Contract V2

Date de référence: 2026-10-08
Branche de référence: `development`

## 1. Positionnement

HashCode Reboot est la **couche d'acquisition et d'entrée** de l'écosystème HashCode.

Sa responsabilité est de transformer un visiteur en **lead qualifié et consentant**, de recueillir les informations utiles à la compréhension initiale, de mesurer l'intention et le contexte, puis de transmettre proprement ces données à JoinHashCode.

Reboot ne doit pas devenir un second JoinHashCode.

### Reboot répond à trois questions

1. **Qui es-tu ?**
2. **Pourquoi viens-tu ?**
3. **Es-tu prêt à poursuivre ?**

Résultat : **QUALIFIED LEAD → CONVERSION → JOINHASHCODE**.

## 2. Responsabilités de Reboot

- acquisition publique ;
- landing et proposition de valeur ;
- capture de leads ;
- consentement et confiance ;
- diagnostic initial léger ;
- qualification d'intention ;
- segmentation d'acquisition ;
- attribution de source/campagne ;
- suivi du funnel d'acquisition ;
- gestion de la session d'acquisition ;
- conversion vers JoinHashCode ;
- transmission contrôlée des données ;
- mesure acquisition → conversion.

Reboot peut calculer un **Acquisition Qualification Score**. Ce score mesure la qualité/préparation du lead pour la conversion. Il ne constitue pas un profil psychométrique, une orientation métier ou une recommandation de parcours.

## 3. Ce qui appartient à JoinHashCode

JoinHashCode porte le profil utilisateur complet, le quiz psychométrique, les archétypes, la spécialisation, l'orientation, l'objectif 90 jours, le CORE Decision Engine, la prochaine meilleure étape, le matching général, l'apprentissage, la pratique, les Labs, la validation, Evidence, Portfolio, Vivier, progression, mentorat, communauté et opportunités.

## 4. Règle fondamentale

**Reboot qualifie. JoinHashCode oriente et transforme.**

Il est interdit de reconstruire dans Reboot :
- un deuxième CORE ;
- un moteur psychométrique complet ;
- un moteur de recommandation de parcours ;
- un système général de matching ;
- une progression pédagogique ;
- un système de mentorat ;
- une communauté native ;
- un LMS ;
- un système Evidence/Portfolio/Vivier.

## 5. Contrat de données

### Reboot produit
```
Lead
AcquisitionSession
LeadSource
Qualification
Consent
Conversion
AcquisitionEvent
```

### JoinHashCode reçoit
```
AcquisitionContext
├── identity/context when consented
├── source
├── acquisition intent
├── declared interests
├── declared objective
├── declared level/context
├── availability/context where justified
├── qualification score + reasons
├── consent state
└── conversion metadata
```

JoinHashCode reste propriétaire du profil membre et de son évolution.

## 6. Flux cible

```
VISITOR → LANDING → DIAGNOSTIC/CAPTURE → QUALIFICATION
→ QUALIFIED LEAD → CONVERSION → JOINHASHCODE
→ PROFILING → ORIENTATION/CORE → PARCOURS
```

## 7. Anti-duplication

Les données doivent être demandées au plus tôt une seule fois lorsque leur finalité est claire.

Reboot ne doit pas demander des données uniquement nécessaires à JoinHashCode si elles peuvent être transmises après consentement.

JoinHashCode ne doit pas dépendre d'une implémentation interne de Reboot : l'intégration passe par un contrat explicite, versionné et documenté.

## 8. Règles de scoring

Le **Acquisition Qualification Score** peut utiliser : complétude, intention, objectif explicite, disponibilité déclarée, cohérence minimale des réponses, source/campagne et engagement dans le funnel.

Le score doit être déterministe, explicable, versionné, testable et indépendant du scoring d'orientation de JoinHashCode.

**Score ≠ confiance.**

Reboot ne produit pas de confidence score psychométrique.

## 9. Analytics

```
visit → diagnostic_started → lead_captured
→ qualification_completed → qualified
→ conversion_started → conversion_completed
→ handoff_success / handoff_failed
```

Pas de PII inutile dans les événements. Les événements de progression, recommandation et activité appartiennent à JoinHashCode.

## 10. Sécurité & vie privée

- finalité explicite ;
- consentements séparés lorsque nécessaire ;
- minimisation des données ;
- suppression/export selon les obligations applicables ;
- transmission contrôlée ;
- audit des conversions et handoffs ;
- aucune exposition inutile du profilage.

## 11. Definition of Done

Une évolution Reboot est acceptée uniquement si elle renforce l'acquisition, la qualification, la confiance ou la conversion, ne duplique pas JoinHashCode, documente son contrat de données, passe les tests pertinents, rend ses analytics identifiables et respecte la confidentialité.

## 12. Question de décision

> Est-ce nécessaire pour transformer un visiteur en lead qualifié et le transmettre proprement à JoinHashCode ?

Si non, la fonctionnalité n'appartient probablement pas à Reboot.
