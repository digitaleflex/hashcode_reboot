# Roadmap de réduction de la sur-ingénierie — HASHCODE REBOOT

> Issu de l'audit technique du 5 octobre 2026 (6 domaines, ~56 300 lignes de `src/`,
> 86 routes API, 32 modèles Prisma).
>
> Chaque constat de ce document a été **vérifié par lecture de code et grep croisé**.
> Les affirmations à fort impact ont été re-vérifiées indépendamment, dont une par
> **test empirique** (voir D18).
>
> **Objectif** : supprimer ~18 700 lignes de dette (33 % de `src/`) et corriger les
> 8 bugs réels qu'elle masque, sans régression fonctionnelle.
>
> **Suivi pas-à-pas** : voir `docs/REGLE-EXECUTION.md`.

---

## 1. Le problème de fond

`tsc --noEmit` passe. `eslint .` passe. **317 tests unitaires passent.**
0 `eslint-disable`, 0 `@ts-ignore`, 2 casts `any` sur tout le dépôt.

**La dette ne se voit dans aucun outil.** C'est ce qui la rend dangereuse : elle
s'accumule depuis des dizaines de commits et se paie au moment où quelqu'un veut
changer une fonctionnalité — il découvre alors 5 copies de la même chose et ne sait
pas laquelle est vivante.

Les 5 causes racines sont identifiées et toutes primitives :

| # | Cause | Manifestation |
|---|---|---|
| 1 | **Copier au lieu de composer** | `admin/dashboard` réimplémente 6 endpoints existants |
| 2 | **Générer sans élaguer** | 35 composants shadcn sur 48 ne sont jamais importés |
| 3 | **Migrer sans supprimer** | Better Auth a laissé 3 subsystems câblés mais inertes |
| 4 | **Tester par copie** | les tests réimplémentent le code au lieu de l'importer |
| 5 | **Ajouter sans retrait** | clés i18n, dépendances, scripts : rien ne se déprécie |

---

## 2. Vue d'ensemble

| Phase | Contenu | Lignes | Risque | Durée est. |
|---|---|---|---|---|
| **0** | 8 bugs réels (sécurité + données fausses) | — | Faible | 1 j |
| **1** | Suppressions sèches | ~7 000 | **Nul** | 2 j |
| **2** | Fiabiliser les tests | 741 | Faible | 1 j |
| **3** | Purge i18n + documentation | ~5 000 | Faible | 1 j |
| **4** | Cohérence serveur (401/403, guards) | ~350 | Moyen | 1 j |
| **5** | Composition admin (arrêter de copier) | ~1 000 | Moyen | 2 j |
| **6** | Décisions produit à trancher | ~1 300 | Moyen | 1 j |
| | **Total** | **~18 700** | | **~9 j** |

**Règle de séquencement** : ne pas démarrer une phase avant que la précédente soit
`npm run validate` verte. La phase 1 est réversible (suppressions pures) mais le git
reste la seule sécurité : **un commit par tâche**.

**Ordre impératif** : D07 (migrations manquantes) **avant** D36 (suppression de
tables). Supprimer un modèle sans migration de référence casse la reproductibilité.

---

# PHASE 0 — Les 8 bugs réels

> Ce ne sont pas de la sur-ingénierie. Ils sont **cachés derrière un lint vert et des
> tests verts**. C'est la phase la plus urgente et la moins volumineuse.

## D01 — 🔴 Préemption d'identité admin

**Constat.** `src/lib/auth/index.ts:28` déclare :
```ts
emailAndPassword: { enabled: true, requireEmailVerification: false }
```
**sans `disableSignUp`**. La route `src/app/api/auth/[...betterAuth]/route.ts` monte
l'intégralité du routeur Better Auth, donc `POST /api/auth/sign-up/email` est **public**.
Or `src/lib/admin-auth.ts:61` ne teste **que l'email** (`ADMIN_OPERATORS.includes(email)`),
et Better Auth ne vérifie pas `emailVerified` quand `requireEmailVerification: false`.

Les lignes `User` Better Auth sont créées **paresseusement**, à la première connexion OTP.
Donc **tout admin qui ne s'est jamais connecté** est concerné.

**Impact.** Un tiers fait `sign-up` + `sign-in` avec l'email d'un admin jamais connecté
et obtient une **session `operator`** : accès complet aux membres, aux exports, à
l'envoi d'emails.

**Pourquoi c'est P0.** Élévation de privilège vers le rôle le plus puissant de
l'application, exploitable par quiconque connaît la liste `ADMIN_OPERATORS`.

**Correctif.** Ajouter `disableSignUp: true` à `src/lib/auth/index.ts:28`.
Vérifié : le sign-up OTP du plugin `email-otp` n'est **pas** affecté — il teste la
propriété du *plugin*, pas celle de `emailAndPassword`.

**Vérifier.** `POST /api/auth/sign-up/email` doit répondre 403 pour un email valide.

---

## D02 — 🔴 `token` jamais validé sur `/api/invite/accept` et `/refuse`

**Constat.** `src/app/api/invite/accept/route.ts:60` parse le token via zod
(`token: z.string().min(1).max(64)`), puis ligne 81 :
```ts
// Le token OTP brut a été remplacé par l'identifiant email + état de l'invitation.
```
Le token est **validé puis jeté**. `invite/refuse/route.ts:62` fait de même.

**Impact.** Quiconque connaît l'email d'un inscrit peut **accepter l'invitation à sa
place** (`accept:89-97` → `invitationStatus: "ACCEPTED"` + `acceptedAt`) ou **la refuser**
(`refuse:84-93` → sabotage), et déclencher un envoi d'OTP à la victime.

**Aggravant.** `docs/audit-securite-2026-09-18.md:33-34` déclare ces failles
« ✅ corrigé (`c9df5a2`) ». Le correctif a **supprimé** le contrôle au lieu de le
réécrire. La documentation de sécurité est donc fausse — à corriger en D23.

**Deux sorties possibles** (décision à trancher) :
- **Restaurer** — réécrire une vérification réelle du token.
- **Supprimer** — retirer `token` du schéma zod, de la doc et des URLs, et assumer
  explicitement que ces routes sont en libre-service par email.

**Pourquoi c'est P0.** Bypass d'une intention de sécurité documentée, sans authentification.

### ✅ D02 — DÉCISION PRISE ET APPLIQUÉE : **suppression**

Décision validée le 2026-10-05. Investigation complémentaire ayant changé le
diagnostic initial :

**1. Aucun email ne lie vers ces routes.** Le `acceptUrl` réellement envoyé pointe
vers `/verify-otp`, pas vers `/api/invite/accept`, et **ne contient aucun token** :

```ts
// src/app/api/invite/relance/route.ts:100
const url = `${base}/verify-otp?email=${encodeURIComponent(member.email)}&next=${encodeURIComponent("/dashboard")}`;
```

Le seul producteur de liens accept/refuse était `sendInvitationWithActions` —
**0 appelant en production** (uniquement le script de seed et le registre).

**2. Il n'existe plus aucun secret à restaurer.** Chronologie vérifiée :

| Commit | Effet |
|---|---|
| `7c91cef` (10 sept) | systèmeInvitation créé **avec** validation OTP (`MemberSession.otpHash`) |
| `c9df5a2` | *« fix(security): anti-bruteforce (S1, S2) »* — durcit cette validation |
| `f73099f` | **retire la validation**, en laissant `token` au schéma zod |
| `bc3e449` (4 oct) | migration Better Auth, suppression de `account-otp.ts` |

`f73099f` est le coupable : il a annulé ce que `c9df5a2` venait de durcir. Restaurer
une validation n'aurait consisté qu'à **inventer** un mécanisme neuf.

**3. `refuse` était plus grave que décrit.** Il n'a **aucun** contrôle
d'éligibilité — il écrit `REFUSED` inconditionnellement (l.84-93), là où `accept`
vérifie `invitationStatus` (l.82). Il pouvait donc écraser le statut d'un membre
ayant **déjà rejoint** la communauté.

**4. Les routes sont redondantes.** `invite/relance` fait déjà OTP + redirection
vers `/verify-otp`, sans transition d'état forgeable.

**Contenu de la suppression** :
- `src/app/api/invite/accept/route.ts` et `src/app/api/invite/refuse/route.ts`
- `sendInvitationWithActions`, `sendAcceptNotificationEmail`,
  `sendRefuseNotificationEmail` (+ leurs interfaces) dans `mail.ts` — **158 lignes**
- entrées de registre `invitation_actions`, `accept_notification`,
  `refuse_notification` + leurs cas dans `seed-email-templates.ts`
- `docs/audit-securite-2026-09-18.md` : ajout du §1.1 qui documente l'annulation
  du correctif S1/S2 et la décision

**Effet de bord assumé** : `invitationStatus: "REFUSED"`, `refusedAt` et
`refusedReason` restent dans le schéma et l'interface admin, mais plus aucune route
ne les écrit. Nettoyage prévu en **D36**. Si le refus par email est un besoin réel,
il faut une feature signée (HMAC de lien, sur le modèle de
`lib/phone-fill-ticket.ts`), pas une route publique.

**Vérification** : `npm run validate` → 319 tests verts ; `next build` → 103 pages
générées (105 avant, cohérent avec les 2 routes supprimées).

---

## D03 — 🔴 Le tunnel de relance email est silencieusement vide

**Constat.** `src/lib/mail.ts:63-76` (`categorizeEmail`) classe la catégorie d'un email
par `includes()` sur le **sujet** :
```ts
if (s.includes("t'attend") || s.includes("rejoins")) return "engagement";
if (s.includes("reprend") || s.includes("termin")) return "relance";   // jamais atteint
```
Le sujet réel de `sendRelanceEmail` est `"On t'attend sur HASHCODE — rejoins le groupe"`
(`mail.ts:532`) → il matche `"t'attend"` → catégorie **`"engagement"`**.
Aucun sujet du fichier ne contient `"reprend"` ni `"termin"` → **la branche `"relance"`
est inatteignable**.

**Impact.** `api/email-stats/route.ts:30` et `admin/dashboard/route.ts:214` comptent les
relances via `where: { type: "email.sent", category: "relance" }`.
→ `relanceSent`, `relanceOpened`, `relanceClicked` **valent toujours 0**, et le tableau
de bord l'affiche comme un chiffre réel.

**Pourquoi c'est P0.** Ce n'est pas une dette technique : c'est **une donnée fausse
présentée comme vraie** à l'exploitant. Les décisions marketing reposent dessus.

**Correctif.** Classer par catégorie **explicite** : passer la catégorie en paramètre de
`trackEmailSent` (les 17 wrappers de `mail.ts` connaissent déjà leur catégorie) et
supprimer `categorizeEmail`.

**Vérifier.** Envoyer une relance réelle → `relanceSent > 0` dans `/api/email-stats`.

---

## D04 — 🔴 Le tracking d'engagement Resend est cassé

**Constat.** Les 4 blocs `db.emailEvent.create` du webhook Resend
(`src/app/api/webhooks/resend/route.ts` lignes **144, 215, 281, 346**) n'écrivent
**aucun `memberId`**. Le bloc 346 est celui de `email.opened` / `email.clicked`.

Or `src/app/api/admin/email-log/route.ts:119` enrichit les lignes via
`where: { memberId: { in: memberIds } }`.

**Impact.** **Tout le trafic Resend est invisible** dans le bloc engagement de
`/api/admin/email-log` et de `admin/member-emails`. Le webhook Brevo écrit bien
`memberId` (`brevo/route.ts:87`) — d'où une asymétrie invisible à l'œil.

**Pourquoi c'est P0.** Open rate et click rate ne couvrent qu'une fraction du trafic, avec
un biais systématique (Brevo uniquement). Décision marketing prise sur des chiffres faux.

**Correctif.** Factoriser les 3 helpers que Brevo possède déjà et que Resend réimplémente
(`logEvent`, `findMember`, `blacklist`) dans un module partagé, et passer les 4 blocs
Resend dessus. ≈ 60 lignes supprimées **et** le bug corrigé.

---

## D05 — 🟠 Turnstile contournable par conception

**Constat.** `src/app/api/admin/login/route.ts` :
```ts
if (!token) return true;   // ligne 19 — pas de token = pas de vérification
if (!secret) return true;  // ligne 21 — pas de secret = pas de vérification
```
Un attaquant n'envoie **pas** de `captchaToken` → la vérification n'est **jamais**
effectuée. Elle n'est exigée qu'après 3 échecs, et **côté client** (`admin-login.tsx:170`),
donc contournable.

**Impact.** Le rate-limit (10 req / 10 s) est la seule barrière réelle sur la connexion admin.

**Correctif.** Inverser la logique : fail-closed quand le secret est configuré, et
journaliser quand il ne l'est pas. Ou assumer le risque et le documenter.

---

## D06 — 🟠 Divergence OTP : 5 min en base, 15 min annoncées

**Constat.** Better Auth expire l'OTP à **300 s**
(`node_modules/better-auth/dist/plugins/email-otp/index.mjs:14`).
Or **4 emplacements** annoncent 15 minutes : `src/lib/mail.ts:728`, `:739`, `:762`,
`messages/fr.json:1316`, `:1330` (et `en.json`).

**Impact.** Un utilisateur qui saisit son code entre 5 et 15 minutes est refusé alors
qu'il est encore valide — et le message d'erreur ne l'explique pas.

**Correctif.** Trancher **une seule** valeur et la propager. Recommandation : aligner sur
`expiresIn: 900` côté Better Auth — l'UI, les emails et le README disent déjà 15 min
(3 sources sur 4).

---

## D07 — 🟠 Aucune migration pour les tables Better Auth

**Constat.** `rg 'CREATE TABLE "(User|Session|Account|Verification|RateLimit)"' prisma/migrations`
→ **0 résultat**. 13 fichiers de migration existent, aucun ne crée ces tables.

Or `package.json:11` (`vercel-build`) fait `prisma migrate deploy`. Les tables n'existent
en prod que parce qu'elles ont été créées via `prisma db push` (`package.json:12`) sur la
base Neon existante.

**Impact.** **Une base neuve n'est pas reproductible** — ni en local, ni en staging, ni en
reprise après incident. Le pipeline ne reflète pas l'état réel du schéma.

**Pourquoi c'est P1.** La prod fonctionne aujourd'hui ; le risque est la
non-reproductibilité, pas une panne.

**Correctif.** `prisma migrate diff` pour produire les `CREATE TABLE` manquants, puis un
`prisma migrate dev` propre. **À faire avant D36** (suppression de tables).

---

## D08 — 🟠 Les 3 notifications admin ne sont pas délivrables

**Constat.** Trois routes utilisent `process.env.ADMIN_EMAIL || process.env.EMAIL_FROM`
comme **adresse de destinataire** : `webhooks/brevo/route.ts:155`, `invite/accept:120`,
`invite/refuse:102`.

Or `.env.example:40` déclare :
```
EMAIL_FROM="HASHCODE REBOOT <reboot@reboot.joinhashcode.com>"
```
C'est un **Display Name**, pas une adresse. `sendViaResend:130` produirait
`to: ["HASHCODE REBOOT <reboot@...>"]` (invalide). Et `ADMIN_EMAIL` **n'existe pas**
dans `.env.example`.

**Impact.** Sans `ADMIN_EMAIL` défini en prod, les notifications *invitation acceptée*,
*invitation refusée* et *bounce* ne sont **jamais délivrées** — silencieusement
(`.catch(() => {})`).

**Correctif.** Extraire l'adresse pure de `EMAIL_FROM` (regex sur `<...>`), ou imposer
`ADMIN_EMAIL` dans `.env.example`. Ajouter la variable = un seul point de vérité.

---

# PHASE 1 — Suppressions sèches

> **Risque nul** : aucun changement de comportement. Réversible par `git revert`.
> Un commit par tâche.

## D09 — Supprimer les 35 composants UI morts (~4 340 l.)

**Constat.** `src/components/ui/` contient **48** composants pour **13 réellement
consommés**. Vérifié sur échantillon (`chart`, `menubar`, `carousel`, `command`,
`sidebar`, `form`, `calendar`, `sonner`) : **0 importateur** chacun.

La preuve du bien-fondé : les graphiques du projet sont du **SVG artisanal**
(`components/reboot/donut-chart.tsx:80-110`, géométrie `stroke-dasharray`), donc
`ui/chart.tsx` (336 l.) et `recharts` sont bien deux couches mortes — et non un manque.

**Risque.** Nul. Aucun composant vivant n'en dépend, graphe d'imports vérifié.
C'est le plus gros gain sûr du dépôt.

## D10 — Supprimer les dépendances mortes (~30 paquets)

**11 dead directs** (0 import) : `zustand`, `@dnd-kit/core|sortable|utilities`,
`@reactuses/core`, `react-markdown`, `react-syntax-highlighter`, `resend`,
`tailwindcss-animate`, `@types/papaparse`, `bun-types`.
**12 dead transitifs** : importés seulement par D09 (`cmdk`, `vaul`, `sonner`,
`next-themes`, `react-day-picker`, `react-hook-form`, `embla-carousel-react`,
`react-resizable-panels`, `input-otp`, + 18 paquets `@radix-ui` sur 24).

`resend` mérite une note : le SDK n'est jamais importé, `mail.ts:20` fait du `fetch` brut
sur `RESEND_URL`. Le code fonctionne, la dépendance est inutile.

`bcryptjs` n'a aucun usage dans `src/` — seulement dans un test miroir obsolète (D19) et
un script one-off (D15). À rétrograder en `devDependencies` après avoir vérifié la
peer-dependency Better Auth.

**Gain de bundle estimé : ~60 Mo** (`recharts` seul tire `victory-vendor` + `d3-*`).

**Dépend de :** D09 (les deps transitives meurent avec leurs wrappers).

## D11 — Supprimer `src/lib/prisma-extensions.ts` (235 l.)

**Constat.** 6 exports (`withPrismaRetry`, `handlePrismaError`, `withSoftDelete`,
`serializePrismaError`, `isTransientPrismaError`, `isConstraintPrismaError`).
**0 importation** dans `src/`, `tests/` et `scripts/`. La seule mention hors fichier est
`docs/ateliers/00-audit-phase1.md:87`, qui la décrit à tort comme branchée.

Le fichier ne contient **aucun** `$extends` : ce ne sont pas des extensions Prisma mais
des helpers purs, jamais branchés sur `db.ts`.

**Pourquoi c'est sans regret.** `@/lib/errors.ts` fait déjà le travail de
`handlePrismaError` (`AppError` + `errorToResponse`) et **est utilisé dans 53 routes**.
Un module de retry jamais branché pendant des mois est un piège : le prochain
développeur croira que le retry est actif.

## D12 — Supprimer les hooks admin morts (143 l.)

**Constat.** `hooks/useStats.ts` (83 l.) et `hooks/useActivity.ts` (60 l.) :
**0 consommateur**. `admin/stats/page.tsx:36` fait son propre `fetchJson`,
`ActivityLog.tsx:81` aussi.

Ils dupliquent en outre mot pour mot les options déjà définies par défaut dans
`providers.tsx:17-23` (`staleTime`, `gcTime`, `refetchOnWindowFocus`, `retry`) —
20 lignes redondantes.

`useMembers.ts` (vivant) porte aussi du résidu de migration : `queryClient` déclaré
ligne 140 et **plus utilisé nulle part**, `refreshMembersMutation` (253-263) dont la
`mutationFn` ne fait qu'`await refetch()` avec `onSuccess`/`onError` vides, et
`setLoadError: () => {}` (343). ≈ 25 lignes mortes. Total ≈ 168 l.

## D13 — Supprimer les 5 routes API mortes (~160 l.)

| Route | Preuve de mort |
|---|---|
| `src/app/api/route.ts` | Boilerplate `create-next-app` : `{"message":"Hello, world!"}` |
| `src/app/api/verify-email/confirm/route.ts` | `throw`/`catch` local qui renvoie juste un 410 « déprécié » |
| `src/app/api/check-email/route.ts` | `docs/audit-securite:70` : « neutralisée, aucun appelant UI » |
| `src/app/api/admin/stats/route.ts` | `export { GET } from "../../stats/route"`, **0 appelant** |
| `src/app/api/admin/mentoring/end/route.ts` | **0 appelant** (les 6 routes mentoring, jamais celle-ci) |

Conséquence secondaire : `src/lib/health.ts:7-27` maintient un manifeste `ROUTES` de
**21 entrées** alors qu'il existe **85 routes** — et ne sert qu'à afficher `ROUTES.length`
dans une bannière console. Un compteur décoratif qui ment.

## D14 — Supprimer les 9 validateurs Ateliers morts (445 l.)

**Constat.** `src/lib/workshop-validation.ts` (616 l.) : **9 validateurs sur 11 n'ont
aucun appelant** — vérifié un par un.

**Ce n'est pas un oubli.** `docs/ateliers/adr-001-decisions.md:33-49` (décision D2,
VALIDÉE) indique que la structure pédagogique est gérée par seed idempotent et
qu'« aucune route admin de CRUD de structure en v1 » n'existe.

**Pourquoi c'est dangereux de le garder.** Le fichier se décrit lui-même comme
partageant sa philosophie avec `events-validation.ts`, alors qu'il s'agit d'un
copié-collé (mêmes helpers `optStr`, `parseHttpUrl`, `intIn` ; même message
« Titre requis (min 3 caractères) » répété **14 fois** dans 2 fichiers + 10 dans
les tests). Un développeur cherchant « la validation des ateliers » tombera dessus
et l'utilisera, alors que `review/route.ts:27` applique une **règle différente** —
et `tests/workshop-validation.test.cjs:536` verrouille la version morte. Un test vert
qui protège une règle que le code n'a pas.

## D15 — Supprimer les scripts orphelins et résidus racine (~3 000 l.)

**16 scripts one-shot** dans `scripts/` : `debug-context(2).mjs`, `fix-globals(2).mjs`,
`fix-membertable.mjs`, `fix-prerender(2).mjs`, `fix-typo.mjs`,
`import-blacklist-from-soft-deleted.mjs`, `import-direct.mjs` (385 l. recréant l'ancien
système auth), `import-old-members.mjs`, `seed-github-workshop.ts` (712 l., doublon de
`seed-workshops.ts`), `test-brevo-api.js`, `test-collector.ts`,
`test-email-services.mjs`, `task-tracker.mjs` (hors D16) — **aucun script npm**.

`import-direct.mjs` mérite une note : il duplique intégralement `sendViaResend` +
`sendViaBrevo` + le routage fallback, avec une 4ᵉ copie du HTML d'invitation.

**Résidus racine** : `.task-progress.json` (hors D16), `TACHES_REBOOT.md`,
`ROADMAP_RESPONSIVE.md`, `ISSUES_RESPONSIVE.md` (ses 6 P0 sont déjà corrigées),
`playwright-report/index.html` et `test-results/.last-run.json` **committés**,
`bun.lock` **en doublon de `package-lock.json`** alors que la CI fait `npm ci` —
pendant que `docs/interface-utilisateur.md:16` annonce Bun et
`.github/copilot-instructions.md:20-23` dit `bun run typecheck`. La doc **contredit**
la CI.

**Résidu dangereux** : `.env.backup-2026-09-07` (secrets en clair sur disque) —
non committé par `.gitignore` mais présent localement.

## D16 — Nettoyer squelettes dupliqués, props mortes et redondances (~120 l.)

- **2 implémentations de `MemberTableSkeleton`** : `MemberTable.tsx:53` (exporté,
  **0 importation**) et `skeletons/MemberTableSkeleton.tsx:3` (**0 importation**).
- `export { ActivityLogSkeleton }` dans `ActivityLog.tsx:57` : 0 consommateur externe.
- `revalidate = 0` (12 occurrences) systématiquement accompagné de
  `dynamic = "force-dynamic"` (23 occurrences) qui l'implique déjà.
- `skeletons/index.ts` : 3 exports, 1 seul consommé.
- `CommandPalette` : `onSetFilter` reçoit un **no-op** (`AdminShell.tsx:111`) → les
  6 commandes « Filtres rapides » ne font rien. `onExport` ignore son paramètre `kind`.
- `AdminSidebar` : `onNavigate` déclaré et jamais appelé — `handleNav` fait
  `window.location.assign` en dur, provoquant un rechargement complet.
- `HealthAlertsBanner` : `onCronsClick={() => {}}` → bouton inerte.
- `MemberTable` : prop `loading` de `FilterSelect` jamais passée.
- `ExportDialog` : ~100 lignes de sélection de colonnes, `fields` n'est **jamais**
  envoyé à l'API (`/api/export/json` ignore totalement les colonnes).

**Réserve.** Ces props inertes signalent une **intention produit non livrée** (filtres
croisés depuis les stats, colonnes d'export configurables, redirection douce du menu).
Avant de supprimer, vérifier si c'est un abandon ou un report — voir D33.

## D17 — Supprimer les ~34 exports morts (~120 l.)

Liste complète dans l'audit. Les plus trompeurs :

- `errors.ts` : `InvalidCodeError` (76-86), `LockedError` (89-93),
  `PayloadTooLargeError` (117-122), `isAppError` — **jamais instanciés**.
- `events-validation.ts` : `EVENT_STATUSES` / `EVENT_RECURRENCES` exportés et jamais
  importés — et `tests/event-validation.test.cjs:33-34` **redefinit ses propres
  tableaux**, donc ce test ne teste pas le code réel.
- `matching.ts` : `scoreMatch` / `parseSpecialties` — le test
  `tests/matching.test.cjs:26,41,64` **recopie** ces fonctions au lieu de les importer.
- `profiling/engine.ts` : `getCurrentIndex`, `isProfilingComplete`, `STYLE_LABELS_SHORT` —
  `profiling-flow.tsx:215` et `:134` **réimplémentent** ces deux premières en inline.
- `account-auth.ts` : `destroySession`, `destroyAllSessions` (0 appelant ;
  `docs/audit-securite:81` les référence encore).
- `analytics.ts` : `clearSource` (0 appelant).
- `verify-email.ts` : `isEmailVerified` (0 appelant — cf. D34).
- `health.ts` : `runStartupBanner` (0 appelant), `ROUTES` (compteur décoratif).

---

# PHASE 2 — Fiabiliser les tests

> Le constat le plus important de l'audit. Les tests passent, mais **ils ne testent pas
> le code de production**.

## D18 — Basculer les tests sur `tsx` et supprimer les 741 lignes de miroirs

**Constat.** Les fichiers `.test.cjs` **réimplémentent** le code source au lieu de
l'importer. Le commentaire l'assume : *« Mirrors (re-implemented pure logic — .cjs can't
import TS) »*.

**L'argument est faux — vérifié empiriquement.** Test exécuté pendant l'audit :
```
node --import tsx --test tests/__probe.test.cjs
→ ok 1 - import TS depuis CJS
```
Un `.test.cjs` importe parfaitement le TypeScript. `tsx` est déjà installé
(`package.json:117`) et utilisé par 4 scripts npm (`--import tsx`).

**Volume de duplication mesuré :**

| Fichier test | Miroir |
|---|---|
| `workshop-validation.test.cjs` | 363 l. |
| `profiling.test.cjs` | 127 l. |
| `workshop-quiz.test.cjs` | 99 l. |
| `workshop-progression.test.cjs` | 84 l. |
| `workshop-emails.test.cjs` | 68 l. |
| **Total** | **741 l.** |

**Le risque est déjà materialisé.** Dans `tests/profiling.test.cjs`, la fonction
`validateAnswer` miroir ne couvre ni le cas `multi_choice`, ni le cas `country`, ni la
vérification d'appartenance aux `options` — que la vraie `engine.ts:135-136` fait.
`rg domainSpecialty tests/profiling.test.cjs` → **0 occurrence**, alors que
`validate.ts:172` définit `domainSpecialtyMax`. Un bug dans `engine.ts` passe tout vert.

**Risque.** Faible — mais exige de réécrire les assertions contre le vrai code. **C'est
le seul moyen de savoir si la suite verte signifie quelque chose.** Ne pas commencer
les phases 4-5 avant : sans tests fiables, un refactor n'est pas vérifiable.

## D19 — Réécrire `tests/magic-link.test.cjs` (130 l. mortes)

**Constat.** Ce fichier teste `src/lib/account-otp.ts` — **un fichier supprimé** :
- section 4 `:356-387` (`generateOtp`)
- section 5 `:389-442` (`hashOtp`, `verifyOtpHash` + `require("bcryptjs")`)
- section 6 `:444-478` (`isValidOtpFormat`)

Il Require aussi `bcryptjs` (D10). Ces tests passent au vert en ne testant rien.

**Dépend de :** D18.

## D20 — Réactiver ou supprimer les 3 suites E2E `fixme`

**Constat.** `tests/e2e/ateliers-flows.spec.ts` : les 2 `describe` sont `fixme` (13 tests
ne s'exécutent pas) et les sélecteurs sont **périmés** — `[data-testid="atelier-card"]`,
`.quiz-question`, `text=/Mes ateliers/i` : aucun n'existe plus dans l'UI actuelle.
`dashboard-flows.spec.ts` : 1 `describe` `fixme`, et le reste utilise
`localStorage.setItem('hashcode:mock:auth')` que **rien dans `src/` ne lit** (le helper
a été supprimé, cf. `fixtures/test-data.ts:35`).

**Couverture E2E réelle : 3 specs actives** sur 5 (`locale-routing`,
`auth-redirects`, `workshop-gate`).

**Décision à trancher.** Réécrire avec de vrais flux Better Auth (cookies de session) ou
supprimer. Supprimer sans remplacement laisse le domaine Ateliers sans aucune
couverture E2E.

---

# PHASE 3 — Purge i18n et documentation

## D21 — Brancher les pages légales sur `legal.*` 🔴 décision requise

**Constat.** Le contenu légal **existe** dans `messages/fr.json` et `en.json`
(namespaces `legal.terms`, `legal.privacy`, `legal.mentions`, `legal.cookies`, avec
`metaTitle` et `metaDescription` complets). Mais :

- `src/components/reboot/legal/pending-document.tsx:31-32` affirme que ces namespaces
  « were never added to `messages/*.json` » → **le commentaire est faux**.
- Les 4 pages (`/cgu`, `/confidentialite`, `/mentions-legales`, `/cookies`) rendent
  toutes `PendingLegalDocument`.
- Même `generateMetadata` lit `legalPending` (`cgu/page.tsx:11`) au lieu de `legal.*`.

**Pourquoi c'est P1.** Le texte légal est traduit, révisé et payé, mais **jamais affiché**
ni utilisé pour le SEO. C'est une demi-état : quelqu'un a produit le contenu sans
brancher les pages.

**Décision.** Brancher les 4 pages (et leur `generateMetadata`), **ou** supprimer le
bloc `legal.*`. **Ne pas supprimer sans décision** — c'est du contenu produit.

## D22 — Purger ~2 400 clés i18n mortes par locale (~4 800 l.)

**Constat.** 1 790 clés par locale, dont **~2 400 lignes** inutilisées.
Deux causes distinctes :

1. **L'i18n n'a jamais été migré sur les pages admin.** `admin.emailTemplates` (105),
   `admin.ateliers` (177), `admin.events` (118), `admin.mentoring` (44),
   `admin.emailDeliverability` (62), `admin.settings` (19), `admin.legal` (~457),
   `admin.keys` (30) — aucune de ces pages n'importe `next-intl`.
2. **Sections landing supprimées** : `landing.why`, `landing.pillars`,
   `landing.audience`, `landing.testimonial`, `landing.coming`.

Vérifié : aucune clé n'est accédée dynamiquement (`rg 't\([a-zA-Z_$]' src` → 0 cas
pertinent pour les namespaces listés), donc la purge est sûre.

**Méthode.** Script de vérification : pour chaque clé, `rg` sur `src/`. Supprimer par
namespace, pas à la main. **Relancer `scripts/check-messages.mjs` après chaque lot.**

**Dépend de :** D21 (pour ne pas supprimer `legal.*`).

## D23 — Corriger la documentation obsolète

| Fichier | Erreur |
|---|---|
| `README.md:78` | annonce `auth/request-magic-link`, `auth/verify-otp` — inexistants |
| `README.md:84,101` | annonce `admin/…/keys` et « rotation des clés » — supprimés |
| `README.md:110` | « OTP 15 min » — réel 5 min (D06) |
| `docs/audit-securite-2026-09-18.md:33-34` | déclare D02 « corrigé » — **faux** |
| `docs/audit-securite-2026-09-18.md:55` | « max 3 tentatives par session » — code actuel ne valide rien |
| `docs/audit-securite-2026-09-18.md:81` | référence `destroyAllSessions` (fonction morte) |
| `docs/espace-membre.md:85` | décrit `account-otp.ts`, `MemberSession`, cookie `hashcode_session` — supprimés |
| `docs/ateliers/00-audit-phase1.md:64,87,126` | décrit `prisma-extensions` comme branchée, `account-otp.ts` |
| `docs/ateliers/ARCHITECTURE.md:23-26` | documente 4 routes inexistantes (`POST /workshops`, `PUT/DELETE /workshops/[id]`, `/weeks`) |
| `docs/interface-utilisateur.md:16` | annonce Bun alors que la CI fait `npm ci` |
| `CONTRIBUTING.md:8` | annonce Better Auth « magic link, 2FA TOTP » — le 2FA n'existe pas |
| `CONTRIBUTING.md:27,150-151` | annonce Vitest — le projet utilise `node --test` |
| `CONTRIBUTING.md:5` | annonce Next.js 15 — c'est Next 16 |
| `CONTRIBUTING.md:61` | annonce `src/middleware.ts` — le fichier s'appelle `src/proxy.ts` (convention Next 16) |
| `CONTRIBUTING.md:185,204` | `DATABASE_URL` et `npm run check:i18n` — aucun des deux n'existe |

**Règle à ajouter au CONTRIBUTING.** Toute feature qui **ajoute** (clé i18n, dépendance,
script, route, modèle Prisma) doit **retirer ou justifier** ce qu'elle remplace. C'est la
seule règle qui aurait prevented 60 % de cette roadmap.

---

# PHASE 4 — Cohérence serveur

## D24 — `requireAdmin()` unifié : corrige le 401-vs-403 🔴

**Constat.** **53 sites de guard admin** dans 45 fichiers, avec **6 variantes de message**
pour le même refus :

| Style | Statut HTTP | Occurrences |
|---|---|---|
| `throw new AuthError("Non autorisé.", "UNAUTHORIZED")` | **401** | 17 |
| `throw new ForbiddenError("Accès refusé.")` | 403 | 23 |
| `return NextResponse.json({error:"Accès refusé."})` | 403 sans `code` | 8 |
| `return NextResponse.json({error:"Non autorisé."})` | 401 | 2 |
| `return NextResponse.json({error:"Unauthorized"})` (**EN**) | 401 | 1 |
| `{error:"…Rôle operator requis.", code:"FORBIDDEN"}` | 403 | 2 |

**Bug.** Un admin non autorisé reçoit **401 ou 403 selon la route**. Le client ne peut
donc pas distinguer « session expirée » de « droits insuffisants » — et les 30 détections
client (`res.status === 401 || code === "UNAUTHORIZED"`) traitent les deux comme
« session expirée » → **redirection vers `/?admin=1` alors que la session est valide**.

**Correctif.** Un `requireAdmin(req, role)` unique qui appelle `errorToResponse`.
Suppression ~150 lignes.

**Dépend de :** D18 (les tests doivent couvrir le nouveau contrat de statut).

**D24 — fait le 2026-10-06**

Le bug décrit plus haut était plus précis que « deux styles de refus » :
`requireAdminRole()` renvoyait un **booléen**, donc **aucune** des 28 routes
appelantes ne pouvait distinguer deux situations opposées. Une route operator
répondait la même chose pour « pas d'admin du tout » et pour « admin viewer ».

**Forme du garde** (`src/lib/admin-auth.ts`) :

```ts
export type AdminGuard =
  | { ok: true; role: AdminRole; email: string }
  | { ok: false; reason: "unauthenticated" | "insufficient_role" };
export async function requireAdmin(req, allowedRole?): Promise<AdminGuard>
```

Trois sorties, une seule résolution de session :
`requireAdmin()` (verdict), `adminGuardResponse()` (401 `AUTH_REQUIRED` /
403 `FORBIDDEN`, via `errors.ts`), `requireAdminOrThrow()` (même verdict levé en
`AppError`, pour les routes déjà dans un `try/catch` `errorToResponse`).

**Contrat HTTP** : `unauthenticated` → 401, `insufficient_role` → 403. Les 6
variantes de message du tableau ci-dessus ont disparu : le statut et le `code`
portent le sens, le message est uniforme.

**Non-régression** : `tests/admin-guard.test.cjs` (12 tests), dont un cas de bout
en bout sur `GET /api/admin/audit-log`. Le fichier échoue si `adminGuardError`
renvoie 401 pour les deux verdicts (bug réinjecté puis restauré, vérifié).

**Statuts corrigés** (28 routes). Le détail par route est dans le rapport de
session. En résumé : 17 routes renvoyaient 401 à un viewer sur une route
operator (client redirigé vers la connexion alors que sa session était valide) ;
6 routes renvoyaient 403 à un appel anonyme (client qui réessaie sur 401 en
boucle) ; le reste était correct et n'a pas bougé.

**Deux tests existants verrouillaient le bug** et ont été corrigés en
conséquence, pas contournés : `tests/integration.test.cjs` (403 → 401 sur
`audit-log` et `activity`, sans cookie) et `tests/e2e/workshop-gate.spec.ts`
(403 → 401 sur `GET /api/admin/workshops/[id]`). Voir la section « Tests
modifiés » du rapport.

**D28 — traité partiellement, sans élargir le périmètre.** Les 5 cas listés dans
D28 qui*tombaient dans le périmètre* D24 sont résolus par le fait que
`requireAdminOrThrow()` renvoie la session : plus de second `getAdminRole()` /
`getAdminIdentity()`. Restent hors périmètre : `admin/verify` (interroge
volontairement le rôle pour un client sans session), `members/[id]/invite` et
`export`, `export/json`, `events/[id]`, `events/route.ts` sur leurs handlers
d'écriture — à traiter dans D28.

## D25 — `adminQuery()` : factoriser le bloc 401/429

**Constat.** `src/components/reboot/admin/lib/fetchJson.ts` (43 l.) centralise le
**transport** mais pas la **décision**. D'où :
- `res.status === 401 || code === "UNAUTHORIZED"` : **29 occurrences**
- `res.status === 429 || code === "RATE_LIMITED"` : **16 occurrences** (7 en inline)
- **11 `handleSessionExpired` redéfinis** vers `/?admin=1` (17 occurrences, 9 fichiers)
- 3 stratégies divergentes pour le même cas : `router.push`, `window.location.href`,
  `window.location.assign`

**Pourquoi c'est le bon moment.** Avec D24, le statut HTTP devient fiable et un helper
unique devient possible. **Avant D24, ce refactor serait du code mort** — il propagerait
le bug 401/403.

**Correctif.** Un 10ᵉ paramètre `onUnauthorized` dans `fetchJson`, ou mieux : un wrapper
`adminQuery()` qui gère fetch + 401 + 429 + retry. Gain ≈ 200 lignes.

## D26 — Migrer les 33 routes restantes vers `errors.ts`

**Constat.** `errors.ts` est le module **le mieux appliqué** du dépôt (53 routes) et le
meilleur conçu — mais **33 routes font du `{error, code}` à la main** avec 2 syntaxes
divergentes. `admin/blacklist`, `admin/blacklist/[id]`, `admin/test-email`,
`admin/import-invite`, `admin/announce-dashboard`, `admin/email-deliverability` sont les
pire (0 import de `errors.ts`).

Bonus : le wrapper anti-double-enrichissement `if (err instanceof AppError) throw err;`
est dupliqué **6 fois** (`audit-log:105`, `email-log:190`, `export:203`,
`export/json:123`, `members:405`, `members/bulk:129`) — `errorToResponse` le fait déjà.
Et 8 routes ont des `try` imbriqués dont l'extérieur ne sert qu'à rappeler
`errorToResponse`.

**Dépend de :** D24 (un seul vocabulaire d'erreur).

## D27 — Corriger `SECTION_MAP` incomplet 🔴

**Constat.** `src/components/reboot/admin/AdminShell.tsx:26-38` (`SECTION_MAP`) couvre
**11 routes**, tandis que `AdminSidebar.tsx` déclare **14 items**.

**Manquants** : `/admin/ateliers`, `/admin/mentoring`, `/admin/email-templates`,
`/admin/blacklist`. Sur ces 4 pages, `activeSectionId` retombe sur `"section-stats"`.

**Impact.** Le menu affiche **« Vue d'ensemble »** alors que l'admin est sur « Ateliers ».
Navigation cassée sur 4 des 14 pages.

**Risque.** Nul — ajout de 4 entrées dans un objet.

## D28 — Supprimer la double résolution de session admin

**Constat.** `admin-auth.ts` expose 4 fonctions (`isAdminAuthed`, `getAdminRole`,
`getAdminIdentity`, `requireAdminRole`) qui **re-résolvent chacune** `resolveAdminSession`
→ `auth.api.getSession()` + parsing des 3 listes d'env.

> **D24 a traité 4 des 5 cas** (voir la note D24 ci-dessus) : `requireAdminRole`
> n'existe plus, et `requireAdminOrThrow()` renvoie `{email, role}`, ce qui a
> supprimé la seconde résolution dans `members/[id]` (PATCH),
> `members/[id]/invite`, `events/[id]` (PATCH, DELETE), `events/route.ts` (POST),
> `email-templates` (POST) et `email-templates/[key]` (PATCH).
> Restent : `admin/verify:11` + `:15` (cas particulier, voir plus bas) et
> `export`, `export/json` (jamais migrés — ils utilisent `isAdminAuthed`).
> `getAdminRole` / `getAdminIdentity` / `isAdminAuthed` sont toujours exportés
> pour ces appelants : **les supprimer est le cœur de D28.**

Séquences qui font **2× `getSession()`** par requête :
- `admin/verify:11` + `:15` — **à traité avec soin** : cette route sert
  justement à *dire* au client « session invalide » et à renvoyer le rôle. La
  fusionner en un seul appel est possible (`requireAdmin(req, "viewer")`) mais
  change la forme de la réponse : à trancher dans D28, pas dans D24.
- `export` + `export/json` : `isAdminAuthed` puis `getAdminRole`
- `members/[id]` GET : `isAdminAuthed` (le handler PATCH est déjà corrigé)

**Correctif.** Exposer un `resolveAdminSession(req)` public retourne `{email, role}`.
Suppression ~30 lignes et une requête DB par route touchée.

**Dépend de :** D24.

---

# PHASE 5 — Composition admin

## D29 — Faire composer `admin/dashboard` au lieu de copier (~395 l.)

**Constat.** `src/app/api/admin/dashboard/route.ts` (511 l., **41 appels `db.`**) est le
fichier le plus dense du dépôt. Ses 7 fonctions locales réimplémentent **6 endpoints qui
existent et sont déjà appelés** :

| Fonction locale | Doublon de | Lignes |
|---|---|---|
| `fetchStats` | `api/stats/route.ts:167-245` (mêmes 20 `db.member.count/groupBy`) | 60 |
| `fetchFunnel` | `api/analytics/route.ts:97-154, 237-284` | 65 |
| `fetchEmailEngagement` | `api/email-stats/route.ts:19-56` | 58 |
| `fetchEmailDeliverability` | `api/admin/email-deliverability/route.ts:46-153` | 87 |
| `fetchEmailOps` | `api/admin/email-ops/route.ts:53-114` | 59 |
| `fetchCronHealth` | `api/admin/cron-health/route.ts:30-55` | 28 |
| `fetchEmailAudience` | `api/admin/email-log/route.ts:203-223` | 19 |
| `CRONS` | `cron-health/route.ts:10-18` (**identique**) | 9 |
| `mergeBySource` | `stats/route.ts:12-23` (**identique**) | 10 |
| **Total dupliqué** | | **≈ 395 l. / 511** |

**Pourquoi c'est le pire point du dépôt.** C'est un **agrégateur qui n'agrège pas** : il
réimplémente au lieu de composer. Conséquence directe et quotidienne : **ajouter un champ à
`/api/stats` ne le propage pas au dashboard**. C'est la cause racine de la moitié de la
phase 3 (les chiffres faux) et de `D03`.

Le commentaire `EmailOpsSection.tsx:106-108` prétend « sans duplication de code de layout »
alors que `email-deliverability/page.tsx:235-292` reproduit `EmailOpsSection.tsx:120-186`
mot pour mot (≈ 105 l.).

**Correctif.** Extraire les 7 agrégats dans `src/lib/admin/aggregates.ts`, puis
`dashboard/route.ts` devient ~40 lignes de `Promise.allSettled`. Le design « isolation par
bloc » (ligne 470-476) se reproduit à l'identique.

## D30 — Extraire les 5 primitives UI partagées (~600 l.)

**Constat.** Aucun composant tableau partagé n'existe. Le seul primitif est
`ui/table.tsx` (wrapper sans comportement). Chaque tableau réinvente tout :

| Primitive | Implémentations | Lignes dupliquées |
|---|---|---|
| Barre de pagination | 4 | 75 |
| Champ recherche avec loupe | 6 (5 identiques) | 72 |
| État vide | 5 (**dont 2 dans le même fichier**) | 60 |
| Cellule membre (pastille + nom + email) | 3 | 135 |
| `StatusBadge` | **6** (2 **octet pour octet identiques**) | 47 |
| `RateBar` / `TrendBadge` / `formatPercent` | 3 / 2 / 3 | 124 |
| Page vs composant ops | — | 105 |
| `StatCard` | 3 | 92 |
| `queryError` / `memberName` / `formatDate` | **3 / 3 / 7** | 130 |

**Pourquoi 6 `StatusBadge`.** `ateliers/[id]/page.tsx:297-308` et
`ateliers/submissions/page.tsx:185-196` sont **identiques octet pour octet**.
`EmailOpsSection.tsx:60-83` ≡ `email-deliverability/page.tsx:139-152`.

**Le cas le plus instructif.** `MemberDetailDialog.tsx:18-46` redéfinit 29 lignes de
`DOMAIN_LABEL`, `LEVEL_LABEL`, `GOAL_LABEL`, `BUDGET_LABEL` alors que
`src/lib/profiling/labels.ts` les exporte et que **son commentaire dit explicitement**
« Shared between MemberTable, AdminStats, and any other consumer ». `MemberTable.tsx:22`
les importe bien — le fichier voisin, non. Et `"practicing"` a **3 libellés différents** :
« Pratiquant » (ateliers), « Pratique » (labels.ts, engine.ts, MemberDetailDialog).

**Dépend de :** D09.

## D31 — Extraire les helpers dupliqués (~130 l.)

`formatDate` **7 définitions**, `memberName` 3, `queryError` 3, `toLocalInput` 2,
`toISOStringLocal` 2, `parseStringArray` 2. Toutes recopiées dans les pages admin
ateliers/events.

Le module `components/reboot/events/format.ts` (133 l., 15 fonctions) **existe déjà**
mais n'est utilisé que par le sous-dossier `events/`. `src/lib/event-period.ts:33-47`
calcule `startOfWeek` à la main alors que `date-fns` est importé **dans le même dépôt**
(`api/stats/route.ts:4` importe littéralement `startOfWeek`).

## D32 — Migrer les 17 composants manuels vers `useQuery`

**Constat.** `@tanstack/react-query` est installé (`package.json:69`), le provider est
monté globalement (`app/providers.tsx:9-26`), et 4 pages admin l'utilisent déjà.
Mais **17 composants** font du `fetch` + `useState` + `useEffect` + `AbortController`
manuels — `new AbortController()` apparaît **11 fois** dans le seul admin.

`SessionDetailView.tsx` (753 l.) est le pire cas : **0 `useQuery`** alors que ses voisines
`/admin/ateliers*` l'utilisent. Même dossier, deux systèmes.

**Gain.** ~400 lignes supprimées + cache, déduplication de requêtes, annulation et retry
gratuits. `withRetryAfter` n'est importé que par 9 fichiers alors que le pattern
`429 || RATE_LIMITED` apparaît **16 fois** — 7 sites le réimplémentent en inline.

**Dépend de :** D25 (le helper d'abord, la migration ensuite).

---

# PHASE 6 — Décisions produit

> Ces 5 tâches **ne sont pas des décisions techniques**. Elles demandent un arbitrage
> produit. Les chiffrages sont là pour éclairer l'arbitrage.

## D33 — Trancher `?admin=1` 🔴 (~330 l.)

**Situation.** Les deux chemins coexistent et se redirigent mutuellement :
- `src/app/[locale]/page.tsx:72` appelle `/api/admin/verify` quand `?admin=1`.
- `:93-97` redirige vers `/admin` via `window.location.assign` une fois authentifié.
- `src/components/reboot/admin-login.tsx` (401 l., **12 `useState`**, 5 `useEffect`,
  script Turnstile chargé à la main en 25 lignes) sert **uniquement** ce chemin.
- `src/app/[locale]/admin/` existe déjà comme vraie route, avec son layout serveur
  (`admin/layout.tsx:23-29`) qui porte la vraie garde d'accès.

→ Le formulaire de login admin **n'existe que sur une URL qui n'a aucune raison
d'exister**, en doublon de `/login` (qui utilise Better Auth).

**Options.** (a) Supprimer `admin-login.tsx` + la branche `admin-login`/`admin` de
`page.tsx` → −330 l. (b) Supprimer `/admin` comme route et assumer `?admin=1` → mais la
garde serveur du layout est plus sûre. **Recommandation : (a).**

## D34 — Trancher le magic-link onboarding 🔴 (~570 l.)

**Constat.** `src/lib/verify-email.ts` (206 l.) + `/api/verify-email` (107 l.) + page
`/verify-email` (127 l.) + `not-found.tsx` (42 l.) + `email-verify-card.tsx` (90 l.)
= **~570 lignes** pour un flag que **personne ne lit** :

```
grep isEmailVerified → verify-email.ts:190 (définition) — 0 appelant dans src/
```

`confirmEmailLink` écrit une clé Redis `verify-email:verified:<email>` avec TTL 30 jours
(`verify-email.ts:171`) **pour rien**. `Member.emailVerified` **n'existe pas** dans le
schéma Prisma → **l'état « email vérifié » n'existe nulle part dans le produit**.

Le parcours `/verify-email` est un cul-de-sac décoratif : il affiche « c'est bon »,
l'utilisateur est redirigé vers `/`, et rien ne change pour lui.

**Options.** (a) Brancher `isEmailVerified` sur une règle métier réelle (et l'ajouter au
schéma + aux exports RGPD). (b) Supprimer les ~570 lignes. **Recommandation : (b)**,
sauf si la vérification d'email est un engagement produit — auquel cas c'est un chantier,
pas un nettoyage.

**Attention.** D02 touche les mêmes routes (`invite/accept`, `invite/refuse` écrivent
aussi via `verify-email.ts`). **Traiter D34 avant de fermer D02**, ou vérifier
l'interaction.

## D35 — Réaligner `SessionReminder` (355 l.)

**Constat.** Le composant alerte « session bientôt expirée » et affiche une page
« session expirée » qui redirige vers `/?admin=1` — **après 12 heures**
(`session-reminder.tsx:17`, `SESSION_MS = 12 * 60 * 60 * 1000`).

Or `src/lib/auth/index.ts:38` déclare `expiresIn: 60 * 24 * 60 * 60` = **30 jours**.

**Impact.** 355 lignes qui **interrupt l'admin avec un faux positif 12 h après chaque
login**, alors que sa session est parfaitement valide.

**Corollaire.** `admin/settings/page.tsx:31` teste `res.status === 401` sur
`/api/admin/verify` — qui répond **toujours 200** (`admin/verify:12-16`) → branche morte.
Et `:37-39` lit `identity` / `expiresAt` que la route **ne renvoie pas** → deux tuiles
affichées en permanence `—`.

**Options.** (a) Supprimer les 355 lignes. (b) Aligner `SESSION_MS` sur la durée réelle
(peut-être 12 h de *confort*, à'intégrer dans le design). (c) Faire renvoyer `expiresAt` par
`/api/admin/verify` et piloter le rappel sur la vraie expiration.

## D36 — Supprimer les tables et colonnes mortes (~60 l. de schéma)

**Modèles orphelins :**

| Modèle | Preuve de mort |
|---|---|
| `MemberSession` | **0 créateur applicatif** (seul `scripts/import-direct.mjs:369`). 4 lecteurs → toujours vides |
| `AdminKey` | **0 accès `db.adminKey`** dans tout le repo |
| `RateLimit` | **0 accès** — le rate limiting est Redis (`rate-limit.ts:114-145`). Pas même de `CREATE TABLE` |

**Conséquences de `MemberSession` vide :**
- `invite/accept:107` et `invite/refuse:96` : `updateMany` → toujours 0 ligne.
- `api/account/export:79` : `sessions: []` systématique (violation RGPD d'exhaustivité).
- **`admin/activity-logins:47` : le DAU admin vaut toujours 0.**

**Colonnes mortes après migration Better Auth :**
- `Member.userEmail` (`schema:81`) — le lien réel est `User.email` ↔ `Member.email`.
- `User.memberEmail` (`schema:130` + `@@index`) — jamais utilisée ; les seules occurrences
  de `memberEmail` sont des homonymes (`MemberEmailLog.memberId`, paramètres de fonctions
  mail, colonne CSV).
- `MemberSession.otpHash`, `.attempts`, `.lastSeenAt`, `.revokedAt`.

**Colonnes Better Auth standard non supprimables** (structure imposée) : `Account.*Token`,
`.scope`, `Verification.userId` — aucun fournisseur OAuth n'est configuré, mais Better Auth
les attend dans son schéma.

**⚠️ Dépend de D07.** Supprimer un modèle sans migration de référence casse la
reproductibilité. **D07 d'abord.**

**Note.** `admin.settings.keys` (30 clés i18n FR + 30 EN) et `README.md:84,101`
référencent encore la rotation de clés supprimée → à purger en D22 et D23.

## D37 — Trancher le ticket phone-fill (~132 l.)

**Constat.** `src/lib/phone-fill-ticket.ts` (87 l.) + `api/account/phone/route.ts`
(45 l.). Le design est **correctement écrit** (HMAC, `timingSafeEqual`, domination de
chaîne, anti-énumération) — mais la fonctionnalité est **inerte pour 2 raisons
indépendantes** :

1. **Le proxy la bloque.** `src/proxy.ts:44-53` renvoie 401 pour tout `/api/account/*`
   sans cookie `better-auth.session_token`. Or `api/account/phone/route.ts:21-27`
   documente être « volontairement appelable SANS session », et l'appelant est
   `welcome.tsx:243` — donc forcément sur un membre **sans** session.
2. **La clé de secours n'existe pas.** `phone-fill-ticket.ts:37` :
   `process.env.PHONE_FILL_SECRET || process.env.DATABASE_URL || ""`. Or le schéma
   utilise `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING`, et `.env.example:76-78`
   ne définit **pas** `DATABASE_URL`.

→ Sans `PHONE_FILL_SECRET` (commenté dans `.env.example:107`), `getKey()` → `null` →
`issuePhoneFillTicket` → `null` → la route répond `{ok:true}` **sans rien écrire**.

**Options.** (a) Brancher : ajouter `PHONE_FILL_SECRET` à `.env.example`, exempter la
route du guard `/api/account/*` dans `proxy.ts`. (b) Supprimer 132 l.

## D38 — Réactiver des règles ESLint désactivées

**Constat.** `eslint.config.mjs` est **dans sa quasi-totalité une liste de `off`** :
- 6 rules TS désactivées (`:12-17`) — dont `@typescript-eslint/no-explicit-any`
- 6 rules React/hooks désactivées (`:20-25`) — dont **`react-hooks/exhaustive-deps`**
- 2 rules Next (`:28-29`)
- **13 rules JS de base désactivées** (`:32-44`) : `no-undef`, `no-unreachable`,
  `no-empty`, `no-fallthrough`, `no-case-declarations`, `prefer-const`…

**Conséquence.** `npm run lint` passe **sans rien vérifier** sur le JS/TS. C'est
directement responsable de la détection tardive de `blurred` sans effet
(`views.tsx:93`), du `skills_check:` étiqueté vide (`workshop-validation.ts:294`) et des
variables mortes non signalées.

**⚠️ Prérequis.** Réactiver ces règles fera probablement échouer le lint sur des
centaines d'occurrences. **À faire APRÈS les phases 1-5**, sinon on noie le signal.
Réactiver d'abord `no-undef`, `no-unreachable`, `no-empty`, `no-fallthrough` (les moins
bruyants), laisser `exhaustive-deps` pour la fin (coûteux sur un projet React 19).

**Point positif.** Le reste du fichier est propre et sans sur-configuration — ne pas
toucher.

---

# Annexe D — Correctifs trouvés pendant l'exécution

## D39 — 🔴 13 URLs vers le mauvais domaine (trouvé pendant D02)

**Constat.** Deux domaines coexistaient : `https://reboot.joinhashcode.com`
(correct, utilisé partout) et `https://joinhashcode.com` (sans le sous-domaine).

13 occurrences réparties sur 4 fichiers, dont **2 fallbacks de production** :

```ts
// src/app/api/events/route.ts:277  et  src/app/api/events/[id]/route.ts:148
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://joinhashcode.com";
const rsvpUrl = `${siteUrl}/dashboard/agenda`;   // → part dans les emails
```

**Impact.** Si `NEXT_PUBLIC_SITE_URL` est absent de l'environnement (le cas sur
beaucoup de déploiements), les emails de notification d'événement pointent vers un
domaine qui n'est pas celui de l'application. Les liens sont cassés, silencieusement.

Les 11 autres occurrences étaient des valeurs d'aperçu / d'exemple
(`email-templates/registry.ts`, `seed-email-templates.ts`) : impact limité à la
lisibilité des aperçus dans l'interface admin, mais elles documentaient la mauvaise
URL.

**Correctif.** Les 13 occurrences corrigées. Vérifié : `rg 'https://joinhashcode\.com'`
→ 0 résultat.

**Leçon.** Un défaut de base (`NEXT_PUBLIC_SITE_URL`) est silently compensé par un
fallback codé en dur — et ce fallback a divergé du reste du code. Les fallbacks
« de sécurité » qui évitent une erreur d'auth deviennent souvent des fautes
silencieuses. À traiter en D23 : imposer `NEXT_PUBLIC_SITE_URL` dans `.env.example`
avec une valeur unique, et éviter les fallbacks codés en dur sur les URLs publiques.

---

# Annexe A — Récapitulatif chiffré

| Catégorie | Lignes |
|---|---|
| Composants `ui/` shadcn morts (35 sur 48) — D09 | **~4 340** |
| Clés i18n mortes (× 2 locales) — D22 | **~4 800** |
| Duplication dans les pages géantes — D29, D30, D31 | **~3 666** |
| Ateliers / profiling (code mort + miroirs) — D14, D18 | **~3 521** |
| Scripts, docs et fichiers orphelins — D15 | **~2 500** |
| Sous-système email — D03, D04 | **~1 154** |
| Suppressions diverses — D11, D12, D13, D17 | **~735** |
| Duplication `admin/dashboard` — D29 | **~260** |
| Décisions produit — D33, D34, D35, D37 | **~1 437** |
| **Total** | **~18 700 (33 % de `src/`)** |

# Annexe B — Ce qu'il ne faut PAS casser

Ces éléments sont surdimensionnés *en apparence* mais sont **justifiés**. Les supprimer
serait une régression.

| Élément | Pourquoi il est justifié |
|---|---|
| `src/lib/errors.ts` (171 l.) | Le module le mieux appliqué du dépôt (53 routes). Le regrettable est que 33 routes ne l'utilisent pas. |
| `src/lib/admin-auth.ts` | Point d'entrée unique, fail-closed, décision de sécurité documentée. |
| `src/lib/events-timezone.ts` (288 l.) | Table de 126 pays → zones IANA. Aucun équivalent ailleurs. |
| `src/lib/rate-limit.ts` | Le mieux utilisé du lot (51 routes). |
| `src/lib/db.ts` (18 l.) | Singleton Prisma standard, ~60 consommateurs. |
| `src/lib/test-guard.ts`, `body-limit.ts` | Petits (27/32 l.), mais 28 et 12 usages. |
| `src/lib/logging.ts` | 2 consommateurs, mais irremplaçable pour les webhooks. |
| `motion/primitives.tsx` (377 l.) | 9 primitives / 10 consommateurs = ratio sain. Seul `Scale` (31 l.) est mort. |
| `workshop-quiz.ts` (`sameSet`, `answerToSet`) | 20 lignes de normalisation d'ensemble trié, correctement justifié (rend le scoring insensible à l'ordre). Fail-closed = vrai choix de sécurité (ADR-004). |
| `profiling/engine.ts` (scoring) | **Aucune sur-ingénierie algorithmique** : tout est linéaire, n ≤ 17. |
| Décision de ne pas utiliser de librairie de graphing | 3 donuts + 2 séries de barres ne justifient pas 60 Mo. `recharts` doit partir, pas le SVG. |
| `components/reboot/landing.tsx` + `landing/` (19 fichiers) | **Le bon pattern à reproduire** : orchestrateur + sections. |
| `eslint.config.mjs` (hors rules `off`) | Propre et sans sur-configuration. |
| Comparaisons de secrets en `timingSafeEqual` | 9 occurrences (5 crons, Brevo, HMAC, OTP). Aucun `===` sur un secret. **Point le plus solide du dépôt.** |

# Annexe C — Ce qui est sain et mérite d'être lu

L'audit a trouvé autant de bonnes décisions que de problèmes. Les citer évite qu'un
refactor les détruise par inadvertance :

- Le **coupe-circuit blacklist** dans `databaseHooks.session.create.before`
  (`auth/index.ts:53-60`) — fail-closed, sans capture d'erreur. Correct.
- L'**anti-énumération** du parcours OTP (`auth/index.ts:68-75`) : le silence sur email
  inconnu est volontairement identique au blacklisté.
- Le **proxy fail-closed** sur `/admin` (`admin/layout.tsx:23-29`) : une session membre
  valide mais non-admin est redirigée, jamais servie.
- La **table de delivery** (`admin/workshops/stats/route.ts:72-146`) : 13 `db.*` en
  `Promise.all` avec dédup par `groupBy` — le bon pattern pour des agrégats.
- Le **`tableView`-style de session access** : les 3 codes (`NOT_FOUND`,
  `NOT_ENROLLED`, `SESSION_LOCKED`) sont un retour machine correct.
- Les **4 ADRs ateliers** (`docs/ateliers/adr/`) sont rédigés correctement et explicitent
  les décisions — dont celle qui explique pourquoi 9 validateurs sont morts (D14).
