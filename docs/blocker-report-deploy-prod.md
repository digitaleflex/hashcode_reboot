# BLOCKER REPORT — Demande de déploiement prod

**Date :** 2026-10-10
**Fait constaté :** demande d'exécution `./scripts/deploy.sh prod`
**Agent :** vérification autonome (master prompt §17)

---

## 1. Fait constaté

L'utilisateur demande le lancement du script de déploiement `scripts/deploy.sh` sur l'environnement `prod`. Le script (lignes 254-284 `do_deploy_prod`) exécute : sauvegarde base (`do_backup`), build image (`build_image`), migrations (`run_migrations`), redémarrage stack (`dc prod up -d`), smoke-test HTTP interne (`/api/health`) et externe (`PUBLIC_URL` / `PUBLIC_HOST`).

---

## 2. Fichiers et lignes concernés

- `scripts/deploy.sh` : lignes 254-284 (`do_deploy_prod`)
- `scripts/deploy.sh` : lignes 114-127 (`do_backup` — base prod)
- `scripts/deploy.sh` : lignes 181-225 (`run_migrations` — migration `20261008120000` + sonde `SELECT 1`)
- `.env.prod` : présent (variables de production, y compris secrets)
- `compose.yml` : présent (stack production)
- `prisma/migrations/20261008120000_qualification_acquisition_fields/` : migration additive déjà appliquée sur origin/main

---

## 3. Preuves (état vérifié dans la session)

| Élément | Preuve | Valeur |
|---|---|---|
| Branche | `git log --oneline -1` | `97e055e` (audit final) |
| Divergence origin | `git diff --stat origin/main..HEAD` | 125 files, 8811 insertions — 20 commits d'avance |
| .env.prod | `ls .env.prod` | Présent |
| compose.yml | `ls compose.yml` | Présent |
| Verdict #215 | `docs/final-release-review.md` | `PARTIAL` (typecheck / lint / build non prouvés) |
| Migration | `ls prisma/migrations/20261008120000_...` | Présente, additive, déjà appliquée |
| #204 | `find src/ -name "resolve.ts"` | `src/lib/orientation/resolve.ts` présent (PASS) ; exclusions absentes |
| Tests | `node --test` | qualification PASS 25/25, acquisition PASS |

---

## 4. Risque

- **Modification directe de production** interdite par le périmètre (§3, §10) sans justification documentée.
- **Migration déjà appliquée** : le script `run_migrations` applique systématiquement `migrate`. Même additive, le rejouer sur prod n'est pas nécessaire et expose au risque d'échec si le schéma est déjà migre.
- **Build non prouvé** : `docs/final-release-review.md` indique `BLOCKED` pour `typecheck`, `lint`, `build` (timeout environnemental). Lancer `build_image prod` avec un commit non compilé vérifié est risqué.
- **Variables sensibles** : `.env.prod` contient `NEXT_PUBLIC_*`, `POSTGRES_*`, `SENTRY_DSN` ; `build_image` exporte ces variables dans le shell du build (`export` ligne 159).
- **Smoke-test publique** : `smoke_test_prod` contacte `https://${host}/` via Cloudflare et `PUBLIC_URL` — expose la production au test external.
- **Aucune preuve de rollback préparé** : `hashcode-reboot:previous` n'existe pas nécessairement si le build échoue ; le rollback (lignes 358-376) ne restaure pas la base.

---

## 5. Options possibles

- **A (Recommandé)** : Refuser `prod`. Exiger `npm run validate` (typecheck + lint + test:unit) puis `npm run build` sur le commit `97e055e` dans un environnement non limité. Une fois `PASS`, réévaluer `prod` avec un BLOCKER REPORT signé.
- **B** : Exécuter uniquement `./scripts/deploy.sh dev` (bac à sable, `.env.dev`, `compose.dev.yml`, base suffixée `_dev`, pas de risque prod).
- **C** : Si `prod` est absolument nécessaire, le faire avec justification explicite, après confirmation du `typecheck`, et avec surveillance des logs (`scripts/deploy.sh logs`).

---

## 6. Recommandation

**Option A.** Ne pas exécuter `./scripts/deploy.sh prod`. Le verdict du dépôt est `PARTIAL` (`docs/final-release-review.md`), et le master prompt (§17) exige d'arrêter si une modification de production est nécessaire pour tester. Les preuves de `build` et `typecheck` manquent encore.

---

## 7. Travaux indépendants qui peuvent continuer sans risque

- `#204` inspection terminée (`resolve.ts` PASS, exclusions absentes) — documenter dans `docs/checkpoint-phase-a-b-c-d-e-f.md`.
- `#215` proof of build — relancer `npm run validate` en environnement complet.
- PR `#216` — fermer après confirmation de `00-master-autonomous-orchestrator.md`.
- `prisma/schema.prisma` — correction commentaire déjà faite (`efb4ab8`).

---

*BLOCKER REPORT produit conformément au master prompt (§17) — pas d'exécution `prod` sans justification explicite et preuves de build.*
