# Inventaire des données d'acquisition — v1 (2026-10-15, #153)

> Source de vérité versionnée exigée par #153. Toute modification du schéma ou
> de la politique de rétention (`src/lib/retention.ts`) impose une v2.
> Convention colonnes : **Finalité** (pourquoi), **Nécessité** (obligatoire/
> conditionnel), **Source** (qui fournit), **Rétention** (combien de temps),
> **Accès** (qui lit), **Transmission** (vers JoinHashCode ?), **Droits**
> (export/suppression via `/api/account`).

## Règles transverses
- **Handoff minimal** : seul le payload versionné `HANDOFF_CONTRACT_VERSION`
  (`src/lib/handoff.ts`, mapping champ par champ en en-tête) traverse vers
  JoinHashCode, avec `memberRef` opaque (jamais email/tél/nom) et consentement
  `handoff=granted` exigé. Après conversion, Reboot ne devient pas propriétaire :
  soft-delete + blacklist anti-relance + révocation sessions sur demande.
- **Audit sans PII** : `audit()` → ids + statuts uniquement. Exception justifiée :
  `blacklist.remove` journalise l'email (l'email EST l'entité administrée, log
  réservé aux opérateurs). Reçu `community-join` : `granted`/`missing-or-withdrawn`.
- **Export membre** (`GET /api/account/export`) : allowlist explicite + expurge
  défensive (`adminNote`, `adminRole` jamais exportés) ; notes admin SANS auteur.
- **Jamais purgés par cron** : `AuditLog` (preuve), `Consent`/`Qualification`
  (preuves + historique append-only), `Member` (droits via routes), `RateLimit`
  (compteurs vivants), tables d'auth Better Auth.
- **Consentements** : enum fermée (`purpose`, `choice`), `textVersion` obligatoire,
  GET dernière-ligne-par-(email,purpose), email optionnel (`anonymous`).

## Member (profil d'acquisition)
| Champ(s) | Finalité | Nécessité | Source | Rétention | Accès | Transmission | Droits |
|---|---|---|---|---|---|---|---|
| id, createdAt, updatedAt | clé + traçabilité | système | système | vie du compte | membre/admin | memberRef opaque uniquement | export oui / suppression soft |
| firstName, lastName?, email (unique), phone?, country, city?, gender? | identité + contact + segmentation pays | firstName/email/country obligatoires, reste optionnel | formulaire | vie du compte | membre/admin | NON (jamais en clair) | export oui / soft-delete + blacklist |
| primaryDomain, secondaryDomains, domainSpecialty, level | orientation | obligatoires | diagnostic | vie du compte | membre/admin | NON | export oui |
| goal, goalProjectStage?, goalSituation? | qualification besoin | goal obligatoire | diagnostic | vie du compte | membre/admin | NON | export oui |
| availability, availabilityTimes? | planification ateliers | availability obligatoire | diagnostic | vie du compte | membre/admin | NON | export oui |
| learningStyle | recommandation format | obligatoire | diagnostic | vie du compte | membre/admin | NON | export oui |
| mentoring* (5 champs) | éligibilité mentorat | conditionnels | diagnostic | vie du compte | membre/admin | NON | export oui |
| budgetWillingness?, budgetRange? | capacité d'investissement | conditionnels | diagnostic | vie du compte | membre/admin | NON | export oui |
| threeMonthGoal? | personnalisation | optionnel | diagnostic | vie du compte | membre/admin | NON | export oui |
| profileArchetype?, tags, customTags | profil calculé + tags admin | calculé/admin | moteur/admin | vie du compte | membre/admin | NON | export oui |
| source? | attribution campagne | optionnel | UTM | vie du compte | admin | NON | export oui |
| profileStatus, communityStatus, accessLane | pipeline | système | système | vie du compte | membre/admin | statut seul (pas de PII) | export oui |
| adminNote, adminRole | gestion interne | admin | admin | vie du compte | **opérateurs seuls** | NON | **JAMAIS exportés** |
| userEmail | lien auth | système | Better Auth | vie du compte | système | NON | export oui |
| invitation* (7 champs) | suivi invitations | système | système/emails | vie du compte | admin | NON | export oui |
| sessions/rsvps/emailLogs/notes/relations | historique | système | usage | vie du compte (notes : auteur exclu de l'export) | membre(sauf notes auteur)/admin | NON | export oui (notes sans auteur) |

## Tables d'acquisition
| Table | Finalité | Rétention | Accès | Transmission | Droits |
|---|---|---|---|---|---|
| ProfilingDraft (answers JSON, sessionId, sourceUTM) | reprise + relance J+7 | converti 30 j / abandonné-relancé 90 j (**purge cron**) | membre (reprise) / système (relance) | NON | suppression auto (purge) |
| Consent (append-only, versionné) | preuve des choix | **illimitée** (preuve) | membre (GET) / système (handoff gate) | choix handoff seul (granted) | export historique complet |
| Qualification (append-only, engineVersion) | traçabilité recalculs | **illimitée** | membre / admin | archétype via payload versionné | export oui |
| AnalyticsEvent (sessionId, memberId?) | funnel + heartbeats crons | 13 mois (**purge cron**) | admin agrégats | NON (agrégats seuls) | plafond export 500 |
| MemberSession (+ Better Auth) | sessions/OTP | expiration / révocation à la suppression | membre/système | NON | révocation + export métadonnées (sans secret) |
| EventRsvp, WorkshopEnrollment/Submission/Attempt | participation | vie du compte | membre/admin | NON | export oui |
| MemberEmailLog, EmailProviderMetric | preuve d'envoi + santé | 13 mois (**purge cron**) | admin | NON | export logs unitaires |
| MemberNote (author exclu export) | suivi admin | vie du compte | opérateurs | NON | export contenu+date |
| MemberBlacklist | anti-relance/anti-abus | **illimitée** (protection) | opérateurs | NON | non exportée (décision : liste de protection, pas donnée du membre) |
| AuditLog (metadata = ids/statuts) | traçabilité | **illimitée** | opérateurs | NON | non exposée au membre |
| Verification, RateLimit | auth/technique | expiration naturelle | système | NON | n/a |

## Matrice transmission (résumé)
Seul le **payload handoff versionné** quitte Reboot (consentement `handoff`
requis, idempotent, reçu sans PII). Tout le reste : lecture admin interne ou
export à la demande du membre. Aucun contenu pédagogique stocké dans Reboot
(les ateliers référencent, ne recopient pas).
