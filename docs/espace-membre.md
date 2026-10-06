# Espace membre — fonctionnel complet

> Oui : après une inscription validée, le membre est invité à se connecter à
> son espace (`/dashboard`). Ce document décrit **comment il y entre** et
> **tout ce qu'il peut y faire**. Inventaire initial au 2026-09-09, **mis à jour
> le 2026-10-06** : les énoncés devenus faux ont été corrigés (chemins,
> session, OTP). L'espace a gagné depuis deux sections — **Ateliers**
> (`/dashboard/ateliers`) et **Mentoring** (`/dashboard/mentoring`) — qui ne
> sont pas décrites ici.

## 1. Comment le membre est invité à se connecter

Quatre chemins mènent à l'espace, selon la situation :

| # | Chemin | Déclencheur | Contenu de l'invitation | Validité |
|---|---|---|---|---|
| 1 | Self-service | Le membre va sur `/login` et saisit son email | Email « Ton code de connexion HASHCODE » : **code à 6 chiffres + bouton 1-clic** (`/verify-otp?email=…&code=…&next=/dashboard`) | 15 min (`expiresIn: 900` s) |
| 2 | Après vérification | Code correct sur `/verify-otp` | Session Better Auth créée, cookie `better-auth.session_token` HttpOnly | 30 j, sliding window `updateAge` 1 h |
| 3 | Validation admin | Passage `PENDING → APPROVED` par un admin | Email « Tu es validé dans HASHCODE » : **lien direct WhatsApp + encadré « Nouveau : ton espace membre » → bouton « Voir mon dashboard »** (`/login`) + lien vers `/account` | Liens permanents (pas d'OTP) |
| 4 | Campagne de rattrapage | Admin lance `POST /api/admin/announce-dashboard` (dry-run par défaut, lots de 15-25, 250 ms entre envois) | Email « Nouveau : ton espace membre HASHCODE est en ligne » : **lien magique 1-clic** (`/verify-otp?...&next=/dashboard`), repli `/login` si expiré | 72 h |

Notes :
- Les emails `WAITLIST` / `REJECTED` renvoient vers `/account` uniquement (pas `/dashboard`).
- `/login` accepte `?next=` (anti open-redirect : chemins `/` relatifs uniquement), défaut `/dashboard`.
- Sans session : middleware + layouts redirigent vers `/login?next=…`.

## 2. Structure de l'espace

Sidebar (desktop pliable, drawer mobile) : **Vue d'ensemble** (`/dashboard`),
**Agenda** (`/dashboard/agenda`), **Mon profil** (`/dashboard/profile`),
**Paramètres** (`/dashboard/settings`), lien **WhatsApp** externe,
**Déconnexion**. Top-bar : logo, prénom, déconnexion.

## 3. Page par page — ce que le membre peut faire

### `/dashboard` — Vue d'ensemble (lecture + 2 actions)
- **Affiche** : `Bonjour {prénom}` + archétype + badge de statut ; cartes
  **Profil** (Validé / En attente / Liste d'attente / Non retenu),
  **Communauté** (Pas encore invité / Invité / Inscrit), **Accès**
  (Immédiat / En attente) ; résumé profil (domaine, niveau, objectif,
  dispo, ville, tags) ; mini-agenda (5 prochains events) ; « Membre depuis… ».
- **Actions** :
  - **Rejoindre WhatsApp** (bouton mis en avant tant que `JOINED` n'est pas atteint, sinon carte simple) → ouvre le groupe.
  - **Modifier mon profil** → `/dashboard/profile`.
  - **Bandeau WhatsApp** si aucun numéro enregistré → `/dashboard/settings`
    (« Ajoute ton WhatsApp… 10 secondes »).

### `/dashboard/agenda` — Agenda + RSVP (le cœur interactif)
- **Affiche** : événements à venir groupés par date (badges type/domaine/niveau,
  description, date longue + durée, lieu, récurrence, compteur d'inscrits,
  badge `EN DIRECT`, lien externe éventuel).
- **Actions** :
  - **Filtrer** par type (Sessions / Workshops / Meetups) et domaine (Web / Cyber / AI).
  - **RSVP** sur chaque session planifiée : `Je participe` / `Peut-être`
    (toggle : re-cliquer annule). Contrôle de capacité et de date côté API.

### `/dashboard/profile` — Vitrine + objectif + partage
- **Affiche** : vitrine membre, résumé profil, statut (mêmes cartes que l'accueil).
- **Actions** :
  - **Objectif à 3 mois** (`GoalEditor`) : suggestions 1-clic, textarea
    (4-280 caractères, compteur), `Enregistrer` → `PATCH /api/account/profile`.
  - **Profil public** (`ShareProfile`) : voir `/profile/{id}` (carte publique
    sans email/téléphone/statuts), **copier le lien** de partage.

### `/dashboard/settings` — Coordonnées + compte + session
- **Actions** :
  - **Coordonnées** (`ContactForm`) : nom (facult.), **WhatsApp** (format
    international), ville (facult.), **genre** (Ne pas préciser / Homme /
    Femme / Autre / Préfère ne pas dire), objectif 3 mois. `Enregistrer`
    actif uniquement si modifié ; `PATCH /api/account/profile`
    (anti-abus 10/10 min). Email et prénom **non modifiables**.
  - **Se déconnecter** (cet appareil) → `POST /api/auth/logout` → `/login`.
- **Lecture seule** : email, pays, « Membre depuis ». Changement d'email ou
  suppression de compte : via WhatsApp (pas de self-service).

### `/account` — redirect permanent vers le dashboard
Ancienne page historique : redirige vers `/dashboard/settings`.
Son contenu unique (prochaines étapes personnalisées par archétype) vit
désormais sur `/dashboard` (Vue d'ensemble). Les emails pointant encore vers
`/account` suivent le redirect automatiquement.

## 4. Ce que le membre ne peut PAS faire (choix produit)
- Changer son email seul (contact WhatsApp requis).
- Supprimer son compte seul (contact WhatsApp requis).
- Voir/modifier les profils des autres (seule sa carte publique `/profile/[id]` est partageable).
- Créer des événements (réservé admin `operator`).

## 5. Références code

> Les chemins ci-dessous ont été corrigés le 2026-10-06 : les pages vivent sous
> `src/app/[locale]/` (migration i18n) et l'authentification est celle de Better
> Auth. `src/lib/account-otp.ts` et le cookie `hashcode_session` n'existent plus.

- Auth : `src/lib/auth/index.ts` (config Better Auth, plugin `emailOTP`,
  `expiresIn: 900`), `src/lib/auth/client.ts`, `src/lib/account-auth.ts`
  (`getSession()`, wrapper de compatibilité), `src/lib/use-member-session.ts`
  (sonde client), `src/lib/blacklist.ts`. Garde de session :
  `src/proxy.ts` (ex-`middleware.ts`, convention Next 16).
  Layouts : `src/app/[locale]/dashboard/layout.tsx`,
  `src/app/[locale]/account/page.tsx`.
- Invitations : `src/lib/mail.ts` (`sendMagicLinkEmail`, `sendStatusChangeEmail`,
  `sendDashboardInviteEmail`, `sendInviteRelanceEmail`),
  `src/app/api/admin/announce-dashboard/route.ts`, `src/app/api/invite/relance/route.ts`.
- UI : `src/app/[locale]/dashboard/_components/*`,
  `src/app/[locale]/dashboard/{agenda,profile,profile-complet,settings}/page.tsx`,
  `src/app/[locale]/account/_components/ContactForm.tsx`.
- APIs : `src/app/api/auth/*` (dont `[...betterAuth]` pour l'OTP),
  `src/app/api/account/*`, `src/app/api/events*`.
