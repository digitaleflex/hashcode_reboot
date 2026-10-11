# Auth Admin — comptes nominatifs + 2FA (Better Auth)

> **Statut** : implémenté (migration `20261011000000_add_admin_auth`).
> Remplace le passcode partagé (`AdminKey`).

---

## 1. Pourquoi

L'ancien système reposait sur **un passcode partagé** connu de toute
l'équipe (`AdminKey`) : non révocable individuellement, sans 2FA, sans
traçabilité nominative. Même après la transition vers Better Auth pour les
membres, `/admin` s'appuyait encore sur `Member.adminRole` + un cookie membre.

Le nouveau système donne à chaque admin :

| Avant | Après |
|-------|-------|
| Passcode partagé | Compte nominatif email + mot de passe (scrypt) |
| Aucune 2FA | 2FA TOTP **optionnelle** (désactivée par défaut, activable par l'admin) |
| Rôle sur `Member.adminRole` | `AdminUser.role` (`operator` / `viewer`) |
| Sessions non révocables individuellement | `AdminSession` par appareil, révocable |
| Partage du secret par email/chat | Invitation nominative par email (jeton 7 j) |
| Audit : `AdminKey.createdBy` seul | Audit par action (`admin.role-change`, `admin.invite`…) |

---

## 2. Architecture

```
                    ┌─────────────────────────────────────────┐
   POST /api/admin-auth/* │  Better Auth ADMIN (instance #2)     │
   ◄──────────────────────│  src/lib/auth/admin.ts               │
   cookie                 │  cookiePrefix: "hashcode-admin"      │
   hashcode-admin.        │  modèles: AdminUser/AdminSession/     │
   session_token          │  AdminAccount/AdminVerification/      │
                          │  TwoFactor                            │
                          └─────────────────────────────────────────┘
                                          │
   GET /admin/* ──► middleware.ts (Edge)  │      cookie présent ?
                     x-hc-admin-pathname  │      présent ?
                     x-hc-admin-public    ▼
                          ┌─────────────────────────────────────────┐
                          │ AdminLayout (Node) — garde d'accès      │
                          │ src/app/[locale]/admin/layout.tsx       │
                          │  - rôle operator/viewer ? sinon redirect │
                          │  - 2FA optionnelle (aucun forçage)      │
                          └─────────────────────────────────────────┘
```

**Deux instances Better Auth, deux espaces totalement séparés** :

| | Membres | Admins |
|---|---|---|
| Instance | `src/lib/auth/index.ts` | `src/lib/auth/admin.ts` |
| Cookie | `better-auth.session_token` | `hashcode-admin.session_token` |
| Modèles | User / Session / Account / Verification | `AdminUser` / `AdminSession` / `AdminAccount` / `AdminVerification` |
| Méthode | OTP par email | email + mot de passe (+ 2FA optionnelle) |
| Route API | `/api/auth/[...betterAuth]` | `/api/admin-auth/[...betterAuth]` |

Un cookie membre **ne peut pas** ouvrir l'espace admin (et inversement).

---

## 3. Parcours

### 3.1 Inviter un admin (operator)

`/admin/settings` → section **Comptes administrateurs** → *Inviter*.

1. `POST /api/admin/invite` (operator only, CSRF) crée une `AdminInvitation` :
   jeton aléatoire 32 bytes, **seul son SHA-256 est stocké**, expiration 7 j.
2. Email envoyé avec le lien `/admin/setup?token=…`.

### 3.2 Activer son compte (invité)

`/admin/setup?token=…` :

1. `GET /api/admin/invite/verify` valide le jeton (email, rôle, expiration).
2. Le formulaire appelle le **sign-up Better Auth** (`/api/admin-auth/sign-up/email`).
3. Hook `databaseHooks.user.create` (`src/lib/auth/admin.ts`) **revalide
   l'invitation en base**, consomme le jeton, vérifie l'email et pose le rôle.
   *Aucun compte ne peut être créé sans invitation valide.*
4. `autoSignIn: true` → session immédiate.

### 3.3 Activer la 2FA (optionnel)

`/admin/settings` → section **Sécurité du compte** → *Activer la 2FA*
(ou directement `/admin/setup-2fa`). La 2FA est **désactivée par défaut** :
aucun forçage, l'admin choisit.

1. `POST /two-factor/enable` (mot de passe requis) → QR code + **8 codes de secours**.
2. Le QR est rendu **localement** (`qrcode.react`) : le secret ne transite par
   aucun service tiers.
3. `POST /two-factor/verify-totp` valide un premier code → 2FA active.
4. Pour la désactiver : **Sécurité du compte** → *Désactiver* (mot de passe
   requis, codes de secours invalidés).

### 3.4 Connexion

`/admin/login` :

1. Email + mot de passe → `POST /sign-in/email`.
2. Si 2FA active, Better Auth renvoie `twoFactorRedirect` : le client bascule
   sur l'étape du code TOTP (`/two-factor/verify-totp`).
3. « Rester connecté » = cookie de confiance d'appareil (30 j).

La 2FA est optionnelle : un compte sans 2FA se connecte en email + mot de passe.

### 3.5 Réinitialisation

- **Mot de passe oublié** : `/admin/login/reset` → `requestPasswordReset`
  (lien 1 h). La 2FA existante n'est pas remise en cause.
- **Téléphone 2FA perdu** : un operator réinitialise via
  `POST /api/admin/admins/[id]/reset-2fa` — supprime le secret, ferme les
  sessions. L'admin réenrôle à la prochaine connexion.

---

## 4. Routes API

| Route | Méthode | Garde | Rôle |
|---|---|---|---|
| `/api/admin-auth/*` | GET/POST | publique (hooks) | sign-in/up/out, 2FA, reset |
| `/api/admin/invite` | POST/DELETE | operator | inviter / annuler |
| `/api/admin/invite/verify` | GET | publique (jeton) | valider une invitation |
| `/api/admin/admins` | GET | operator | lister comptes + invitations |
| `/api/admin/admins` | PATCH | operator | changer un rôle |
| `/api/admin/admins` | DELETE | operator | révoquer un accès |
| `/api/admin/admins/[id]/reset-2fa` | POST | operator | reset 2FA + révocation sessions |
| `/api/admin/verify` | GET | admin | état de session (rôle, 2FA, expiry) |
| `/api/admin/logout` | POST | CSRF | déconnexion (admin + membre en transition) |
| `/api/admin/*` (existant) | * | `requireAdminRole` | inchangé |

**Garde-fous** : auto-révocation interdite (`SELF_REVOKE`), dernier operator
protégé (`LAST_OPERATOR`). Un changement de rôle révoque immédiatement les
sessions de l'admin concerné.

---

## 5. Sécurité

| Risque | Mesure |
|---|---|
| Partage de secret | Comptes nominatifs, invitation par email |
| Brute-force | Rate limit Better Auth (5 sign-in/min/IP), verrouillage 2FA |
| Vol de cookie | Cookie `HttpOnly` + `SameSite=Lax` + `Secure` en prod, TTL 8 h, cache cookie 5 min |
| 2FA faible | Secret chiffré au repos (symétrique), codes de secours hashés, lockout après échecs |
| Énumération de comptes | Messages d'erreur uniformisés (« Email ou mot de passe incorrect ») |
| Auto-promotion | `role` en `input: false` (schéma plugin) + rôle posé par le hook d'invitation |
| Session périmée | Révocation au changement de rôle, expiry stricte, `freshAge` 5 min pour actions sensibles |
| Création de compte sauvage | Hook `user.create.before` : invitation obligatoire (fail-closed) |

---

## 6. Migration depuis l'ancien système

### 6.1 Période de transition (déployée)

`src/lib/admin-auth.ts` accepte **les deux** chemins :
1. session admin nominative (vérité) ;
2. session membre + `Member.adminRole` (ancien chemin — évite de couper les
   sessions déjà ouvertes).

Le proxy accepte donc les deux cookies sur `/admin/*`. `AdminKey` est
conservé dans le schéma mais plus utilisé par le runtime.

### 6.2 Migrer les comptes existants

```bash
# 1. Compléter le mapping kid → email réel dans scripts/migrate-admin-keys.ts
#    (KNOWN_KEY_EMAILS)
# 2. Aperçu
node --env-file=.env --import tsx scripts/migrate-admin-keys.ts --dry-run
# 3. Créer les invitations
node --env-file=.env --import tsx scripts/migrate-admin-keys.ts
```

Chaque personne reçoit ensuite son email d'activation (7 j) et enrôle
mot de passe, puis 2FA optionnelle. Les clés sans email connu partent sur une adresse
placeholder à rattacher.

### 6.3 Nettoyage final (après migration des humains)

1. Supprimer la branche `resolveLegacyAdminSession` dans `admin-auth.ts`.
2. Supprimer le champ `Member.adminRole` + migration Prisma.
3. Supprimer le modèle `AdminKey` + migration Prisma.
4. Retirer l'acceptation du cookie membre dans `proxy.ts`.

---

## 7. Tests

```bash
npm run test:admin-roles   # rôles, chemins publics, garde-fous (pur)
npm run validate           # typecheck + lint + unit (inclut admin-roles)
```

Couvert : `normalizeAdminRole` (fail-closed), `isPublicAdminPath`,
`canRevokeAdmin` / `canChangeAdminRole` (dernier operator, auto-révocation).

---

## 8. Variables d'environnement

Aucune nouvelle : les deux instances partagent `BETTER_AUTH_SECRET` et
`NEXT_PUBLIC_SITE_URL`. (Les cookies diffèrent par le `cookiePrefix`, pas la
clé de signature.)

---

## 9. Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/auth/admin.ts` | Instance Better Auth admin + helpers session |
| `src/lib/auth/admin-client.ts` | Client React (basePath `/api/admin-auth`) |
| `src/lib/admin-roles.ts` | Logique pure (rôles, chemins, garde-fous) |
| `src/lib/admin-auth.ts` | Garde d'accès API + SC (transition incluse) |
| `src/proxy-guard.ts` + `middleware.ts` | Edge : cookie admin, chemins publics, headers au layout |
| `src/app/api/admin-auth/[...betterAuth]/route.ts` | Handler Better Auth admin |
| `src/app/[locale]/admin/login/page.tsx` | Connexion (credentials → 2FA si active) |
| `src/app/[locale]/admin/login/reset/page.tsx` | Mot de passe oublié + reset |
| `src/app/[locale]/admin/setup/page.tsx` | Activation d'invitation |
| `src/app/[locale]/admin/setup-2fa/page.tsx` | Enrôlement 2FA optionnel (QR + codes secours) |
| `src/components/reboot/admin/AdminSecurity.tsx` | Sécurité du compte : activer/désactiver la 2FA |
| `src/app/api/admin/invite/route.ts` | Invitations (POST/DELETE) |
| `src/app/api/admin/invite/verify/route.ts` | Validation de jeton |
| `src/app/api/admin/admins/route.ts` | Liste / rôle / révocation |
| `src/app/api/admin/admins/[id]/reset-2fa/route.ts` | Reset 2FA |
| `src/components/reboot/admin/AdminAccountsManager.tsx` | UI gestion des comptes |
| `scripts/migrate-admin-keys.ts` | Migration AdminKey → invitations |
| `tests/admin-roles.test.ts` | Tests unitaires logique pure |
| `prisma/migrations/20261011000000_add_admin_auth/` | DDL des 6 tables |
