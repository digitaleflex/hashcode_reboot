# Landing — Philosophie, domaines et méthode (lot `feat/landing-philosophy-domains-method`)

**Date :** 2026-10-13
**Sections :** « HASHCODE évolue » (`landing.evolves`), « Trois terrains. Un seul
système. » (`landing.axes`), « Apprendre. Pratiquer. Construire. Évoluer. »
(`landing.method`).
**Base :** `design/landing-typo-cleanup` @ `aa84ba7` (lot #229).
**Interdit tenu :** aucun cours, certification, niveau ou résultat inventé ;
aucune fonctionnalité métier ajoutée ; composants partagés et traductions
préservés.

---

## 1. Philosophie — « HASHCODE évolue »

Ancien contenu : un triptyque `Avant / Le pivot / Maintenant` aux titres vagues
(`Consommer`, `Se situer`, `Construire`) et une description redondante
(« Apprendre, pratique, construire… ») qui paraphrasait l'intro.

Révision — chaque étape devient un **principe explicite, relié à une pratique
réelle**, sans promesse invérifiable :

| Position | Titre | Description | Lien réel |
|---|---|---|---|
| Avant | Consommer ne suffit pas | Des contenus dispersés, sans point de départ ni progression visible. | — (constat) |
| Le pivot | Se situer avant d'agir | Un profil qui replace chacun : domaine, objectif, rythme. | moteur de profil (§04) |
| Maintenant | Apprendre en pratiquant | Challenges concrets, workshops live et projets, puis mentorat. | activités réelles (roadmap / communauté) |

Suppressions expliquées : « niveau » remplacé par « domaine » (évite d'induire
des niveaux non définis) ; suppression de la formule « pas quatre promesses »
redondante avec la méthode.

## 2. Trois domaines — « Trois terrains. Un seul système. »

- `index` : « Les trois axes » → **« Les trois domaines »** (vocabulaire du
  brief).
- Descriptions rendues **concrètes et symétriques** (ce que l'on apprend /
  pratique) :
  - **Web Development** — « Concevoir des interfaces, des applications et des
    produits web. »
  - **Cybersecurity** — « Comprendre, protéger et analyser systèmes, réseaux et
    applications. »
  - **Applied AI** — « Construire avec des modèles, des agents et
    l'automatisation. »
- Nouveau libellé **« Ce que tu y pratiques »** au-dessus des puces : les
  domaines listent désormais des pratiques identifiables, pas des mots-valises.
- **Icône Applied AI** : `Sparkles` → `BrainCircuit` (fonction identifiable) ;
  les trois icônes restent des composants Lucide cohérents (`Code2`, `Shield`,
  `BrainCircuit`).
- **Public / prérequis :** volontairement **non** affiché par carte — aucun
  prérequis n'est défini dans le produit, en inventer un serait une fabrication.
  La question d'audience reste couverte, ailleurs, par la section communauté
  (« À qui ça s'adresse »).
- Les trois cartes partagent **exactement** la même structure et le même design
  (`.ds-card`), seule la donnée change.

## 3. Méthode — « Apprendre. Pratiquer. Construire. Évoluer. »

Chaque étape présente désormais **l'action du membre** (description) et **son
objectif** (nouvelle ligne « Objectif : … ») :

| # | Étape | Action | Objectif |
|---|---|---|---|
| 01 | Apprendre | Comprendre les concepts clés de ton domaine. | Des bases solides. |
| 02 | Pratiquer | Résoudre des challenges concrets avec la communauté. | Ancrer les acquis par la pratique. |
| 03 | Construire | Mener de vrais projets, en équipe. | Passer de l'exercice au projet. |
| 04 | Évoluer | Être accompagné en mentorat, à ton rythme. | Progresser dans la durée. |

Représentation **inchangée** : séquence numérotée avec rail de progression
(horizontal sur desktop, vertical sur mobile), pilotée par `useScrollFill` en
variable CSS `--fill`. Aucune animation nouvelle, aucun composant ajouté —
conforme à « ne pas ajouter une animation complexe ».

## 4. Cohérence éditoriale

- Ton commun aux trois sections : phrases courtes, verbes d'action, aucun jargon
  marketing.
- Un seul niveau de titre par section (`SectionHeader` → `.ds-h2`) ; titres
  d'étape en `.ds-h3`.
- Numérotation des index conservée (01 → 03) pour garder la lecture séquentielle
  de la page.
- Pas de doublon ajouté avec le hero (aucune répétition du « 2 min » / WhatsApp)
  ni avec la section activités (les sessions live restent dans `landing.activity`).

## 5. Validation (exécutée)

| Vérification | Résultat |
|---|---|
| `node scripts/check-messages.mjs` | ✅ 0 clé orpheline (nouvelles clés `practiceLabel`, `goalLabel`, `g` câblées) |
| `npm run typecheck` / `npm run lint` / `npm run build` | ✅ |
| `npm run test:unit` | ✅ 491 pass / 0 fail |
| Playwright `tests/e2e/landing.spec.ts` | ✅ 12/12 (CTA hero/axes/footer, ancres, sticky, FAQ, activité) |
| axe-core desktop 1440×900 + mobile 390×844 | ✅ 0 violation (40 passes) |
| Débordement horizontal | ✅ aucun (`scrollWidth == clientWidth`) |
| `npm run check:contrast` | ✅ |

Navigation CTA vérifiée par l'e2e : « Découvrir les axes » scrolle vers `#axes`,
CTA hero/axes/footer déclenchent `profiling_started`, ancres `#axes`/`#faq`
résolues.

## 6. Captures avant / après

`docs/design-system/captures/philosophy-domains-method/` (page complète,
`prefers-reduced-motion`) :

| Viewport | Avant (état lot #229) | Après |
|---|---|---|
| 1440×900 | `before-desktop-1440x900.png` | `after-desktop-1440x900.png` |
| 390×844 | `before-mobile-390x844.png` | `after-mobile-390x844.png` |

## 7. Limites

- Le terme « signal » (`ARCHITECTURE` / `DÉFENSE` / `MODÈLES`) est conservé comme
  tag thématique ; il ne constitue pas une promesse. Sa suppression éventuelle
  relèverait d'une décision de marque.
- `en.json` est archivé (site FR-only) : aucune version anglaise à réaligner.
- Les captures sont des PNG pleine page (≈ 3,8 Mo) sans post-optimisation.
