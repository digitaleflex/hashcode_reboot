# Landing — Profilage, communauté et contenu dynamique (lot `feat/landing-profiling-community-dynamic`)

**Date :** 2026-10-13
**Sections :** « Découvre comment HASHCODE peut te comprendre » (`landing.engine`),
« On construit à plusieurs. » (`landing.community`), « HASHCODE est en mouvement. »
(`landing.activity`), « Le Reboot, c'est maintenant. » (`landing.roadmap`).
**Base :** `feat/landing-philosophy-domains-method` @ `b1cd9d0` (lot #230).
**Contraintes tenues :** aucun changement de backend/schéma, aucune dépendance
ajoutée, aucune API cassée, aucun mock en production, aucune règle d'accès
modifiée.

---

## 1. Profilage — « Découvre comment HASHCODE peut te comprendre »

**Clarification.** La carte n'est plus présentée comme un simple « exemple » :
elle devient explicitement un **profil d'orientation**.
- `demoLabel` : « Profil d'orientation — démonstration ».
- `demoNote` : précise **ce qu'elle n'est pas** — « ni une certification, ni une
  évaluation de tes compétences ».
- Nouveau `profileUse` : « Il oriente ton parcours : un axe de départ et un
  rythme adaptés à ton point de départ. » → explique **comment** le profil aide
  à orienter.

**Réduction des métadonnées secondaires.** `ProfileCard` reçoit deux props
optionnelles **additives** (défaut = comportement historique, aucune régression
pour `Welcome` / partage public) :
- `fields?: ProfileField[]` → l'engine n'affiche plus que **domaine, objectif,
  rythme** (au lieu de 6 champs) ;
- `showTags?: boolean` → les tags d'intérêt sont masqués dans la démo.

**CTA branché sur le parcours existant.** `Engine` reçoit désormais `onJoin` et
expose un bouton « Construire mon profil » (`ref: "engine"`), avec `aria-label`
contextuel. Il déclenche exactement `profiling_started` (parcours existant de
`page.tsx`), vérifié en e2e.

## 2. Communauté — « On construit à plusieurs. »

Chaque forme de participation affiche désormais **ce qu'elle permet de faire**,
**comment y participer** et **son état réel** — sans présenter une activité à
venir comme opérationnelle :

| Activité | Ce qu'elle permet | Comment participer | État (réel) |
|---|---|---|---|
| Challenges | Résoudre des problèmes concrets, régulièrement | Après création du profil | **Disponible** (badge accent) |
| Workshops | Sessions live pour apprendre ensemble | Ouverts au fil de la programmation | **Bientôt** |
| Mentorat | Accompagnement selon le besoin | Proposé selon le besoin exprimé au profil | **Bientôt** |

Les états correspondent aux statuts réels de la roadmap (seul *Challenges* est
« en cours »). Ajout d'un **CTA unique** en bas de section (`ref: "community"`,
`aria-label` contextuel) + une phrase de cadrage (« Tout commence par ton
profil… »). Le compteur de membres réel (`LiveMemberCount`) est conservé.

## 3. Actualités — « HASHCODE est en mouvement. »

Examen du contrat `GET /api/public/events?limit=3` (public, `scheduled`/`live` à
venir, compteurs agrégés uniquement, rate-limit 60/min).

| État | Rendu | Accessibilité |
|---|---|---|
| chargement | squelette (3 blocs `aria-hidden`) | `role="status"` + texte sr-only ; `aria-busy="true"` ajouté au conteneur |
| sans données | « Aucune session programmée pour le moment. » | `role="status"` |
| erreur (500/réseau) | « Sessions indisponibles pour le moment. » + « Réessayer » | `role="status"` |
| données | cartes réelles (titre, date, lieu, participants, statut `live`/`scheduled`) | listes sémantiques |

- **Retry** : `fetchJsonWithRetry` (2 reprises, backoff 400 / 1200 ms) +
  **relance manuelle** via le bouton, uniquement sur action utilisateur. Aucun
  polling, aucune requête répétitive : une seule requête au montage, une seule
  par relance (`attempt`). Le robuste retry est cohérent avec un flux
  « nice-to-have » qui ne doit jamais casser la page.
- **Pas de section remplie artificiellement** : si l'API renvoie `[]`, l'état
  vide explicite s'affiche ; si elle échoue, l'état d'erreur neutre s'affiche
  (jamais de fausses sessions).

## 4. Activités et ressources — « Le Reboot, c'est maintenant. »

Vérifié : la roadmap utilise **des cartes identiques** (`.ds-badge`, grille
hairline uniforme) et un **vocabulaire d'état unique** : « En cours » (item
`live`, badge accent + coche) vs « Bientôt » / « Ensuite ». Un seul jalon est
marqué disponible — le lime n'y sert qu'à ça. **Aucun code modifié** (déjà
conforme) ; les statuts sont **éditoriaux** (i18n), voir chantiers ci-dessous.

---

## 5. Validation exécutée

| Vérification | Résultat |
|---|---|
| `node scripts/check-messages.mjs` | ✅ 0 clé orpheline (`profileUse`, `cta`, `ctaAria`, `cards` câblés) |
| `npm run typecheck` / `npm run lint` / `npm run build` | ✅ |
| `npm run test:unit` | ✅ 491 pass / 0 fail |
| Playwright `tests/e2e/landing.spec.ts` | ✅ **14/14** — dont **2 nouveaux tests** CTA `engine` et `community` → `reboot_cta_clicked` + `profiling_started`, et les **3 états** d'activité (vide / erreur / 3 événements) via mocks |
| axe-core desktop 1440×900 + mobile 390×844 | ✅ 0 violation (40 passes) |
| Débordement horizontal | ✅ aucun |
| `npm run check:contrast` | ✅ |
| Destinations des liens | ✅ CTA profil → parcours existant ; CTA événements → `/evenements` ; ancres `#engine`/`#community` intactes |

## 6. Chantiers backend distincts (hors périmètre de ce lot)

1. **Participation aux activités** : il n'existe **aucun endpoint public** pour
   « rejoindre un challenge », « s'inscrire à un workshop » ou « demander un
   mentorat ». La participation passe aujourd'hui par le profil puis l'accès à
   la communauté (WhatsApp). Une action directe par activité nécessiterait un
   contrat backend (RSVP/inscription) et une règle d'accès — **non implémenté
   ici** volontairement.
2. **Statuts de la roadmap** : les états (« En cours », « Bientôt », « Ensuite »)
   sont **éditoriaux** (dans les traductions), pas alimentés par une source de
   vérité. Les rendre dynamiques (drapeau CRM/CMS) serait un chantier données.
3. **Compteurs par activité** : seul le compteur global de membres existe
   (`/api/community/count`). Aucun compteur par challenge/workshop.
4. **Pagination des événements** : la landing en affiche 3 ; pas de « voir
   plus » côté API au-delà de `limit` (max 50).

## 7. Captures avant / après

`docs/design-system/captures/profiling-community-dynamic/` (page complète,
`prefers-reduced-motion`) :

| Viewport | Avant (lot #230) | Après |
|---|---|---|
| 1440×900 | `before-desktop-1440x900.png` | `after-desktop-1440x900.png` |
| 390×844 | `before-mobile-390x844.png` | `after-mobile-390x844.png` |

## 8. Limites

- L'état d'activité « avec données » n'est visible en local qu'avec une base
  (mocks dans l'e2e) ; en production les sessions réelles s'affichent.
- `ProfileCard` gagne deux props optionnelles : les autres usages (`Welcome`,
  partage public) gardent le rendu complet (défaut inchangé).
