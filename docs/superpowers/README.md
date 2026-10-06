# docs/superpowers — plans d'implémentation (archives)

Ce dossier contient des **plans de travail datés de septembre 2026**, écrits
pour des agents exécutant une tâche à la fois. Ce ne sont pas de la
documentation de référence et **le code du dépôt ne les suit plus**. Ils sont
conservés pour la trace : quoi avait été décidé, dans quel ordre, et avec
quelles hypothèses.

## Comment les lire

Un plan de cette carpeta décrit l'état du dépôt **à sa date**. L'appliquer
tel quel casserait probablement le build. Avant d'exécuter une étape :

1. Vérifier que la cible existe encore (`src/app/...`, `src/lib/...`).
2. Vérifier que le symbole appelé est toujours exporté.
3. Vérifier que le script npm existe encore dans `package.json`.

Si une étape porte sur quelque chose qui a été supprimé depuis, l'étape est
**-close**, pas à refaire. Voir la liste ci-dessous.

## Références périmées récurrentes

Ces symboles ont disparu du dépôt. Toute occurrence dans un plan de ce dossier
est historique :

| Symbole | Sort | Remplacé par |
|---|---|---|
| `requireAdminRole(req, role)` | supprimé (booléen, ne distinguait pas 401 de 403) | `requireAdmin(req, role)` / `requireAdminOrThrow` — contrat 401 `AUTH_REQUIRED` / 403 `FORBIDDEN` (`src/lib/admin-auth.ts`) |
| `isAdminAuthed(req)` | existe encore, mais c'est un booléen | même remarque : préférer `requireAdmin` |
| `POST /api/admin/keys` et `admin-passcode.ts` | supprimés | — (plus de rotation de clé ; l'admin passe par Better Auth email/mot de passe) |
| `src/lib/admin-roles.ts` | supprimé | `src/lib/admin-auth.ts` |
| `src/lib/account-otp.ts` | supprimé | plugin `emailOTP` de Better Auth (`src/lib/auth/index.ts`, `expiresIn: 900`) |
| `src/middleware.ts` | renommé | `src/proxy.ts` (convention Next 16) |
| `src/app/admin/*` (chemins directs) | déplacés | `src/app/[locale]/admin/*` (migration i18n) |
| Vitest (`npm run test:run`, `test:coverage`) | jamais présent | `node --test` + `tsx` : `npm run test:unit` |
| `npm run db:seed` | n'existe pas | `npm run seed:workshops`, ou `npx tsx scripts/seed-workshops.ts` |

## Documents

| Fichier | Objet | État |
|---|---|---|
| `2026-09-05-admin-improvements.md` | hashing du passcode admin, `admin/keys`, audit d'activité, raccourcis clavier | **largement caduc** : voir la table ci-dessus |
| `2026-09-06-admin-tab-pages.md` | un onglet admin par page | fait — les pages sont sous `src/app/[locale]/admin/*` |
| `2026-09-06-email-automation.md` | séquences onboarding + engagement | partiellement livré |
| `2026-09-06-public-profiles.md` | `/profile/[id]` | fait |
| `2026-09-07-marketing-tools-roadmap.md` | outils marketing | voir `src/app/[locale]/admin/marketing` |
| `2026-09-07-reduce-signup-dropoff.md` | réduction des abandons | partiellement livré |
| `2026-09-10-espace-marketing.md` | espace marketing complet | voir `src/app/[locale]/admin/marketing` et `/dashboard/mentoring` |

## Ce qui fait foi

Pour l'état actuel du code : `README.md`, `CONTRIBUTING.md`, `docs/i18n.md`,
`docs/espace-membre.md`, `docs/ateliers/ARCHITECTURE.md`, et le code lui-même.