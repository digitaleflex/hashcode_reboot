# ADR-002 : Progression séquentielle

## Statut : Accepté

## Contexte

Un atelier est composé de semaines, elles-mêmes composées de séances, contenant des activités, des livrables et des quiz. La question est : faut-il permettre aux membres de sauter des étapes ?

## Décision

Nous avons décidé d'implémenter une **progression séquentielle avec unlock par chaîne** :

```
Semaine 1 → Semaine 2 → Semaine 3 → ... → Semaine N
    ↓            ↓            ↓
  Séance 1.1 → Séance 1.2 → Séance 1.3
```

### Règles d'unlock
1. **Semaine** : débloquée quand la semaine précédente est complétée
2. **Séance** : débloquée quand la séance précédente est complétée
3. **Activité** : débloquée quand l'activité précédente est complétée
4. **Quiz** : débloqué après completion de l'activité associée

### Marqueurs de completion
- `isCompleted` (boolean) : un événement "completion" est émis
- `completedAt` (timestamp) : date de completion
- `unlockedAt` (timestamp) : date de déblocage

## Conséquences

### Positives
- **Pédagogie** : les membres progressent dans l'ordre, pas de sauts
- **Simplicité** : la logique de déblocage est linéaire, pas de graphes complexes
- **Traçabilité** : on sait exactement où en est chaque membre

### Négatives
- **Rigidité** : un membre ne peut pas sauter une séance qu'il maîtrise déjà
- **Dépendance** : si une séance est bloquée, tout le reste est bloqué

## Alternatives considérées

1. **Progression libre** : Rejeté — trop de désordre, pas de suivi pédagogique
2. **Progression par branches** : Rejeté — complexité excessive pour un MVP
3. **Progression conditionnelle (prérequis)** : Considéré pour V2

---

*ADR-002 | 2026-09-18 | ATELIER*
