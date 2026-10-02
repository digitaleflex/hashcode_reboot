# ADR 0003 — Internationalisation avec next-intl

**Date** : 2026-10-02
**Statut** : Accepté
**Auteurs** : Équipe HASHCODE REBOOT

## Contexte

HASHCODE REBOOT vise une communauté tech francophone (Bénin, Afrique francophone) avec ouverture internationale. L'anglais est la seconde langue naturelle pour l'expansion.

Besoin : routes localisées, messages externalisés, SEO-friendly, DXTypeScript-first, compatibilité App Router + Server Components.

## Options évaluées

| Option | Pour | Contre |
|--------|------|--------|
| **next-intl v3** | App Router natif, Server Components, `getTranslations`/`useTranslations`, ICU pluriels, middleware intégré, messages JSON, 0-dépendance runtime lourde | Courbe apprentissage modérée |
| `next-i18next` | Mature, écosystème | Legacy Pages Router orienté, heavier, moins typé |
| `i18next` + custom routing | Flexible | Réinventer routing, middleware, Server Components |
| Custom solution | Contrôle total | Maintenance, bugs, pas de standards |

## Décision

**Adopter `next-intl` v3** avec la configuration suivante :

- **Locales** : `['fr', 'en']`, défaut `fr`
- **localePrefix** : `as-needed` → FR sans préfixe (`/`), EN sous `/en/...`
- **Messages** : JSON dans `messages/{locale}.json` (namespaces hiérarchiques)
- **Middleware** : `createMiddleware(routing)` + auth middleware séparé, skip `/api/*`
- **Request config** : `getRequestConfig` chargeant messages dynamiquement
- **Client Provider** : `NextIntlClientProvider` dans `[locale]/layout.tsx`

## Conséquences

### Positives
- Routes canoniques FR (`/`, `/dashboard`, `/ateliers/...`) — SEO optimal marché primaire
- EN sous `/en/...` — partageable, bookmarkable
- TypeScript complet : clés messages typées via `next-intl` config
- Server Components : `getTranslations` async, pas de bundle client
- Client Components : `useTranslations` hook réactif
- ICU MessageFormat natif (pluriels, genres, sélecteurs)
- Middleware unifié auth + i18n sans conflit
- API routes préservées (pas de réécriture locale)

### Négatives / Risques
- Migration existante : ~200 fichiers touchés (T10 fait)
- Courbe apprentissage équipe (namespaces, `raw()`, ICU)
- Fichiers messages volumineux (1695 clés × 2 locales) — gérer par namespaces
- Validation continue requise (`check-messages.mjs` en CI)

### Neutres
- Pas d'impact DB, Prisma, Auth, Email
- Build time légèrement augmenté (chargement messages)
- Bundle client +~3KB gzippé (next-intl runtime)

## Implémentation

### Fichiers clés
```
src/i18n/routing.ts           # Config locales, navigation helpers
src/i18n/request.ts           # getRequestConfig (load messages)
src/middleware.ts             # Auth + intl middleware
src/app/[locale]/layout.tsx   # Validate locale, setRequestLocale, Provider
next.config.ts                # withNextIntl plugin
messages/fr.json, en.json     # 1695 clés chacun
scripts/check-messages.mjs    # Validation parité + placeholders
```

### Patterns d'usage

**Server Component** :
```tsx
const t = await getTranslations('dashboard.home');
return <h1>{t('welcomeCard.greeting', { firstName })}</h1>;
```

**Client Component** :
```tsx
'use client';
const t = useTranslations('auth.login');
return <button>{t('submit')}</button>;
```

**Tableaux** :
```tsx
const steps = t.raw('hero.steps') as Array<{n:string,title:string,desc:string}>;
```

**Pluriels ICU** (dans JSON) :
```json
"selectedCount": "{count, plural, =0 {aucun} one {# sélectionné} other {# sélectionnés}}"
```
```tsx
t('selectedCount', { count: selected.length })
```

## Validation continue

- **Pre-commit** : `node scripts/check-messages.mjs` (parité clés, placeholders)
- **CI** : `typecheck` + `check:i18n` + `build`
- **Release** : vérification manuelle `/` et `/en` smoke test

## Alternatives futures

Si besoins changent :
- **Plus de locales** : ajouter dans `routing.ts` + messages + CI
- **RTL (ar, he)** : `next-intl` supporte `dir` via `getLocaleDirection`
- **Traduction auto** : pipeline CI → Crowdin/Lokalise → PR messages
- **Edge middleware** : migrer middleware vers Edge Runtime si latence critique

## Références

- [next-intl Docs](https://next-intl-docs.vercel.app/)
- [App Router i18n Patterns](https://next-intl-docs.vercel.app/docs/app-router/getting-started)
- [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/)