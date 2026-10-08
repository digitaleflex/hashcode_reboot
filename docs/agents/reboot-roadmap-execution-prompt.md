# Agent Execution Prompt — HashCode Reboot V2

Repository: `digitaleflex/hashcode_reboot`
Branch: `development`

## Référence absolue

Lire avant toute modification :
1. `docs/architecture/reboot-joinhashcode-boundary.md`
2. `docs/roadmap/reboot-roadmap-v2.md`
3. l'état réel du repository et des issues.

## Mission

Réaligner Reboot comme **couche d'acquisition et de qualification**, sans reconstruire les fonctions déjà propriétaires de JoinHashCode.

### Règle centrale

**Reboot qualifie. JoinHashCode oriente et transforme.**

## Avant de coder

1. Inspecter le code réel.
2. Vérifier les issues ouvertes.
3. Identifier les fonctionnalités qui appartiennent à JoinHashCode.
4. Classer chaque issue : KEEP / REWRITE / MERGE / MOVE / CLOSE / NEW.
5. Vérifier dépendances et données réellement disponibles.
6. Documenter les décisions irréversibles.

## Architecture cible

```
src/lib/acquisition/
  types.ts
  normalization.ts
  qualification.ts
  scoring.ts
  attribution.ts
  conversion.ts
```

Ne crée pas de moteur `orientation/` dans Reboot.

## Modèle

```
Visitor → AcquisitionSession → Lead → Qualification
→ Acquisition Qualification Score → Conversion → JoinHashCode
```

## Qualification V1

Le moteur doit être déterministe, explicable, versionné, testable et reproductible.

Le score mesure la préparation/qualité du lead pour la conversion.

**Score ≠ confidence.**

Ne crée pas de score psychométrique, d'archetype complet ou de recommandation de parcours dans Reboot.

## Handoff

Le contrat Reboot → JoinHashCode doit être explicite, versionné, minimal, idempotent, sécurisé et observable.

Ne couple pas Reboot à des tables internes de JoinHashCode.

## Analytics

Mesurer prioritairement :
`visit → diagnostic_started → lead_captured → qualification_completed → qualified → conversion_started → conversion_completed → handoff_success/failure`

Pas d'événements de progression pédagogique dans Reboot.

## Hors scope

CORE, orientation métier, spécialisation, Next Best Action, matching général, apprentissage, Labs, Evidence, Portfolio, Vivier, mentorat, communauté native, gamification, paiement, marketplace et LLM/ML comme moteur de décision.

## Mode d'exécution

Inspecter → diagnostiquer → planifier → modifier → tester → vérifier → résumer.

Ne demande pas confirmation pour chaque micro-décision. Demande uniquement lorsqu'une ambiguïté bloquante ne peut pas être résolue à partir des documents et du repository.
