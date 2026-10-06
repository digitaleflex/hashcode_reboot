# Règle d'exécution pas-à-pas — Roadmap sur-ingénierie

> Comment avancer dans `docs/ROADMAP-SUR-INGENIERIE-2026.md` sans se tromper.
> **Ne commencez aucune tâche avant d'avoir lu cette page.**

---

## 1. Préambule obligatoire

```bash
git switch development && git pull
git switch -c chore/audit-d01-disable-signup
npm ci
npm run validate        # typecheck + lint + check:test-wiring + test:unit — DOIT être verte
```

Si `npm run validate` est **rouge avant de commencer**, on ne commence pas.
On diagnostique d'abord : la dette qu'on cherche à réparer ne doit pas être
confondue avec une régression qu'on vient d'introduire.

---

## 2. Boucle de travail (une tâche = un commit)

```
1. npm run roadmap:next          →  identifie la tâche faisable
2. Lit la section Dxx de docs/ROADMAP-SUR-INGENIERIE-2026.md
3. Branche dédiée               →  chore/audit-dxx-<slug>
4. Implémente
5. npm run validate              →  typecheck + lint + check:test-wiring + tests
6. Le "Vérifier" de la section Dxx →  preuve que le bug est corrigé
7. git commit                    →  un seul commit, message conventionnel
8. npm run roadmap:done D01      →  marque la tâche
```

**Une tâche = un commit.** Si tu ne peux pas écrire un message de commit
conventionnel décrivant ce que fait la tâche, c'est que la tâche est trop
grosse → découpe-la.

### Pourquoi ce découpage

La phase 1 représente **~7 000 lignes supprimées**. En un seul commit, un
problème devient impossible à isoler. En 10 commits, `git bisect` trouve le
coupable en deux minutes.

---

## 3. Le tracker

```bash
npm run roadmap           # toutes les tâches + statut
npm run roadmap:next      # prochaine tâche faisable (dépendances résolues)
npm run roadmap:done D01  # marque D01 terminée
npm run roadmap:status    # progression par priorité
npm run roadmap:reset D01 # annule le marquage (tâche annulée / à revoir)
```

Les identifiants `D01`–`D38` sont définis dans `scripts/task-tracker.mjs`.
Le fichier de progression est `.task-progress.json`.

Le tracker respecte les dépendances : `next` ne propose que les tâches dont
toutes les dépendances sont `done`.

---

## 4. Règles par phase

| Phase | Règle |
|---|---|
| **0** (bugs) | Un bug par commit. Ne **jamais** regrouper avec une suppression. Chaque correctif doit pouvoir être reverté seul. |
| **1** (suppressions) | Risque nul, mais **un commit par tâche**. Après chaque suppression, `npm run validate`. Si une dépendance est encore utilisée, la retirer seulement au commit suivant. |
| **2** (tests) | **Le commit qui bascule sur `tsx` ne doit rien supprimer.** D'abord faire passer les tests existants contre le vrai code, puis supprimer les miroirs dans un second commit. |
| **3** (i18n/docs) | Purge par namespace, jamais à la main clé par clé. Relancer `node scripts/check-messages.mjs` après chaque lot. |
| **4** (serveur) | Le commit `requireAdmin()` change un **contrat HTTP** (401→403). Vérifier les 30 sites client qui testent `status === 401` dans le **même** commit, sinon le dashboard admin casse silencieusement. |
| **5** (admin) | Ne commence pas avant D18 (tests fiables) et D25 (helper). Extraire avant de migrer. |
| **6** (produit) | **Nécessite un arbitrage produit, pas technique.** Ne pas commencer sans validation explicite. |

## 4 bis. Ce qui a changé depuis la rédaction (2026-10-06)

Cette page a été écrite en septembre. Plusieurs de ses repères sont périmés. La
feuille de route a gagné 4 tâches (jusqu'à `D42`) et `npm run validate` a
évolué. **Vérifier avant d'appliquer littéralement** :

| Énoncé de cette page | État réel au 2026-10-06 |
|---|---|
| `npm run validate` = typecheck + lint + test:unit | **+ `check:test-wiring`** entre les deux |
| `npm run roadmap:done D01` | idem, toujours valide |
| Les « 30 détections client `status === 401` » (phase 4) | contrat refait par D24 : `requireAdmin` distingue 401 `AUTH_REQUIRED` / 403 `FORBIDDEN` |
| `admin-login.tsx` existe (401 l.) (§7.2) | **supprimé** par D33 |
| `pending-document.tsx` (§7.1) | **supprimé** par D21, pages légales branchées |
| §7.1 et §7.2 « à trancher » | **tranchés** |
| Le dépôt utilise `node --test` (implicite) | toujours vrai — et **pas** Vitest, contrairement à `CONTRIBUTING.md` d'origine |
| `src/middleware.ts` (implicite) | s'appelle **`src/proxy.ts`** (Next 16) |
| `bun.lock` périmé (D15) | toujours présent, et **divergent** de `package-lock.json` — la CI fait `npm ci`, donc npm est la seule référence |

### Deux interdits absolus

1. **D07 avant toute chose qui touche au schéma.** Les tables Better Auth n'ont
   aucune migration (D07). Supprimer un modèle avant (D36) casse la
   reproductibilité de la base.
2. **Ne pas mélanger une correction de bug et une suppression** dans le même
   commit. Si D01 et D09 atterrissent ensemble, on ne saura jamais lequel a
   cassé quoi.

---

## 5. Critères de « terminé »

Une tâche n'est `done` que si **toutes** ces conditions sont réunies :

- [ ] `npm run validate` passe (typecheck + lint + check:test-wiring + test:unit)
- [ ] Le critère **« Vérifier »** de la section Dxx est **prouvé** (pas supposé)
- [ ] `npm run build` passe si la tâche touche au routage, aux composants
      montés, ou à i18n
- [ ] Pas de `eslint-disable` ni de `@ts-ignore` ajoutés
- [ ] Pas de `any` ajouté
- [ ] La documentation touchée est mise à jour dans le **même** commit
      (ex. D02 touche `docs/audit-securite-2026-09-18.md:33-34`)
- [ ] Le commit est réversible seul

> `npm run validate` ne comprend pas le build. Une tâche qui casse le build
> peut laisser `validate` verte. C'est pourquoi le build est demandé
> explicitement pour les tâches à risque de rendu.

---

## 6. Ordre recommandé

```
PHASE 0   D01 → D02 → D03 → D04 → D05 → D06 → D07 → D08
          (sécurité d'abord : D01, D02 ; puis les données fausses : D03, D04)

PHASE 1   D09 → D10 → D11 → D12 → D13 → D14 → D15 → D16 → D17
          (les gains les plus gros d'abord, pour prendre le pouls)

PHASE 2   D18 → D19 → D20
          (⚠️ ne pas entamer la phase 4 ni 5 avant D18)

PHASE 3   D21 → D22 → D23

PHASE 4   D24 → D25 → D26 → D27 → D28

PHASE 5   D29 → D30 → D31 → D32

PHASE 6   D33 · D34 · D35 · D36 · D37 · D38   (arbitrage produit requis)
```

### Dépendances critiques

```
D09 ──▶ D10          les deps transitives meurent avec leurs wrappers
D14 ──▶ D18          supprimer D14 casse les miroirs de test
D18 ──▶ D19, D20     pas de refactor sans tests fiables
D21 ──▶ D22          ne pas purger legal.* avant d'avoir tranché
D07 ──▶ D36          migration de référence avant suppression de tables
D24 ──▶ D25, D26, D28  un vocabulaire d'erreur avant les refactors
D25 ──▶ D32          le helper avant la migration
```

---

## 7. Deux points à trancher avant de démarrer

Ce ne sont **pas** des décisions techniques. Les poser avant la phase 1
évite du travail à refaire.

### 7.1 `legal.*` — **tranché et fait (D21)**

Le point est clos : les 4 pages légales (`/cgu`, `/confidentialite`,
`/mentions-legales`, `/cookies`) sont **branchées** sur `legal.*`, avec
`generateMetadata`. `pending-document.tsx` n'existe plus — le rendu passe par
`src/components/reboot/legal/legal-document.tsx` et `src/lib/legal-content.ts`
(`LEGAL_DOCUMENTS`, `legalValueKey`, `resolveLegalNode`).

Le contenu est verrouillé par `tests/legal-content.test.cjs` : il échoue si une
clé disparaît, si une valeur `en` devient vide, ou si un placeholder ICU est
oublié. **Ne pas purger `legal.*`.**

*(Cette section ne demandait plus de décision avant D21 ; elle est conservée
pour la trace.)*

### 7.2 `?admin=1` — **tranché et fait (D33)**

`admin-login.tsx` (402 l.) et la phase `admin-login` ont été **supprimés**.
`?admin=1` est aujourd'hui un simple alias : `src/app/[locale]/page.tsx` met la
phase `admin`, puis un `useEffect` fait `window.location.assign("/admin")` — une
vraie route, gardée côté serveur par `admin/layout.tsx` (qui renvoie vers
`/login?next=%2Fadmin` si la session n'est pas admin).

*(Section conservée pour la trace : la recommandation de l'audit a été suivie.)*

---

## 8. Le filet de sécurité : le git

Tout le travail est réversible. Si une suppression casse quelque chose et que
le diagnostic prend plus de 15 minutes :

```bash
git log --oneline -10          # identifier le commit
git revert <sha>               # annuler proprement
```

Ne pas utiliser `git reset --hard` : on perdrait le diagnostic, qui est souvent
la partie la plus utile.

Pour les suppressions de masse (D09, D10, D22), la stratégie la plus sûre est :

```bash
# tout garder, mais inerte : commentaire l'export dans le barrel
# puis vérifier que build + validate + e2e passent
# puis supprimer dans un second commit
```

Cela donne deux points de restauration au lieu d'un.
