# Signaux comportementaux persistés – M2 Profiling Engine V1

| Signal | Source (fichier:ligne) | Utilisable | Remarque |
|---|---|---|---|
| **WorkshopSubmission.status** | `prisma/schema.prisma:718` | OUI | Statut PENDING|IN_REVIEW|APPROVED|REVISION|REJECTED. Détermine l'étape de la soumission ; état dérivé par `computeSessionState` (`src/lib/workshops/service.ts:81-103`). |
| **WorkshopSubmission.submittedAt** | `prisma/schema.prisma:720` | OUI | Date de dépôt. Utilisée dans le gate calendaire et le décompte de progression. |
| **WorkshopSubmission.attempt** | `prisma/schema.prisma:714` | OUI | Numéro d'essai (append-only). Permet de suivre les resoumissions (protocole §15). |
| **WorkshopQuizAttempt.passed** | `prisma/schema.prisma:802` | OUI | Booléen : le quiz a été réussi. Dérive `QuizState` = NOT_STARTED/PASSED/FAILED (`service.ts:214-216`). |
| **WorkshopQuizAttempt.score** | `prisma/schema.prisma:801` | OUI | Points obtenus sur le quiz (entier). Utilisable pour le scoring dérivé. |
| **WorkshopEnrollment.status** | `prisma/schema.prisma:821` | OUI | active | completed | dropped. Jalon clé : **démarré** = active, **terminé** = completed, **abandonné** = dropped. |
| **WorkshopEnrollment.enrolledAt** | `prisma/schema.prisma:822` | OUI | Date d'inscription. Première activation du membre dans l'atelier. |
| **EventRsvp.status** | `prisma/schema.prisma:456` | OUI | going | maybe | cancelled. **Event rejoint** = status going; **participé** = going + event status completed. |
| **AnalyticsEvent.type** | `src/lib/analytics.ts:8-27` | OUI (partiel) | Types existants : `profiling_completed`, `profiling_abandoned`, `event_rsvp`, `event_interest`, `community_cta_clicked`, etc. Permettent de déduire : `profiling_started` → démarré, `profiling_completed` → terminé, `profiling_abandonné` → abandonné. **Accepté/ignoré** non directement tracé ; peut être inféré de `event_rsvp` + `status` going/maybe/cancelled. |
| **Mentorship.status** | `prisma/schema.prisma:838` | OUI | ACTIVE | PAUSED | ENDED. **Démarré** = ACTIVE + startedAt, **terminé** = ENDED + endedAt, **abandonné** = PAUSED sans endedAt. |
| **MentorshipSession.rating** | `prisma/schema.prisma:861` | OUI | Note 1‑5 donnée par le mentoré après séance. Indique la qualité de la session complétée. |
| **MentorshipSession.completedAt** | `prisma/schema.prisma:859` | OUI | Date de fin de la session de mentorat. NULL ⇒ session non terminée. |
| **ProfilingDraft.relanceSentAt** | `prisma/schema.prisma:328` | OUI | Timestamp de l'envoi de la relance (max 1 relance). NULL ⇒ pas encore de relance. |
| **ProfilingDraft.completedAt** | `prisma/schema.prisma:330` | OUI | Timestamp de fin du profilage. NULL ⇒ draft abandonné ; rempli ⇒ profilage terminé (reprise possible). |
| **Member.communityStatus** | `prisma/schema.prisma:70` | OUI | NOT_INVITED | INVITED | JOINED. Jalon d'activation : **rejoint** = JOINED. |
| **Member.profileStatus** | `prisma/schema.prisma:69` | OUI | PENDING | APPROVED | REJECTED | WAITLIST. État du profil membre. |
| **Member.invitedAt** | `prisma/schema.prisma:87` | OUI | Date d'envoi de l'invitation. Premier contact pour activation. |
| **Member.acceptedAt** | `prisma/schema.prisma:93` | OUI | Date d'acceptation de l'invitation par le membre. |
| **Member.approvedAt** | `prisma/schema.prisma:94` | OUI | Date de validation du profil par l'admin. |
| **Member.joinedAt** | `prisma/schema.prisma:95` | OUI | Date de rejoindre la communauté. |

## Ce qui manque pour une boucle observer → re‑scorer

| Manquant | Conséquence |
|---|---|
| **Table de feedback agrégée par membre** (pas de champ "feedback" consolidé sur le membre ou l'atelier) | Impossible de scorer ou de relancer sur la base des retours utilisateurs ; le feedback existe uniquement dans `WorkshopReview.feedback` mais n'est pas relié au membre global. |
| **Lecture de présence aux événements** (EventRsvp non lié à la progression atelier) | On sait si un membre a accepté/décliné un événement, mais on ne peut pas l'associer automatiquement à l'état de ses ateliers (pas de jointure EventRsvp ↔ WorkshopEnrollment dans le modèle). |
| **Timestamp "dernière activité" global** | Aucun champ `lastActivityAt` ou équivalent sur `Member` ; les jalons (`invitedAt`, `approvedAt`, `joinedAt`) sont discrets mais il manque un point de repère continu pour détecter l'inactivité. |
| **Mapping analytique "accepted/ignoré"** | Les événements `analytics` couvrent le funnel mais n'incluent pas de type "event_accepted" / "event_ignoré" ; il faudrait enrichir le schéma ou déduire de `event_rsvp` + `status`. |
| **Signal d'abandon progres‑atelier** | Pas de champ `droppedAt` ou `abandonedAt` sur `WorkshopEnrollment` ; on se base sur `status = dropped` qui n'est pas toujours mis à jour manuellement. |

**Sources principales** : schéma Prisma (`prisma/schema.prisma`), service de progression ateliers (`src/lib/workshops/service.ts`), types d'événements (`src/lib/analytics.ts`).