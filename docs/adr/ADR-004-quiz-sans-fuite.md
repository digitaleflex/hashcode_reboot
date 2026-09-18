# ADR-004 : Quiz sans fuite

## Statut : Accepté

## Contexte

Les quiz contiennent des questions à choix multiple. Si les réponses correctes sont exposées côté client, un membre peut les récupérer en inspectant le réseau ou le code.

## Décision

Nous avons décidé de **ne jamais exposer `correctJson` aux membres** :

### Architecture de sécurité

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                               │
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│  │  Questions  │ ──▶ │  Réponses   │ ──▶ │  Résultat   │  │
│  │  (sans      │     │  (envoi)    │     │  (score,    │  │
│  │  correctJson)│     │             │     │   passed)   │  │
│  └─────────────┘     └─────────────┘     └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        SERVEUR                               │
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│  │  Questions  │ ──▶ │  Scoring    │ ──▶ │  Résultat   │  │
│  │  (avec      │     │  (comparaison)│    │  (retour    │  │
│  │  correctJson)│     │             │     │   client)   │  │
│  └─────────────┘     └─────────────┘     └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Règles
1. **Questions** : envoyées au client **sans** `correctJson`
2. **Réponses** : envoyées au serveur pour scoring
3. **Scoring** : comparaison côté serveur uniquement
4. **Résultat** : score + passed, **jamais** les bonnes réponses

### Validations
- `correctJson` est parsé et validé côté serveur
- Les réponses corrompues retournent `null` (pas de crash, pas de score)
- Les tentatives sont limitées par `maxAttempts`

## Conséquences

### Positives
- **Anti-triche** : les réponses ne sont jamais accessibles côté client
- **Intégrité** : le scoring est fiable
- **Simplicité** : une seule source de vérité (le serveur)

### Négatives
- **Feedback limité** : le membre ne sait pas quelles réponses sont incorrectes (sauf si le quiz est conçu pour)
- **Dépendance** : nécessite une connexion réseau pour soumettre

## Implémentation

- `src/lib/workshop-quiz.ts` : `scoreAttempt()` ne retourne jamais `correctJson`
- `src/app/api/admin/workshops/[id]/quiz/[quizId]/route.ts` : filtre `correctJson` avant envoi
- Tests : vérifient que `correctJson` n'est jamais dans la réponse API

---

*ADR-004 | 2026-09-18 | ATELIER*
