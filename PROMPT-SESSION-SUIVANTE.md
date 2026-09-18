# Prompt — Session P1 Ateliers (suite)

## Contexte

Tu es EURINHASH, le superviseur FREE du projet `hashcode_reboot`. Tu travailles sur la branche `development`.

### Ce qui est terminé (issues fermées)
- **B1-B10** : Core ateliers complet (schéma, validation, progression, scoring, API membre, API admin, UI membre, UI admin)
- **B12** (#91) : Seed programme GitHub (`scripts/seed-github-workshop.ts`) — 1 Workshop, 4 semaines, 12 séances, 33 activités, 12 livrables, 12 quizzes (36 questions), 12/12 events liés. Idempotent.
- **C1** (#92) : Tests — 247 unit tests (validation 630l, progression 326l, quiz 275l), tous verts
- **C2** (#93) : Security audit — zéro protection contournée

### Fichiers clés
```
src/lib/workshop-validation.ts    — validation pure (616 lignes)
src/lib/workshop-progression.ts   — progression & unlock (158 lignes)
src/lib/workshop-quiz.ts          — scoring serveur (209 lignes)
src/lib/workshop-server.ts        — DB→pure glue (300 lignes)
src/app/api/admin/workshops/      — 5 routes admin (B7)
src/app/dashboard/ateliers/       — 3 pages + 3 composants (B8)
src/app/admin/ateliers/           — 3 pages admin (B9)
scripts/seed-github-workshop.ts   — seed programme (710 lignes)
```

### Convention de numbering interne
- L'utilisateur number les issues différemment du EPIC (#97)
- B5/B6 = ce que l'EPIC appelle B5/B6 (API membre)
- B7/B8/B9/B10 = ce que l'EPIC appelle B7/B8/B9/B10
- Les issues GitHub portent les numéros du EPIC (#80-#96)

---

## Issues restantes ouvertes

### Priorité P1 (à faire)

| Issue | Sujet | Description |
|---|---|---|
| **#76** [A0.4] | Réconcilier main ↔ development | `development` a 40 commits absents de `main` ; `main` a 29 commits absents de `development` (merge-base `92ea6f4` du 2026-09-10). Risque de conflits. **Tâches** : confirmer quelle branche déploie Vercel, inventorier les 29 commits `main`, merger `main` → `development`, résoudre conflits, vérifier `npm run validate`, documenter la politique de branches. **NE JAMAIS force-push ni reset.** |
| **#75** [A0.3] | ADR décisions structurantes Atelier | Documenter les choix d'architecture : Event ≠ Session, progression séquentielle, scoring serveur, quiz sans fuite, etc. |
| **#95** [C4] | Documentation architecture | Mettre à jour la doc UI, documenter l'architecture ateliers |
| **#96** [C5] | Gate final | `npm run validate` + tests + build + recette + rapport. Dernier ticket avant merge. |

### Priorité P2

| Issue | Sujet | Description |
|---|---|---|
| **#90** [B11] | Notifications transactionnelles | Emails pour enrollment, soumission, review, quiz |
| **#94** [C3] | Audit UX & cohérence design | Vérifier la cohérence avec le design system existant |
| **#79** [A3] | Test gate Event | Compléter les tests du module Events existant |

### Priorité P3 (hors atelier, existantes)

| Issue | Sujet |
|---|---|
| #27 | Splitter landing.tsx (950 lignes) |
| #26 | Splitter profiling-flow.tsx (867 lignes) |
| #28 | Remplacer img par next/image |
| #36 | Tests E2E Playwright |
| #37 | Tests composants React |
| #64 | RGPD export/suppression |
| #60 | Annuaire membres public |
| #59 | Système posts admin |
| #71 | Notes datées admin |
| #70 | Tagging libre membres |
| #72 | Export filtré avancé |
| #66 | Système de parrainage |
| #65 | PWA installable |
| #63 | Stripe intégration |
| #61 | Mentorat matching |
| #22 | Suivi activation premier challenge |
| #20 | Alertes admin |

---

## Prochaine session — ordre d'exécution recommandé

### Étape 1 : #76 — Réconcilier branches (P1, risqué)
1. Vérifier `git fetch origin` pour avoir les deux branches à jour
2. `git log --oneline main..development | wc -l` → 40 commits à merger
3. `git log --oneline development..main | wc -l` → 29 commits à absorber
4. Strategy : `git merge main` sur `development` (pas l'inverse)
5. Résoudre les conflits un par un
6. `npm run validate` après résolution
7. Documenter la politique de branches

### Étape 2 : #75 — ADR Atelier (P1, simple)
Créer `docs/adr/` si absent, écrire les ADR :
- Event ≠ Session (rendez-vous temporel vs unité pédagogique)
- Progression séquentielle (unlock par chaîne)
- Scoring serveur (jamais côté client)
- Quiz sans fuite (correctJson jamais exposé aux membres)

### Étape 3 : #95 — Documentation (P1, après ADR)
Mettre à jour la doc architecture avec les modules ateliers.

### Étape 4 : #90 — Notifications (P2, optionnel)
Implémenter les emails transactionnels (enrollment, soumission, review, quiz).

### Étape 5 : #94 — Audit UX (P2, optionnel)
Vérifier cohérence design system, responsive mobile, accessibilité.

### Étape 6 : #96 — Gate final (P1, dernier)
1. `npm run validate` (types + lint + prisma + tests)
2. `npm run build` (vérifier que tout compile)
3. Recette manuelle des flows
4. Rapport final

---

## Rappel des règles EURINHASH
- **Workers gratuits d'abord** : codestral → groq → novita → zhipu → google → pollinations → ollama
- **Jamais de modèle payant** sans accord explicite
- **Branche de travail** : `development` (jamais `main`)
- **Pas de force-push**, pas de reset
- **Chaque commit** : `npm run validate` avant
- **Email safeguard** : `blockIfTesting` actif sur les mutations

---

## Commandes utiles

```bash
# Vérifier l'état des branches
git fetch origin
git log --oneline main..development | wc -l
git log --oneline development..main | wc -l

# Vérifier que tout compile
npm run validate

# Lister les issues ouvertes atelier
gh issue list --state open --label atelier

# Fermer une issue
gh issue close <number> --comment "✅ ..."

# Seed (vérifier que le seed fonctionne)
node --env-file=.env --import tsx scripts/seed-github-workshop.ts --dry-run
node --env-file=.env --import tsx scripts/seed-github-workshop.ts
```
