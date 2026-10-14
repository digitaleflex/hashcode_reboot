# Landing — FAQ, CTA final et footer (lot `feat/landing-faq-cta-footer`)

**Date :** 2026-10-14
**Sections :** FAQ « Tu te demandes peut-être… » (`landing.faq`), CTA final
« Fais partie du Reboot » (`landing.finalCta`), Footer (`landing.footer`).
**Base :** `feat/landing-profiling-community-dynamic` @ `563377f` (lot #231).
**Contraintes tenues :** aucun lien légal supprimé, aucune route nouvelle, aucun
faux témoignage/statistique/label de confiance ajouté.

---

## 1. FAQ

- **Ordre revu par importance** (objections de conversion d'abord) : *C'est quoi
  le Reboot ?* → *C'est gratuit ?* → *Faut-il être expert ?* → **Qu'est-ce que je
  peux y faire ?** (nouveau) → *Que se passe-t-il après ?* → *Combien de temps ?*
  → *Mes données sont protégées ?*.
- **Réponses raccourcies et concrètes** ; suppression des tournures vagues ou des
  promesses non confirmées :
  - « gratuit » : on décrit l'état **actuel** (« aucune option payante n'est
    active aujourd'hui ») au lieu d'une hypothèse conditionnelle ;
  - **nouvelle question « participation »** : challenges concrets (disponibles)
    + accès communauté, en précisant honnêtement que « les ateliers live et le
    mentorat arrivent au fil des ouvertures » (aligné sur les statuts réels de
    la roadmap — pas de fonctionnalité présentée comme active avant qu'elle le
    soit) ;
  - confidentialité conservée telle quelle (légalement nécessaire).
- **Clavier / ARIA** : l'accordéon est un `Accordion` Radix (shadcn) — chaque
  question est un `<button>` avec `aria-expanded` / `aria-controls`, navigable
  au clavier (Enter/Espace/flèches) et focusable. Vérifié par un **test e2e
  dédié** (focus → `aria-expanded=false` → `Enter` → `true` + contenu visible →
  `Enter` → `false`).

## 2. CTA final

- **Message principal** conservé : « FAIS PARTIE DU REBOOT. ».
- **Explication courte reformulée** pour ne pas répéter le hero mot pour mot :
  « Un profil qui te situe, un axe de départ, et une communauté pour
  progresser. » (le hero parle de « communauté dev, cyber & IA » et de
  « 2 min / WhatsApp »).
- **CTA dominant** : « Construire mon profil » → `onJoin("final")`, câblé sur le
  **parcours de profilage existant** (`profiling_started`). Contraste lime/dark
  vérifié (15,48:1, cf. `check:contrast`).
- **Réassurance** : « Gratuit · Sans engagement · Zéro spam ».

## 3. Footer

- **Logo cliquable** vers l'accueil localisé (`I18nLink href="/"`,
  `aria-label="HASHCODE REBOOT — retour à l'accueil"`).
- **Colonne « Légal » ajoutée** (4ᵉ groupe), en plus de Produit / Ressources /
  Communauté → la distinction principaux / ressources / **légal** est explicite.
- **Liaison des pages légales** : `LEGAL_HREF` était **vide** (les liens légaux
  n'existaient pas dans le footer et retombaient sur `/evenements`). Il est
  désormais câblé (`legal → /mentions-legales`, `cgu → /cgu`,
  `confidentialite → /confidentialite`, `cookies → /cookies`). Les routes
  existaient déjà : **aucune route créée**.
- **Commentaire obsolète supprimé** (celui qui décrivait `LEGAL_HREF` comme
  vide) — obsolescence confirmée par le câblage.
- **Bloc confidentialité conservé** (description + lien vers la modale
  existante) — information légale/utile préservée.
- Lisibilité : titres de colonnes inchangés (13px display, uppercase), liens
  14px, cibles ≥ 44px ; aucune hauteur ajoutée inutilement (une seule ligne de
  colonnes en plus).

## 4. Responsive

- Footer : `grid-cols-2` (mobile, 2×2 équilibré grâce à la 4ᵉ colonne) →
  `sm:grid-cols-4`.
- FAQ : déclencheurs `min-h-[56px]` et contenu `ds-body` (16px) sur mobile — pas
  de texte minuscule ni d'accordéon dur à toucher.
- Vérifié 1440×900 et 390×844 : **aucun débordement horizontal**.

## 5. Liste des liens vérifiés (destinations)

| Emplacement | Libellé | Destination | Type |
|---|---|---|---|
| Footer — logo | HASHCODE REBOOT | `/` (localisé) | `I18nLink` |
| Footer — Produit | Construire mon profil | `onJoin("footer-join")` → profilage | action |
| Footer — Produit | Les trois axes | `#axes` | ancre |
| Footer — Produit | La méthode | `#method` | ancre |
| Footer — Ressources | Événements | `/evenements` | `I18nLink` |
| Footer — Ressources | Questions fréquentes | `#faq` | ancre |
| Footer — Communauté | Mon espace | `/dashboard` ou `/login` | `I18nLink` |
| Footer — **Légal** | Mentions légales | `/mentions-legales` | `I18nLink` |
| Footer — **Légal** | CGU | `/cgu` | `I18nLink` |
| Footer — **Légal** | Confidentialité | `/confidentialite` | `I18nLink` |
| Footer — **Légal** | Cookies | `/cookies` | `I18nLink` |
| Footer — bloc confiance | Lire la politique complète → | modale confidentialité | action |
| Header | Les trois axes / Événements / FAQ | `#axes` / `/evenements` / `#faq` | mixte |
| CTA final | Construire mon profil | `onJoin("final")` → profilage | action |
| FAQ | Voir la politique de confidentialité | modale confidentialité | action |

Toutes les destinations sont vérifiées par e2e (`href` du logo + des 4 liens
légaux) ou existent réellement dans le repo.

## 6. Validation exécutée (14/10/2026)

| Vérification | Résultat |
|---|---|
| `node scripts/check-messages.mjs` | ✅ 0 clé orpheline (`homeAria`, `make`, colonne Légal câblés) |
| `npm run typecheck` / `npm run lint` / `npm run build` | ✅ |
| `npm run test:unit` | ✅ 491 pass / 0 fail |
| `npm run check:contrast` | ✅ |
| Playwright `tests/e2e/landing.spec.ts` | ✅ **17/17** (dont **CTA final**, **FAQ clavier**, **footer logo + liens légaux**) |
| axe-core desktop 1440×900 + mobile 390×844 | ✅ 0 violation (40 passes) |
| Débordement horizontal | ✅ aucun |

> Note : un scan axe lancé **à froid** (premier chargement) peut remonter un faux
> `region` transitoire ; sur page stabilisée, 0 violation (3 exécutions).

## 7. Captures avant / après

`docs/design-system/captures/faq-cta-footer/` (page complète,
`prefers-reduced-motion`, `content-visibility` forcée pour rendre la FAQ) :

| Viewport | Avant (lot #231) | Après |
|---|---|---|
| 1440×900 | `before-desktop-1440x900.png` | `after-desktop-1440x900.png` |
| 390×844 | `before-mobile-390x844.png` | `after-mobile-390x844.png` |

## 8. Limites

- Le texte « prix » reste prudent : aucune grille tarifaire n'existe côté
  produit, donc aucune n'est inventée.
- La FAQ ne mentionne pas de dates d'ouverture des ateliers/mentorat (non
  sourcées) ; le suivi dynamique des statuts est tracké par l'issue **#234**.
