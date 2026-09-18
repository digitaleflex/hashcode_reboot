# ADR-001 — Décisions structurantes du chantier Ateliers

> **Date** : 2026-09-18 · **Statut** : D1/D2/D4 **validés** · D3 **en attente**
> **Décideur** : utilisateur (conversation, « oui » du 2026-09-18)
> **Références** : `docs/ateliers/00-audit-phase1.md` §21-22 · issues #75 (cette ADR), #80 (schéma)

---

## D1 — Progression dérivée côté serveur, pas de table de progression — ✅ VALIDÉ

**Décision** : la progression et le déblocage sont **dérivés** côté serveur par une
fonction pure à partir de `WorkshopEnrollment` + `WorkshopSubmission` +
`WorkshopReview` + `WorkshopQuizAttempt`. **Aucune table `WorkshopProgress` en v1.**

**Pourquoi** :
- Toute donnée dénormalisée dérive tôt ou tard (ex : review rendue après
  resoumission, quiz repassé) — une table de progression devrait être
  resynchronisée à chaque transition, avec chacun des bugs de drift associés.
- Tout l'état est déjà reconstructible depuis les tables source : la fonction
  pure est le « minimum nécessaire » exigé par le protocole (§19).
- La fonction pure est testable en miroir CJS (pattern maison des tests).

**Alternatives écartées** :
- Table `WorkshopProgress` (statut par (member, session)) : dérive garantie,
  doubles écritures à maintenir.
- Progression calculée côté client : interdit (le client ne doit jamais
  déterminer un état officiel).

**Conséquences** : recalcul à chaque lecture de parcours (volume faible :
~12 séances × N membres) ; un cache ou une table matérialisée pourra être
ajouté plus tard si une mesure de perf le justifie.

## D2 — Périmètre admin v1 : review + pilotage, structure par seed — ✅ VALIDÉ

**Décision** : l'admin v1 couvre la **file de review des soumissions**
(consulter participant/séance/preuve/historique, approuver / demander
correction / rejeter, feedback) et le **pilotage des ateliers** (publier /
archiver). La structure pédagogique (semaines, séances, activités,
livrables, quiz) est créée et modifiée via le **seed idempotent**.
Le CMS d'édition complet de structure = *remaining work* après le MVP.

**Pourquoi** : le DoD du MVP (12 séances configurées, review fonctionnelle,
quiz, validation, unlock) est entièrement couvert par ce périmètre ;
l'éditeur de structure est une couche UI purement additive une fois les
modèles et le seed en place — pas un prérequis.

**Conséquences** : aucune route admin de CRUD de structure en v1 ;
le seed est la source de vérité d'amorçage (protocole §24 : mécanisme
reproductible, idempotent, documenté).

## D3 — Branche de production Vercel — ⏳ EN ATTENTE

**Question** : quelle branche déploie Vercel en production — `main` ou
`development` ? Le dépôt ne le documente pas ; le protocole demande de
ne pas modifier si la branche effective diffère, et l'audit a relevé la
divergence `main` ↔ `development` (40 vs 29 commits, merge-base 92ea6f4).

**Hypothèse de travail** (à confirmer) : `main` = prod, `development` = travail.

**Conséquence** : la réconciliation (#76) est reportée tant que la réponse
n'est pas actée ET que le travail parallèle d'un autre agent est actif
(un merge touche tout l'arbre).

## D4 — Ordre de commit du WIP de session — ✅ VALIDÉ (exécuté)

Email provider (`1b4d207`, déjà commité entre-temps) → sonde de session
membre (`c033322`) → profilage sans phone (`b22962b`) → rapport d'audit
(`3a1187f`) → durcissements Event (`fbae077`, `d2b3b43`). Gate `validate`
vert à chaque étape. Terminé, issue #74 close.

---

## Mode de travail — coexistence multi-agents (contexte opérationnel)

Un autre agent travaille **en parallèle sur le même checkout**
(lane email/quota : `mail.ts`, `email-budget.ts`, `import-invite`,
routes de notification). Règles de coexistence appliquées :

- Staging **par chemins explicites uniquement** — jamais `git add .`/`-A` ;
- Jamais de `stash` / `reset` / `checkout` susceptibles d'écraser le WIP d'autrui ;
- Les fichiers modifiés par l'autre agent sont **intouchables** jusqu'à son commit
  (#77 a été déplacé après #78 pour cette raison) ;
- Merge de branche globale (#76) reporté pendant le travail parallèle ;
- Chaque commit documente explicitement son périmètre et son exclusivité.
