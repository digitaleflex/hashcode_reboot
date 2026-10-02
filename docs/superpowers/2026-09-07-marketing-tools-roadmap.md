# Marketing Tools Roadmap — Priorité par impact

> **Principe** : on crée les issues une par une, on exécute dans l'ordre de priorité.
> Chaque issue produit un livrable indépendant et testable.

---

## Priorité 1 : Drop-off par question (Impact: CRITIQUE)

**Pourquoi** : On sait que 30% abandonnent mais on ne sait PAS à quelle question exactement. Sans ça, on optimise à l'aveugle.

**Effort** : Faible — l'infra analytics existe déjà.

### Issue: `feat(analytics): track drop-off per question`

**Fichiers à modifier :**
- `src/lib/analytics.ts` — ajouter event `profiling_abandoned`
- `src/components/reboot/profiling-flow.tsx` — tracker last question avant abandon
- `src/app/api/analytics/route.ts` — ajouter le computed drop-off dans GET
- `src/components/reboot/admin/AdminStats.tsx` — afficher le drop-off par question

**Implémentation :**
1. Ajouter `"profiling_abandoned"` à `EVENT_TYPES`
2. Dans `profiling-flow.tsx`, quand l'utilisateur quitte (beforeunload ou back au début), envoyer `profiling_abandoned` avec `ref: lastQuestionId`
3. Dans `analytics/route.ts` GET, calculer : pour chaque question id, combien de sessions l'ont vue vs combien ont continué
4. Dans `AdminStats.tsx`, ajouter une section "Drop-off par question" avec barres de progression

**Livraison** : Dashboard admin montre "Question X : 40 vues, 32 continuées = 20% drop-off"

---

## Priorité 2 : Email open/click tracking (Impact: ÉLEVÉ)

**Pourquoi** : On envoie 3 types d'email (welcome, waitlist, engagement) mais on ne sait pas qui les ouvre. Sans ça, on ne peut pas mesurer l'engagement.

**Effort** : Moyen — Resend supporte les webhooks.

### Issue: `feat(email): track opens and clicks via Resend webhooks`

**Fichiers à créer :**
- `src/app/api/webhooks/resend/route.ts` — endpoint webhook Resend

**Fichiers à modifier :**
- `src/lib/mail.ts` — ajouter `tracking: true` dans les envois
- `src/lib/analytics.ts` — ajouter event types `email_sent`, `email_opened`, `email_clicked`
- `prisma/schema.prisma` — ajouter model `EmailEvent`
- `src/components/reboot/admin/AdminStats.tsx` — afficher métriques email

**Implémentation :**
1. Créer model `EmailEvent` dans Prisma (id, memberId, type, openedAt, clickedAt, metadata)
2. Configurer Resend webhook URL dans les settings Resend
3. Créer endpoint POST `/api/webhooks/resend` qui reçoit les événements `email.sent`, `email.opened`, `email.clicked`
4. Matcher l'email du destinataire avec un member pour lier l'événement
5. Ajouter dashboard : taux d'ouverture, taux de clic, par type d'email

**Livraison** : Admin montre "Welcome email: 85% ouverts, 40% cliqués"

---

## Priorité 3 : Relance automatique des abandonnés (Impact: ÉLEVÉ)

**Pourquoi** : Les 10 personnes qui abandonnent sans finir = perdues. Si on a leur email (grâce au déplacement de l'email dans le flow), on peut les relancer.

**Effort** : Moyen — cron job + email template.

### Issue: `feat(relance): auto-relance des sessions abandonnées`

**Fichiers à créer :**
- `src/app/api/cron/relance/route.ts` — cron job daily
- `src/lib/mail.ts` — ajouter `sendRelanceEmail`

**Fichiers à modifier :**
- `prisma/schema.prisma` — ajouter champ `lastQuestionId` à Member (ou utiliser AnalyticsEvent)
- `src/components/reboot/profiling-flow.tsx` — envoyer `profiling_abandoned` au beforeunload

**Implémentation :**
1. Créer cron job `/api/cron/relance` qui tourne 1x/jour
2. Rechercher les members avec `createdAt > il y a 24h` ET pas de `profiling_completed` dans analytics
3. Pour chaque session abandonnée avec email : envoyer `sendRelanceEmail`
4. Template email : "Tu avais commencé ton profil HASHCODE, tu veux finir ? [Reprendre]"
5. Le lien "Reprendre" ouvre le flow avec le draft restauré (localStorage déjà supporté)

**Livraison** : Relance automatique 24h après abandon, avec lien direct vers le draft

---

## Priorité 4 : Temps moyen par question (Impact: MOYEN)

**Pourquoi** : Identifier les questions lentes qui cassent le momentum.

**Effort** : Faible — timestamp client-side.

### Issue: `feat(analytics): track time per question`

**Fichiers à modifier :**
- `src/lib/analytics.ts` — ajouter event `profiling_question_timed` avec `value: durationMs`
- `src/components/reboot/profiling-flow.tsx` — mesurer temps entre chaque question

**Implémentation :**
1. Ajouter un `lastQuestionTimestamp` ref dans `ProfilingFlow`
2. Quand l'utilisateur avance, calculer `durationMs = Date.now() - lastQuestionTimestamp`
3. Envoyer `profiling_question_timed` avec `ref: questionId, value: durationMs`
4. Dans analytics GET, calculer la moyenne par question
5. Dashboard : "Question '3 mois' : moyenne 45s" vs "Question 'domaine' : moyenne 3s"

**Livraison** : Admin montre le temps moyen par question pour identifier les friction points

---

## Priorité 5 : UTM / Source tracking (Impact: MOYEN)

**Pourquoi** : Savoir d'où viennent les inscrits (WhatsApp, LinkedIn, bouche-à-oreille).

**Effort** : Faible — localStorage + champ member.

**Fichiers à modifier :**
- `src/lib/analytics.ts` — capturer UTM params au page view
- `prisma/schema.prisma` — ajouter champ `source` à Member
- `src/app/api/members/route.ts` — stocker la source au login
- `src/components/reboot/admin/AdminStats.tsx` — afficher par source

**Implémentation :**
1. Au `reboot_page_view`, capturer `utm_source`, `utm_medium`, `utm_campaign` depuis l'URL
2. Stocker dans localStorage `hashcode:reboot:source`
3. Au submit du profil, inclure la source dans le payload
4. Ajouter champ `source String?` au model Member
5. Dashboard : "35% viennent de WhatsApp, 25% de LinkedIn, 40% direct"

**Livraison** : Admin montre la répartition par source d'acquisition

---

## Priorité 6 : Dashboard temps réel (Impact: MOYEN)

**Pourquoi** : Vue live des inscriptions en cours.

**Effort** : Moyen — polling ou SSE.

**Fichiers à modifier :**
- `src/components/reboot/admin/AdminStats.tsx` — ajouter refresh auto
- `src/app/api/stats/route.ts` — supporter `?live=true` pour polling rapide

**Implémentation :**
1. Ajouter un bouton "Live" dans le dashboard admin
2. Polling toutes les 10s quand activé
3. Afficher "X inscriptions dans la dernière heure" avec animation
4. Notification viselle quand une nouvelle inscription arrive

**Livraison** : Dashboard avec indicateur live et compteur temps réel

---

## Priorité 7 : Cohorte / Rétention (Impact: FAIBLE pour l'instant)

**Pourquoi** : Mesurer la rétention des membres dans le temps. Nécessite d'abord avoir de l'historique.

**Effort** : Élevé — nécessite des données historiques.

**Reporté** : à implémenter quand on aura 100+ membres et 3 mois de données.

---

## Ordre d'exécution

| # | Issue | Effort | Impact | Blocké par |
|---|---|---|---|---|
| 1 | Drop-off par question | Faible | Critique | — |
| 2 | Email tracking | Moyen | Élevé | — |
| 3 | Relance auto | Moyen | Élevé | Issue 1 (drop-off data) |
| 4 | Temps par question | Faible | Moyen | — |
| 5 | UTM tracking | Faible | Moyen | — |
| 6 | Dashboard live | Moyen | Moyen | — |
| 7 | Cohorte/rétention | Élevé | Faible | Données historiques |

**Commencer par l'issue 1** (drop-off par question) — c'est le plus impactant et le plus facile.
