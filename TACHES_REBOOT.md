# 📋 Plan d'intégration — HASHCODE REBOOT

> **Plan de septembre 2026 (annoté le 2026-10-06).** Liste ordonnée,
> dédoublonnée, avec dépendances explicites. Chaque tâche = **un
> commit/PR atomique** (conventional commits). La plupart de ces tâches sont
> livrées ; les listes de fichiers et de commandes ci-dessous ont été alignées
> sur le dépôt (`npm` et non `bun`), mais les noms de fichiers cités
> antérieurs à la migration i18n (`src/app/admin/*`, `src/middleware.ts`) sont
> périmés. Ce fichier est identifié comme résidu racine à supprimer (D15 dans
> `docs/ROADMAP-SUR-INGENIERIE-2026.md`) : s'y référer pour l'historique, pas
> pour l'état courant.

---

## 🔴 P0 — Bloquants (débloquent des parcours utilisateur)

### T01 — `POST /api/account/complete-profile` — API confirmation profil importé
**Dépend de :** rien  
**Bloque :** `/dashboard/profile-complet` (page existante, POST vers endpoint inexistant)  
**Fichiers à créer :**
- `src/app/api/account/complete-profile/route.ts`
**Spéc :**
- Auth : session membre obligatoire (middleware existant)
- Body Zod : `firstName`, `lastName?`, `phone?`, `country`, `city?`, `primaryDomain`, `level`, `goal`, `availability`, `learningStyle`, `mentoringInterest`, `threeMonthGoal` (min 4 chars)
- Reprend la logique `runAutoControls` + `generateProfile` + `sendVerificationLinkEmail` + `sendWelcomeEmail`/`sendWaitlistEmail` selon `accessLane`
- Retourne `{ ok: true, profileStatus, accessLane, archetype }` ou erreurs 422/403
- Guard `blockIfTesting()` + rate-limit

---

### T02 — `/dashboard/mentoring` — Page membre mentorat (squelette fonctionnel)
**Dépend de :** T01 (optionnel, pour cohérence)  
**Bloque :** lien "Votre mentorat" dans `/dashboard` (404 actuel)  
**Fichiers à créer :**
- `src/app/dashboard/mentoring/page.tsx` (Server Component)
- `src/app/dashboard/mentoring/_components/MentorshipCard.tsx` (Client)
- `src/app/dashboard/mentoring/_components/MentorshipSessions.tsx` (Client)
- `src/lib/mentoring.ts` (helpers lecture `Mentorship` + `MentorshipSession`)
**Spéc :**
- Récupère `Mentorship` où `menteeId = session.member.id` + `status = ACTIVE`
- Affiche : mentor (nom, domaine), fréquence, date début, prochaine séance
- Si pas de mentorat actif → état vide CTA "Demander un mentor" (ouvre modal/contact WhatsApp)
- Historique séances passées (rating, notes)
- Réutilise `AccountHeader`, `MonoLabel`, `RebootButton`

---

## 🟡 P1 — Ateliers : Frontend Membre (3-4 pages)

### T03 — `/dashboard/ateliers/[slug]` — Détail atelier (semaines + séances)
**Dépend de :** rien (API `GET /api/workshops/[slug]` existe)  
**Fichiers à créer :**
- `src/app/dashboard/ateliers/[slug]/page.tsx` (Server Component → `getWorkshopWithProgress`)
- `src/app/dashboard/ateliers/[slug]/_components/WeekAccordion.tsx`
- `src/app/dashboard/ateliers/[slug]/_components/SessionRow.tsx`
**Spéc :**
- Charge workshop + progression membre (dérivée serveur via `workshop-progression.ts`)
- Liste semaines → séances avec état (LOCKED/NOT_STARTED/IN_PROGRESS/…)
- CTA par séance : "Continuer" → `/sessions/[sessionId]` si débloquée, sinon badge verrou + date unlock
- Affichage `unlockOverride` (admin) + `scheduledAt` (gate calendaire)

### T04 — `/dashboard/ateliers/[slug]/sessions/[sessionId]` — Détail séance
**Dépend de :** T03  
**Fichiers à créer :**
- `src/app/dashboard/ateliers/[slug]/sessions/[sessionId]/page.tsx`
- `src/app/dashboard/ateliers/[slug]/sessions/[sessionId]/_components/ActivityList.tsx`
- `src/app/dashboard/ateliers/[slug]/sessions/[sessionId]/_components/DeliverableCard.tsx`
- `src/app/dashboard/ateliers/[slug]/sessions/[sessionId]/_components/QuizCard.tsx`
**Spéc :**
- Onglets : **Activités** (liste), **Livrable** (soumission + historique), **Quiz** (tentatives + score)
- Si `deliverableRequired` → zone drop/URL + bouton "Soumettre" (POST `/api/workshops/sessions/[id]/submissions`)
- Si `quizRequired` → bouton "Passer le quiz" → `/quiz` (T05)
- Affiche état progression séance + feedback dernier review si `REVISION`/`REJECTED`

### T05 — `/dashboard/ateliers/[slug]/sessions/[sessionId]/quiz` — Passage quiz
**Dépend de :** T04  
**Fichiers à créer :**
- `src/app/dashboard/ateliers/[slug]/sessions/[sessionId]/quiz/page.tsx` (Client)
- `src/components/reboot/workshop/QuizPlayer.tsx`
**Spéc :**
- Charge questions via `GET /api/workshops/quizzes/[id]` (projection `publicQuestions()` — pas de `correctJson`)
- UI : une question à la fois, navigation, timer optionnel
- Soumission → `POST /api/workshops/quizzes/[id]/attempts` → affiche score + passed/failed
- Si `passed` + `deliverableRequired` déjà validé → séance = `COMPLETED`

---

## 🟡 P1b — Compléments Ateliers (petits)

### T06 — `/verify-email/not-found.tsx` — Fallback SSR token invalide
**Dépend de :** rien  
**Fichier :** `src/app/verify-email/not-found.tsx`  
**Spéc :** Page statique "Lien expiré" + bouton "Retour à HASHCODE" + lien "Demander un nouveau lien" → `/dashboard/settings`

### T07 — Seed ateliers complet (structure pédagogique)
**Dépend de :** rien  
**Fichier :** `scripts/seed-workshops-full.ts` (extension de `seed-github-workshop.ts`)  
**Spéc :** Crée 1 workshop complet (3 semaines, 12 séances, activités, livrables, quiz) pour démo/dev

---

## 🟢 P2 — Internationalisation (i18n)

### T08 — Configuration `next-intl` + routage `[locale]`
**Dépend de :** rien  
**Fichiers :**
- `src/i18n.ts` (config)
- `middleware.ts` (détection locale, redirect `/` → `/fr`)
- `src/app/[locale]/layout.tsx` (wrapper)
- Restructure `src/app/*` → `src/app/[locale]/*`
**Locales :** `fr` (défaut), `en`

### T09 — Messages FR + EN (extraction)
**Dépend de :** T08  
**Fichiers :**
- `messages/fr.json` (tous les labels actuels)
- `messages/en.json` (traduction)
**Outil :** script d'extraction `scripts/extract-messages.ts` (grep `text-` / `MonoLabel` / strings JSX)

### T10 — Migration composants → `useTranslations()`
**Dépend de :** T09  
**Passer par :** `src/components/reboot/*`, `src/app/dashboard/*`, `src/app/admin/*`  
**Stratégie :** 1 namespace par feature (`landing`, `profiling`, `dashboard`, `admin`, `workshops`, `auth`, `common`)

---

## 🟢 P2b — Documentation

### T11 — `docs/espace-membre.md` — Documentation complète membre
**Contenu :** Parcours auth, dashboard, profil, agenda, ateliers, paramètres, RGPD, FAQ

### T12 — `docs/interface-utilisateur.md` — Inventaire exhaustif UI
**Contenu :** Toutes les pages, composants, états, resp. breakpoints, accessibilité

### T13 — `docs/ateliers/00-audit-phase1.md` → `docs/ateliers/README.md`
**Action :** Déplacer/aider la doc ateliers existante (réf. dans `schema.prisma` ligne 471) vers `docs/ateliers/`

---

## 🟢 P3 — Tests E2E Playwright

### T14 — Scénarios critiques (happy paths)
| Scénario | Fichier test |
|----------|--------------|
| Inscription complète (landing → profiling → résultat) | `tests/e2e/signup.spec.ts` |
| Connexion OTP + lien magique | `tests/e2e/auth.spec.ts` |
| Dashboard → profil → agenda RSVP | `tests/e2e/dashboard.spec.ts` |
| Admin login → membres → action groupée | `tests/e2e/admin-members.spec.ts` |
| Atelier : inscription → séance → livrable → quiz | `tests/e2e/workshops.spec.ts` |

### T15 — CI GitHub Actions
**Fichier :** `.github/workflows/e2e.yml`  
**Spéc :** `npm ci` → `npm run build` → `npm run start` (background) → `playwright test` → upload report

> **Réalisé, mais dans un seul workflow** : `.github/workflows/ci.yml` porte
> aujourd'hui les deux jobs (`validate` puis `e2e`), et installe avec
> `npm ci` + `cache: npm`. Il n'y a pas de `e2e.yml` séparé.

---

## 🟢 P4 — Pages légales

### T16 — Pages statiques + liens footer
**Fichiers :**
- `src/app/[locale]/mentions-legales/page.tsx`
- `src/app/[locale]/cgu/page.tsx`
- `src/app/[locale]/confidentialite/page.tsx`
- Mise à jour `SiteFooter` + `PrivacyModal` avec liens

---

## 🔵 P5 — Refonte Auth Admin (post-V1)

### T17 — Migration vers Better Auth / NextAuth
**Dépend de :** P0-P4 terminées, déploiement stable  
**Étapes :**
1. Ajouter `better-auth` + adapter Prisma
2. Créer modèles `AdminUser`, `AdminSession` (remplace `AdminKey`)
3. Routes `/api/auth/*` (signin, callback, signout)
4. Middleware `requireAdminRole` → `getServerSession`
5. UI `/admin/login` → formulaire email/mot de passe + 2FA (TOTP)
6. Migration données : passcode → comptes nominatifs (invitation unique)
7. Supprimer `admin-passcode.ts`, `admin-auth.ts`, `admin-roles.ts`

---

## 📦 Ordre d'exécution recommandé

```
P0:  T01 → T02
P1:  T03 → T04 → T05 → T06 → T07
P2:  T08 → T09 → T10 → T11 → T12 → T13
P3:  T14 → T15
P4:  T16
P5:  T17 (ultérieur)
```

---

## ✅ Definition of Done par tâche

- [ ] Code + types TypeScript stricts (`tsc --noEmit` passe)
- [ ] ESLint vert (`npm run lint`)
- [ ] Tests unitaires si logique métier (`npm run test:unit`)
- [ ] Test intégration read-only si API (`npm run test:integration`)
- [ ] Build réussi (`npm run build`)
- [ ] Pas de régression visuelle (vérif manuelle ou Playwright)
- [ ] Commit message conventional : `feat(scope): ...` / `fix(scope): ...` / `docs: ...`

---

## 🏷️ Labels GitHub suggérés

| Label | Tâches |
|-------|--------|
| `p0-blocking` | T01, T02 |
| `p1-workshops-fe` | T03, T04, T05 |
| `p1-complement` | T06, T07 |
| `p2-i18n` | T08, T09, T10 |
| `p2-docs` | T11, T12, T13 |
| `p3-e2e` | T14, T15 |
| `p4-legal` | T16 |
| `p5-auth-refactor` | T17 |

---

## 🚀 Commandes utiles

```bash
# Vérif complète avant push
npm run validate          # typecheck + lint + check:test-wiring + test:unit

# Tests intégration (read-only, safe prod DB)
npm run test:integration

# Build production (Vercel)
npm run vercel-build

# Dev local
npm run dev
```

---

> **Note :** Ce plan couvre 100% des manques identifiés dans l'audit.  
> Chaque tâche est dimensionnée pour tenir en **1 commit/PR** reviewable.