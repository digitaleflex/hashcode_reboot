# Politique de Branches — hashcode_reboot

## Règles

| Branche | Rôle | Deploy | Force-push |
|---------|------|--------|------------|
| `main` | Production (Vercel) | Auto-deploy | ❌ INTERDIT |
| `development` | Intégration / recette | Préview | ❌ INTERDIT |
| `feature/*` | Fonctionnalités isolées | — | ❌ INTERDIT |

## Workflow

1. **Feature branch** : `git checkout -b feature/xxx development`
2. **Travail** : commits réguliers, `npm run validate` avant chaque commit
3. **PR** : ouvrir vers `development` (pas `main`)
4. **Merge** : squash ou merge commit, jamais force-push
5. **Sync** : `git merge main` dans `development` avant de créer une nouvelle feature branch

## Règle d'or : Already up to date

Avant de créer une nouvelle branche, **TOUJOURS** exécuter :

```bash
git checkout development
git fetch origin
git merge origin/main
# → "Already up to date." = OK
# → Sinon = résoudre avant de continuer
```

Cela évite les branches créées sur un `main` périmé, source de conflits.

## Temps de vie des branches

| Type | Durée max | Action |
|------|-----------|--------|
| `feature/*` | 5 jours | Merge dans `development` |
| `hotfix/*` | 24h | Merge dans `main` + `development` |
| `chore/*` | 3 jours | Merge dans `development` |

## Merge strategy

- **Feature → development** : Squash and merge (commit log propre)
- **development → main** : Merge commit (historique complet préservé)
- **JAMAIS** : Rebase sur `main` (évite de réécrire l'historique partagé)

## Conflits

1. Ne jamais résoudre un conflit avec `--theirs` ou `--ours` sans vérifier
2. Toujours compiler (`npm run validate`) après résolution
3. Si le conflit est complexe → ouvrir une PR de discussion

---

*Dernière mise à jour : 2026-09-18*
