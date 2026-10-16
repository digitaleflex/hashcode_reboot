# Dictionnaire analytics v1 (2026-10-16, #156)

> Catalogue versionné exigé par #156. Toute nouvelle valeur `type` s'ajoute
> ici ET dans `EVENT_TYPES` (`src/lib/analytics.ts`) en même temps — un test
> (`analytics-dictionary`) verrouille la cohérence émetteurs/dashboard.

## Convention d'identifiants
- `sessionId` : id navigateur anonyme (≤64, jamais d'email/espaces — rejeté sinon).
- `memberId` : honoré **uniquement** s'il égale la session en cours (anti-empoisonnement).
- `ref` : slug/id (<80, jamais d'email/espaces — rejeté sinon). Jamais de PII.
- `value` : entier (durée ms, compteur). Jamais de PII.
- `path` : accepté mais **non persisté**.
- Idempotence : doublon byte-identique < 30 s absorbé (`ANALYTICS_DEDUP_WINDOW_MS`).

## Funnel public (client → POST /api/analytics → dashboard)
| type | émis quand / par | ids | props | PII |
|---|---|---|---|---|
| reboot_page_view | vue page / landing+profiling | sessionId | ref=contexte | non |
| reboot_cta_clicked | clic CTA (ref=bouton) | sessionId | ref | non |
| profiling_started | entrée diagnostic | sessionId | — | non |
| profiling_question_answered | réponse (ref=q.id) | sessionId | ref | non |
| profiling_question_timed | durée (ref=q.id) | sessionId | ref, value=ms | non |
| profiling_back | retour arrière | sessionId | — | non |
| profiling_resumed | reprise brouillon | sessionId | — | non |
| profiling_completed | diagnostic terminé | sessionId(+memberId si connecté) | — | non |
| profiling_abandoned | abandon (ref=q.id) | sessionId | ref | non |
| orientation_evaluated | moteur orientation | sessionId/memberId | — | non |
| next_best_action_clicked | clic NBA | sessionId/memberId | ref | non |
| recommendation_viewed/expanded | reco (ref=id) | sessionId/memberId | ref | non |
| primary/secondary_recommendation_clicked | clic reco | sessionId/memberId | ref | non |
| discovery_to_action | catalogue→action | sessionId/memberId | ref | non |
| profile_completion_cta_clicked | CTA complétion | sessionId/memberId | ref | non |
| email_verified | email vérifié | memberId | — | non |
| profil_generated | profil généré (serveur) | memberId | — | non |
| community_cta_clicked | CTA communauté (+ usage interne admin-exports) | sessionId | ref | non |
| whatsapp_join_clicked | clic WhatsApp | memberId | — | non |
| share_profile_clicked | partage profil | memberId | ref | non |
| status_change_email_sent | email statut | memberId | — | non |
| event_interest | intérêt anonyme | sessionId | ref=eventId | non |
| event_rsvp | RSVP | memberId | ref=eventId | non |

## Serveur seul (jamais acceptés par POST — Zod `EVENT_TYPES`)
`admin_*`, `cron_*`, `onboarding_*`, `profile_completed_by_member`,
`profil_generated` (doublon historique côté serveur, voir code).
Écritures : `toServerEventData` (garde runtime, rejette l'inconnu).

## Lecture dashboard (sous-ensemble utilisé)
`sessionsStarted/Completed` (profiling_started/completed + sessionId),
`whatsappClicks`, drop-off (answered/abandoned par ref), timing (timed),
`events` (groupBy tous types — affichage, pas de calcul).
Règle : aucun `type` lu par le dashboard hors de ce catalogue (testé).
