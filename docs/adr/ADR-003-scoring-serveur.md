# ADR-003 : Scoring serveur

## Statut : Accepté

## Contexte

Les quiz contiennent les bonnes réponses. Si le scoring est côté client, un membre malveillant peut inspecter le code pour trouver les réponses correctes.

## Décision

Nous avons décidé que **tout le scoring s'effectue côté serveur** :

### Flux
1. Le client soumet les réponses du quiz
2. Le serveur récupère `correctJson` depuis la base de données
3. Le serveur calcule le score
4. Le serveur retourne uniquement le résultat (pas les bonnes réponses)

### Données exposées au client
```typescript
{
  score: number;        // Nombre de bonnes réponses
  total: number;        // Nombre total de questions
  passed: boolean;      // score / total >= seuil
  attemptNumber: number; // Numéro de la tentative
}
```

### Données JAMAIS exposées au client
```typescript
{
  correctJson: string;  // Les bonnes réponses (SERVEUR SEULEMENT)
  correctAnswers: number[]; // Indices des bonnes réponses
}
```

## Conséquences

### Positives
- **Sécurité** : les réponses ne fuitent jamais vers le client
- **Intégrité** : le scoring est fiable et non manipulable
- **Simplicité** : une seule logique de scoring (côté serveur)

### Négatives
- **Latence** : un appel réseau supplémentaire pour chaque tentative
- **Dépendance** : le quiz ne peut pas être évalué hors-ligne

## Implémentation

- `src/lib/workshop-quiz.ts` : logique de scoring pure
- `src/lib/workshop-server.ts` : glue DB → scoring
- `src/app/api/admin/workshops/[id]/quiz/[quizId]/route.ts` : endpoint de soumission

---

*ADR-003 | 2026-09-18 | ATELIER*
