# PHASE 0 — RESOLUTION REPORT

Phase 0 (gouvernance + arbitrage + préparation), sans code fonctionnel.
Dépôt `digitaleflex/hashcode_reboot`, baseline `main`. Lanes : état des lieux
C1 (7 modèles + 9 ambiguïtés, faits vérifiés chemins:lignes) et découpage #204
(9 morceaux) + vérification #205 (5/5 fichiers déjà dans main). PR #205 fermée
sans perte pendant la phase. Deux docs de gouvernance créés et poussés :
`docs/architecture/reboot-joinhashcode-boundary.md` (commit boundary C1) et
`docs/roadmap/reboot-execution-order-v2.md` (ordre canonique + ownership).

## 1. Baseline

- Commit main : `02bc0e4` (= origin/main, 0 en attente). État Git : propre
  (`backups/` seul, jamais suivi).
- Development : divergente, **gelée** (aucune fusion, aucun reset, aucune
  réactivation ; réintroduction uniquement explicite et isolée).
- Décision de freeze : prise et documentée (C2 RESOLVED).

## 2. C1 — Acquisition / Profiling Boundary

| Concept | Main actuel | Décision | Justification |
|---|---|---|---|
| Lead | absent (vocabulaire + `Member`) | **REUSE** `Member` (Lead = vue : non converti) | `Member` porte déjà identité, statuts, timestamps ; table = doublon total |
| AcquisitionSession | absente (`sessionId` épars) | **REUSE** `ProfilingDraft.sessionId` + `AnalyticsEvent.sessionId` | session navigateur éphémère, pas d'entité |
| LeadSource | absente (`Member.source` + `normalizeSource`) | **REUSE** `Member.source` | la migration elle-même l'écarte ; champ libre indexé suffit |
| Qualification | existe (`schema.prisma:424-441`, append-only) | **KEEP AS-IS**, snapshot figé jamais recalculé | copie d'entrée assumée + `engineVersion` = traçabilité, pas duplication |
| Consent | existe (`:399+`, pré-inscription capable) | **REUSE** tel quel | purposes/choices/append-only couvrent le besoin, périmètre RGPD étanche |
| Conversion | absente (transactions invite + join) | **REUSE** statuts + timestamps + events | table dupliquerait `communityStatus/JOINED` + `joinedAt` |
| AcquisitionEvent | absent | **REUSE** `AnalyticsEvent` (+ étendre l'allowlist, standardiser écritures serveur) | générique `type/sessionId/memberId/ref/value` suffisant ; attribution par jointure |

Preuves : `schema.prisma:22-137` (Member), `:257-275` (AnalyticsEvent),
`:357-383` (ProfilingDraft), `:399-441` (Consent, Qualification) ;
`src/lib/acquisition.ts:11-28`, `qualification.ts:9-15`, `consents.ts:13-48` ;
`invite/route.ts:54-80`, `community/join:35-51`. Quatre scores distincts actés
(Qualification ≠ Profil ≠ Orientation ≠ Confidence). Alignement des deux
nomenclatures d'archétypes : DEFERRED, lecture seule côté acquisition.

## 3. Modèles

| Model | Existing | Reuse/Create | Responsibility |
|---|---|---|---|
| Lead | Non (vue) | REUSE Member | prospect pré-conversion |
| AcquisitionSession | Non (clés éparses) | REUSE sessionIds existants | trajectoire visite→conversion |
| LeadSource | Non | REUSE Member.source | origine normalisée |
| Qualification | Oui | KEEP (figé) | snapshot d'entrée versionné |
| Consent | Oui | REUSE | RGPD pré-inscription incluse |
| Conversion | Non (transactions) | REUSE statuts+events | contrat handoff uniquement |
| AcquisitionEvent | Non | REUSE AnalyticsEvent | événements typés via allowlist |

## 4. PR #205

État : **CLOSED** (fermée pendant cette Phase 0). Décision : CLOSE SANS PERTE.
Justification : 5/5 fichiers déjà dans main à l'identique ou en superset
(seuil NBA 0.9, `catalogue.ts`, tests 10 vs 8, CI +2 lignes).

## 5. PR #204

Toujours OPEN (extraction interdite avant C1 — C1 résolu, planifiable) :

| Morceau | Verdict | Justification |
|---|---|---|
| `docs/profiling-model.md` | EXTRACT (adapté) | doc pure ; § HISTORIQUE à réécrire (Snapshot écarté) |
| `resolve.ts` | EXTRACT | pur, sans I/O ; chaînon niveau effectif manquant |
| tests finalization | EXTRACT (adaptés resolve seul) | indissociables de resolve |
| script package.json | EXTRACT (couplé) | 1 ligne, même pattern |
| schema whitespace | DISCARD | 95 % reformatage |
| modèle ProfileSnapshot | DISCARD | doublon conscient avec Qualification (C1) |
| migration 20261008000000 | DISCARD (jamais rejouer) | antérieure au tip + sans rollback |
| `snapshots.ts`/`recordSnapshot` | DISCARD | exige la table écartée |
| route resolve + OrientationSection | EXTRACT | lecture seule, gain niveau effectif |
| hunk signup | DISCARD | SUPERSEDED par Qualification (vérifié) |

## 6. Governance Documents

| Fichier | Statut | Contenu | Commit |
|---|---|---|---|
| `docs/architecture/reboot-joinhashcode-boundary.md` | créé (5,3 Ko) | 10 sections + log C1 | `02bc0e4` |
| `docs/roadmap/reboot-execution-order-v2.md` | créé (5,4 Ko) | 9 sections + ordre + ownership | `02bc0e4` |

## 7. Roadmap

Phase 0 (faite) → **#210 + #127 (parallèle, 2 agents max, fichiers
disjoints)** → extraction #204 → #211 → #212 → #213 → #214 → #215.
Parallélisation autorisée : A/B Phase 1 uniquement, review croisée sur
`messages/fr.json`, zones `reboot/profiling/*`, `admin/**`,
`lib/orientation/*` gelées (STOP si touchées).

## 8. Readiness

- #210 : **READY** (périmètre borné : contrats/tests/zéro nouvelle table sans
  preuve ; contradiction scoring levée par le snapshot figé).
- #127 : **READY** (bornée : pas de `fr.json` en parallèle du checkpoint A1 ;
  étape i18n dédiée si besoin).

## 9. Risks (ouverts)

1. Alignement nomenclatures archétypes reporté (lecture seule en attendant).
2. Attribution par jointure (pas de `sourceUTM` sur l'événement) — réévaluer
   sur preuve.
3. Extraction #204 : adapter doc + tests au périmètre EXTRACT (pas de reprise
   brute).
4. `messages/fr.json` : seul fichier partagé A/B — discipline d'ajout en fin
   de fichier.

## 10. Next Action

**NEXT ACTION : valider cet arbitrage C1 (un « go » suffit) — lancer Phase 1 :
Agent A #210 phase 2 bornée + Agent B #127 bornée, review croisée au premier
checkpoint.**

Checklist Phase 0 : 21/21 (C1 écrit, 7 clarifications, baseline + freeze,
#205 fermée, #204 découpée + planifiée, roadmap canonicalisée, 2 docs créés,
#210/#127 READY justifiées, ownership + zones gelées définies, 0 changement
fonctionnel).
