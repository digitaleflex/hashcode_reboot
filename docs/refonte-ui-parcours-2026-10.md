# Refonte UI & parcours utilisateur — octobre 2026

Branche : `feat/ui-refonte-parcours`. Périmètre : parcours public et membre
(landing → questionnaire → bienvenue → dashboard). L'admin n'est pas touché.

## 1. Analyse de l'existant

**Stack** : Next.js 16 (App Router, `src/app/[locale]`), Tailwind 4, shadcn/ui,
Prisma/PostgreSQL, next-intl (FR seul), Better Auth (OTP email).

**Fonctionnalités du parcours**

| Étape | Ce que fait le produit |
|---|---|
| Landing `/` | Présente les 3 axes (Web / Cyber / IA), la méthode, le moteur de profil, la communauté, l'agenda, la roadmap, la FAQ |
| Questionnaire | 10 à 14 questions (selon les réponses), brouillon chiffré en local, reprise, relance email |
| Résultat | Archétype déterministe, accès WhatsApp immédiat ou relecture humaine, vérification email, numéro WhatsApp, orientation (next best action) |
| Espace membre | Statut, profil, agenda + RSVP, ateliers, mentorat, paramètres |

**Points forts** : base technique sérieuse (a11y, reduced-motion, anti-énumération,
soft-fail), moteur de profil lisible, tokens de design documentés.

**Points faibles UI** : H1 = nom de marque (aucune promesse), visuel hero abstrait,
landing très longue (10 sections, dont une sur l'historique interne), surfaces
plates, emojis rendus différemment selon l'OS, messages contradictoires en fin
de parcours, dashboard sans fil conducteur.

## 2. Bugs trouvés (et corrigés)

| Gravité | Bug | Correctif |
|---|---|---|
| 🔴 Critique | `middleware.ts` à la racine alors que l'app est dans `src/` : Next l'ignore → routage i18n et garde d'auth inactifs (`/` et `/login` en 404 en local). **À vérifier en prod.** | Déplacé dans `src/middleware.ts` |
| 🔴 Confidentialité | Les API publiques `/api/members/[id]/share` et `/api/profile/[id]` renvoient les tags bruts, dont `GENDER:*`, `HIGH-BUDGET`, `COUNTRY:*` ; les membres supprimés (soft-delete) restent visibles | Liste blanche `lib/profiling/public-tags.ts` + filtre `deletedAt: null` |
| 🟠 Parcours | L'écran de relecture s'affichait **deux fois** : il fallait cliquer « Finaliser » 2× | Une seule relecture |
| 🟠 Parcours | « Modifier mes réponses » depuis la relecture ne faisait rien de visible | Retour aux questions |
| 🟠 UI | Tags techniques (`COUNTRY:BJ`, `EMPLOYMENT-FOCUSED`) affichés aux utilisateurs | Libellés humains |
| 🟠 UI | Header mobile qui déborde à 390 px (CTA coupé) | Logo compact + CTA court |
| 🟠 UI | Bouton menu flottant du dashboard par-dessus la barre d'onglets mobile ; « Accueil » actif sur toutes les sous-pages | Repositionné ; correspondance exacte |
| 🟡 | `WelcomeCard` rendue 2× sur le dashboard (deux `h1`) | Supprimé |
| 🟡 | Orbite « Cybersecurity » du hero jamais positionnée (classe `--cybersecurity` vs CSS `--cyber`) | Classe CSS corrigée |
| 🟡 | Coche corrompue `âœ“` dans le sélecteur de pays ; raccourci « 1-9 » qui chevauche le radio | Icône ; raccourci déplacé |
| 🟡 | Pourcentage du questionnaire qui débordait sous la barre | Progression par étapes |
| 🟡 | `messages/fr.json` : clés `common` et `settings` dupliquées (la 1ʳᵉ écrasée en silence) | Dédoublonné (aucune perte) |
| 🟡 | Logo du dashboard écrasé (`size-6` sur le wordmark complet) ; vouvoiement isolé (« Votre mentorat ») | Corrigés |

## 3. Refonte

**Design system** (`globals.css`, bloc « REFONTE UI 2026-10 ») : surfaces en
relief (`.surface`, `.surface-accent`, `.ring-gradient`), en-têtes en verre
(`.glass`), titres en dégradé, puces (`.chip`), tuiles d'icône, halo et grille
radiale. `.ds-card` en profite automatiquement. Boutons en pilule homogènes.

**Landing** : H1 orienté bénéfice (« Progresse en tech. En pratiquant,
ensemble. »), vitrine animée de profils de démonstration (Web / Cyber / IA,
étiquetés fictifs), étapes reliées, bandeau d'audiences défilant, compteur
communauté mis en avant, état vide de l'agenda engageant, CTA finale en carte.
Section « HASHCODE évolue » retirée du parcours (discours interne).

**Questionnaire** : progression en 5 étapes nommées, panneau « Ton profil se
construit » en direct (desktop), options avec icônes vectorielles, champs
arrondis, Entrée valide le pays recherché.

**Bienvenue** : célébration, message adapté à l'accès (immédiat / en attente),
carte de profil en vis-à-vis, checklist « Tes prochaines étapes » (profil →
email → WhatsApp / espace membre).

**Dashboard** : bandeau d'accueil unique, checklist d'activation avec
progression (WhatsApp, communauté, premier atelier, objectif), cartes
harmonisées, navigation en vrais liens + entrée Mentorat.

## 4. Vérifications

- `tsc --noEmit` : 0 erreur · `eslint` : 0 erreur
- `npm run test:unit` : 501/501
- Playwright `landing.spec.ts` + `locale-routing.spec.ts` : 27 réussis, 3 ignorés
- Parcours complet rejoué en navigateur (desktop 1440 px et mobile 390 px),
  0 débordement horizontal

## 5. Pistes suivantes

- Vérifier en production si le middleware racine était réellement ignoré.
- Appliquer les surfaces aux pages secondaires (agenda, ateliers, paramètres,
  `/evenements`, auth) — elles héritent déjà des tokens mais pas de la mise en page.
- Mesurer l'effet : taux de complétion du questionnaire (`profiling_completed /
  profiling_started`) et clics WhatsApp, avant/après.
