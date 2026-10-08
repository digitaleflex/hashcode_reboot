# Audit forensique — PR #204 / PR #205 (digitaleflex/hashcode_reboot)

Date : 2026-10-08. Périmètre : lecture seule (aucune modification de code, issue, PR ou branche).
Baseline : `main @ 70ca361` (= origin/main, arbre propre). Les deux PR sont OPEN et CONFLICTING.
Preuves sur disque : `/tmp/opencode/audit/` (`pr204.diff`, `pr205.diff`, `dev-only.patch` 731 lignes,
`hardening-branch.diff` 218 lignes, `dev-profiling-model.md`).

Rapports précédents : `audit-reboot.md` (V1, commit 2951bc7), `audit-reboot-v2.md`
(V2 decision readiness, 28 sections, commit 70ca361). Score global : 58/100, NOT READY.

## Méthode

Deux lanes forensiques parallèles (exp-13 sur #204, exp-12 sur #205), chacune avec dump
complet du diff et comparaison byte à byte contre le disque et contre `development`.
Vérifié : `pr204.diff` = `dev-only.patch` (731 lignes IDENTIQUES) ; `pr205.diff` =
`hardening-branch.diff` (218 lignes byte-identiques). La branche
`feat/phase6-orientation-hardening` est un doublon exact sans PR.

## PR #204 — VERDICT : EXTRACT THEN CLOSE

Ni MERGE (conflits + fourche + bruit), ni CLOSE pur (contenu utile réel).
Source : 1 commit `41bd11a`, +514/-39, 11 fichiers.

### Ordre d'extraction recommandé

1. `docs/profiling-model.md` (+ mention du modèle Qualification).
2. `resolve.ts` — seul vrai changement comportemental (fix de « effet nul sur recos »).
3. Tests + script associé.
4. Modèle Prisma SANS le whitespace + migration REWRITE renumérotée (bloqué derrière C1).
5. `snapshots.ts` (indissociable de la migration).
6. Hunk orientation-route + mise à jour du commentaire « lecture seule ».
7. `OrientationSection` + câblage (nouvelle issue dédiée si le dashboard est contesté).

### Exclusions

- Hunk signup `members/route` : SUPERSEDE par le modèle Qualification (ne pas extraire).
- Whitespace `schema.prisma` : REMOVE (bruit de formatage).

### Note migration

Additive, FK saine, table vide — mais antérieure au tip : renuméroter le timestamp,
fournir rollback/DROP, typer en JSONB. Ne jamais rejouer telle quelle sur le tip.

## PR #205 — VERDICT : CLOSE, rien à extraire

Source : 7 commits, +154/-8, checks SUCCESS — mais contenu sans valeur :

- Seuil NBA 0.9 : verbatim déjà présent dans main.
- Destination canonique supérieure : `catalogue.ts` (phase 8). Merger régresserait.
- Tests : superset déjà présent sur disque.
- Hunk CI obsolète (`ci.yml:29` + `:30/:31`).

Branches `fix/phase6-review-findings` et `feat/phase6-orientation-hardening`
(doublon exact sans PR) : REMOVE (SUPERSEDED).

## Impact sur le graphe de décision

Les deux PR ne bloquent AUCUNE de #210 / #153 / #158 / #211 / #212 / #127.
Phase 0 : YES (peut avancer). Codage #210 + #127 : YES, à périmètre fermé.

## Séquencement recommandé

1. Preuve : test hardening vert.
2. CLOSE #205, puis supprimer les deux branches.
3. Trancher C1 (acquérir le socle orientation vs le démanteler), puis extraction #204.
4. Geler `development` (baseline = main, décision C2 en attente).

## Décisions en attente (rappel V2)

C1 (socle orientation), C2 (baseline main + gel development), C3 (#204 EXTRACT vs CLOSE pur),
table des milestones (M0-M6 / M01-M09 / Operating-Model sans correspondance),
gouvernance minimale. Registre complet des contraintes : voir `audit-reboot-v2.md` (C1-C9).
