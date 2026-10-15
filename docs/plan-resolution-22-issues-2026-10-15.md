# Plan de résolution — 22 issues ouvertes (2026-10-15)

> État de départ : 37 issues ouvertes. 13 issues UX V2 (#127–#140) sont **livrées
> et en ligne** → à clôturer (Phase 0). 2 issues admin (#217, #219) ont des PR
> en cours (#218, #225). Restent **22 issues** traitées ici.

## Règles de travail (inchangées)
- 1 branche + 1 PR par lot (les S groupées, les XL découpées) ; empilées si dépendance.
- Merge vers `main` uniquement sur « oui » explicite ; déploiement prod aux jalons de phase.
- Chaque lot : build + typecheck + lint + tests ciblés exécutés, preuves dans la PR.
- Migrations Prisma : testées en montant/descendant sur base éphémère avant merge.

## Graphe de dépendances
```
#232 (missions, XL) ─┬─→ #233 (participation) ──→ #113 (E2E funnel)
                     ├─→ #222 (admin ateliers/missions, XL)
                     └─→ #235 (compteurs) [idéalement, sinon v1 ateliers seuls]
#153 (gouvernance, L) ──→ #145 (confiance, M)
#104 (segments) ──→ #101 (export filtré)
#103 (doublons) ──→ #104/#105 (qualité des segments et métriques)
#156 (dictionnaire funnel) ──→ dashboard funnel (couvert par PR #218)
Tout ──→ #112/#113 (tests) ──→ #159 (QA finale go/no-go)
```

## Phase 0 — Clôture et socle admin (0,5 j)
| # | Action |
|---|---|
| #127–#140 (13) | Fermer avec commentaire de clôture + liens preuves (rapport QA, captures, URL prod) |
| #218 → #217 | Reviewer/merger PR dashboard admin |
| #225 → #219 | Reviewer/merger PR gestion membres |
| Porte de sortie | `main` verte, admin baseline stabilisée (évite les conflits des phases 3–4) |

## Phase 1 — Socle sécurité / confiance / missions (P1, ~7 j)
| # | Taille | Contenu | PR |
|---|---|---|---|
| #118 | S | Durcissement anti-abus : rate-limit exhaustif endpoints publics + tests | 1 PR |
| #153 | L | Gouvernance données : inventaire versionné champ→finalité/rétention/destination, matrice handoff | 1–2 PR |
| #232 | XL | **Modèle Mission/Challenge persisté** : Prisma + migration, états (à venir/en cours/soumise/validée/rejetée), validation serveur idempotente, progression requêtable. Découpé : (a) modèles+migration, (b) moteur progression, (c) CRUD admin + parcours membre | 3 PR empilées |
| Porte de sortie | Tests intégration verts, migration aller/retour OK sur éphémère |

## Phase 2 — Participation + perf (p2, ~4 j)
| # | Taille | Dépendance | Contenu |
|---|---|---|---|
| #233 | L | #232 | Démarrer/abandonner challenge, inscription atelier : idempotence (contrainte unique), 401/403/429, audit, zéro PII publique |
| #237 | L | — (parallélisable) | Perf-4/5 : agrégations SQL au lieu de filtres JS (5 000 events), cache ateliers |
| Porte de sortie | Idempotence prouvée par tests, payload dashboard réduit et mesuré |

## Phase 3 — Admin opérations (p2–p3, ~8 j)
| # | Taille | Dépendance | Contenu |
|---|---|---|---|
| #222 | XL | #232 | Admin ateliers/programmes/missions unifié : inventaire existant d'abord, réutilisation auth/validation/composants. Découpé : (a) listes+statuts, (b) création/édition, (c) inscriptions/notifications |
| #220 | L | — | Audit-log exploitable : acteur/action/cible/résultat, dates FR, filtres alignés API |
| #223 | M | — | Campagnes/invitations : états brouillon→envoyé/échec, volume estimé, anti-double-clic |
| #224 | M | — | Paramètres/blacklist : contrôles serveur, confirmations destructives, traçabilité |
| #221 | M | — | Exports : périmètre explicite (page vs tous filtrés), colonnes, volumétrie |
| Porte de sortie | Parcours admin rejoués manuellement + E2E admin verts |

## Phase 4 — Leads data (p2–p3, ~6 j)
| # | Taille | Dépendance | Contenu |
|---|---|---|---|
| #103 | L | — | Doublons : normalisation email/tél, contrainte unique (**migration**), fusion idempotente + contrôle humain |
| #104 | L | #103 conseillée | Modèle `Segment` persisté (**migration**), filtres whitelistés, CRUD admin |
| #105 | M | — | Qualité leads : complétude, consentement, coordonnées, cohérence, conversion (jamais psychométrique) |
| #101 | M | #104 | Export CSV/JSON filtré, contrôlé, audité (opérateurs autorisés) |
| Porte de sortie | Export rejoué = filtres actifs, fusion sans perte prouvée par tests |

## Phase 5 — Public P3 + confiance/analytics (p2–p3, ~4 j)
| # | Taille | Dépendance | Contenu |
|---|---|---|---|
| #236 | S | — | Pagination curseur stable `/api/public/events` (≤50, rétrocompatible) |
| #235 | S | #232 idéale | Compteurs par activité, zéro PII, TTL court, rate-limit |
| #234 | M | — | Roadmap pilotée données (table ou fichier versionné — moins coûteux), fallback landing |
| #145 | M | #153 | Cadrage confiance avant capture (textes finalités, pas de dark pattern) |
| #156 | M | — | Dictionnaire funnel versionné (client/serveur/dashboard alignés) |
| Porte de sortie | Landing consomme les endpoints (fallbacks testés), docs frontières à jour |

## Phase 6 — Validation finale (~3 j)
| # | Contenu |
|---|---|
| #112 | Tests composants funnel (interactions, erreurs, consentement, reprise, a11y) |
| #113 | E2E Playwright : visiteur→diagnostic→lead→qualification→conversion→handoff (+ erreurs, retry, double soumission ; handoff mocké en CI) |
| #159 | QA produit bout en bout : chaque exigence → preuve (test/capture/log/métrique). **Go/no-go** |
| Porte de sortie | CI verte complète, rapport QA daté, déploiement prod du périmètre |

## Estimation totale indicative
~32 j-homme (≈ 6–7 semaines à 1 dev) : P0 0,5 · P1 7 · P2 4 · P3 8 · P4 6 · P5 4 · P6 3.
Parallélisable sur 2 axes indépendants : **backend data** (P1→P2→P4-partiel→P5) et **admin UI** (P3), avec jalons de merge communs.

## Risques
- #232 mal cadrée bloque #233/#222/#235 → la découper en 3 PR et merger (a) tôt.
- Migrations (#232/#103/#104) : tester le rollback, coordonner avec `deploy.sh prod` (migrate avant web — déjà en place).
- #222 : risque de « deuxième système métier » — inventaire imposé avant tout code.
- Secrets Turnstile/Sentry absents de `.env.prod` : à trancher avant la Phase 6 (comportement inscription).
