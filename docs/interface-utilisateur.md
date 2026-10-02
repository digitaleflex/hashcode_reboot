# Interface utilisateur — inventaire exhaustif

> Description détaillée de **toutes les fonctionnalités visibles et actionnables**
> par un utilisateur final (visiteur, prospect, membre) : écrans, textes, champs,
> validations, états, actions, endpoints, garde-fous.
> État du code au **2026-09-18**. L'interface **admin est exclue** du périmètre.
>
> Sources : lecture directe de `src/app/**`, `src/components/reboot/**`,
> `src/lib/profiling/**`, `src/lib/account-*.ts`, `src/middleware.ts` et des
> routes `src/app/api/**` consommées par l'UI.

## 0. Cadre technique et périmètre

- **Stack** : Next.js 16 App Router · TypeScript · Tailwind CSS 4 · shadcn/ui ·
  Prisma 6 + Neon Postgres · Resend (fallback Brevo) · Zustand · TanStack Query · Zod.
  Package manager **Bun** (`bun.lock`). Déploiement Vercel.
- **Thème** : sombre unique (`src/app/globals.css:55`), accent **lime**
  (`--primary`, ≈ `#C5F441`), `font-display` pour les titres, `mono-label` pour
  les libellés techniques, `focus-lime` (outline lime 2 px) sur tous les contrôles.
- **Cibles tactiles** : `min-h-[44px]` quasi systématique.

### Routes visibles par un utilisateur final

| Route | Type | Rôle |
|---|---|---|
| `/` | client (phases) | landing + profilage + résultat + partage |
| `/login` | client | demande de code / lien magique |
| `/verify-otp` | client | saisie OTP 6 chiffres + auto-connexion lien magique |
| `/verify-email` | client | confirmation d'email 1-clic |
| `/evenements` | server (`force-dynamic`) | agenda public |
| `/profile/[id]` | server | profil public d'un membre |
| `/dashboard` | server | vue d'ensemble membre |
| `/dashboard/agenda` | server | agenda membre + RSVP |
| `/dashboard/profile` | server | profil public + partage |
| `/dashboard/profile-complet` | server | complétion de profil post-inscription |
| `/dashboard/settings` | server | coordonnées / compte / session |
| `/account` | server | redirection vers `/dashboard/settings` |

---

## 1. Parcours visiteur — page d'accueil `/`

`src/app/page.tsx` est une **machine à 6 phases** (`page.tsx:38`) :
`landing | profiling | submitting | result | admin-login | admin`.

### 1.1 Entrées par paramètre d'URL (au montage, `page.tsx:66-89`)

| Paramètre | Effet | Priorité |
|---|---|---|
| `?admin=1` | `GET /api/admin/verify` → phase `admin` (redirect `/admin`) ou `admin-login` | 1 |
| `?share=<id>` | `SharedProfileView` + `track reboot_page_view {ref:"shared-profile"}` | 2 |
| `?resume=1` | phase `profiling` directe + `track profiling_resumed` | 3 |
| — | landing + `track reboot_page_view` | 4 |

### 1.2 Structure de la landing (`src/components/reboot/landing/` + `landing.tsx`, #27)

Conteneur `bg-background min-h-screen flex flex-col pb-[76px] sm:pb-0` (réserve la
place du CTA mobile). Ordre exact de rendu :

| # | Section | Ancre | Contenu |
|---|---|---|---|
| 1 | Header sticky `top-0 z-40 bg-background/85 backdrop-blur-sm border-b` | — | Logo + nav + CTA |
| 2 | Hero | — | eyebrow, titre, accroche, 2 CTA, réassurance, 3 étapes, indicateur de scroll |
| 3 | « 01 · Pourquoi on revient » | — | **HASHCODE évolue.** + intro |
| 4 | « 02 · Les trois axes » | `#axes` | 3 lignes : Web / Cyber / IA |
| 5 | « 03 · Ce qui change vraiment » | — | **Quatre verbes. Une direction.** (grille desktop / carrousel mobile) |
| 6 | « 04 · Pour qui c'est fait » | — | **Pas besoin d'être expert.** + 8 tags cliquables |
| 7 | Témoignage | — | citation « Aïcha · Étudiante » |
| 8 | « 05 · La suite, concrètement » | — | 5 items avec badges de statut |
| 9 | « 06 · Tes questions » | `#faq` | accordéon 6 questions |
| 10 | CTA final | `#rejoindre` | **Prêt à rejoindre la communauté ?** |
| 11 | Footer | — | 4 stats + 3 colonnes + bas de page |
| 12 | `StickyMobileCta` | — | CTA fixe bas d'écran (mobile uniquement) |

**Décors** (tous `aria-hidden`) : `bg-grid`, `bg-noise`, `bg-vignette`, aura lime
floutée, **grand `HashSymbol` 360 px** en filigrane derrière le hero, séparateurs
`divider-grad` entre sections.

### 1.3 Navigation

- **Desktop (`≥768px`, `nav aria-label="Navigation"`)** : `Axes` (scroll smooth) ·
  `Événements` (→ `/evenements`) · `FAQ` (scroll) · `Reboot · Édition 2026` ·
  `Se connecter` (→ `/login`) · bouton `Construire mon profil`.
- **Tablette (640–767px)** : `Événements` + `Construire mon profil`.
- **Mobile (<640px)** : `Événements` + bouton `Rejoindre`.
- **Pas de menu burger** sur la landing, **pas d'état connecté** : le visiteur
  connecté voit exactement la même nav (aucun `isAuthed` transmis à `Landing`).
- `scrollToId` respecte `prefers-reduced-motion` (descente instantanée).

### 1.4 Hero — textes exacts

- Eyebrow : **« Bienvenue dans le Reboot — où que tu sois »**
- H2 : **« Rejoins la nouvelle communauté dev, cyber & IA. »**
- Sous-titre : **« Où que tu sois. Crée ton profil en 2 min, reçois ton accès
  WhatsApp et commence avec ton premier challenge cette semaine. »**
- Boutons : **« Construire mon profil »** (lance le profilage, tracké) et
  **« Découvrir les axes »** (scroll uniquement).
- Réassurance : ✓ **« Environ 2 min · Gratuit · Sans engagement »**
- **3 étapes** (`<ol>`) :

| n | Titre | Icône | Description |
|---|---|---|---|
| 01 | Réponds par clic | `MousePointerClick` | « Quelques questions simples, environ 2 minutes, sans rédiger. » |
| 02 | Reçois ton axe | `Compass` | « Web, Cyber ou IA — selon ton niveau et ton objectif. » |
| 03 | Rejoins WhatsApp | `MessageCircle` | « Accès immédiat si compatible. Sinon email, zéro spam. » |

- Puis : **« Sinon email, zéro spam, suppression en 1 message. »**
- Indicateur **« Défiler »** + chevron `animate-bounce-slow` (masqué < `sm` ;
  ne gère pas `reduced-motion`).

### 1.5 Sections — contenus exacts

**01 · Pourquoi on revient** — titre **« HASHCODE évolue. »**, intro « Le contenu
seul ne suffit plus. On veut un environnement où les membres peuvent apprendre,
pratiquer, construire, collaborer et progresser — pour de vrai. »

**02 · Les trois axes** — intro « Choisis ton terrain. Tu pourras en croiser
d'autres plus tard. » Chaque ligne : hover `row-sweep`, icône et titre passant en
lime, bouton `Construire mon profil`.

| n | Titre | Description | Icône |
|---|---|---|---|
| 01 | **Web Development** | « Créer des applications, produits et expériences numériques. » | `Code2` |
| 02 | **Cybersecurity** | « Comprendre, protéger, analyser et expérimenter. » | `Shield` |
| 03 | **Applied AI** | « Construire avec l'IA, l'automatisation et les agents. » | `Sparkles` |

Rappel mobile sous la grille : bouton **« Rejoindre la communauté »**.

**03 · Quatre verbes** — intro « On passe de la consommation à la construction. »

| n | Titre | Description |
|---|---|---|
| 01 | Apprendre | « Les fondamentaux, clairs et solides. » |
| 02 | Construire | « De vrais projets, pas des démos. » |
| 03 | Pratiquer | « Des challenges pour progresser. » |
| 04 | Collaborer | « Progresser avec d'autres membres. » |

→ Desktop : grille 2/4 colonnes. Mobile : **`PillarsCarousel`** avec
`role="region" aria-roledescription="carrousel"`, flèches prev/next, compteur
`aria-live="polite"`, 4 dots `role="tab"`, support clavier horizontal et
`prefers-reduced-motion`.

**04 · Pour qui c'est fait** — intro « Si tu es curieux et motivé, tu as ta place.
Touche un profil pour commencer. » 8 tags, **chacun déclenche `onJoin`** (donc
analytics + profilage) : Débutants · Étudiant·es · Développeur·euses ·
Professionnel·les · Entrepreneur·es · Passionné·es de cyber · Curieux d'IA ·
Autodidactes. Puis : « Débutant ou avancé — on part de là où tu es vraiment. »

**05 · Témoignage** — « *Je suis arrivé curieux, reparti avec un plan clair et mon
premier challenge à faire cette semaine. On sait enfin où aller.* » — Aïcha ·
Étudiante · « Débutante web · Première cohorte 2026 ».

**06 · La suite, concrètement** — intro « Les premiers membres ouvrent la voie.
Voici l'ordre réel. »

| n | Titre | Description | Badge |
|---|---|---|---|
| 01 | Challenges | « Des problèmes concrets à résoudre, régulièrement. Le premier dès cette semaine. » | **Maintenant** (lime + point pulsé) |
| 02 | Workshops | « Des sessions live pour apprendre ensemble. » | Bientôt |
| 03 | Projects | « Construire en équipe sur des projets réels. » | Bientôt |
| 04 | Mentoring | « De l'accompagnement pour celles et ceux qui en ont besoin. » | Ensuite |
| 05 | HASHCODE Registry | « Le futur centre de gestion des profils et parcours. » | Ensuite |

**07 · FAQ** — accordéon shadcn `type="single" collapsible`, `min-h-[56px]` par
déclencheur, 6 entrées :

| # | Question | Réponse exacte |
|---|---|---|
| 0 | C'est quoi le Reboot exactement ? | « Le Reboot est le nouveau point d'entrée de la communauté HASHCODE. Tu construis ton profil en 2 minutes, tu reçois une première orientation, et tu rejoins la communauté officielle. C'est la première étape du nouveau HASHCODE. » |
| 1 | Combien de temps ça prend ? | « Environ 2 minutes. La majorité des réponses se font par clic. On ne te demande que ce qui est nécessaire pour comprendre ton profil — rien de superflu. » |
| 2 | Faut-il être expert pour rejoindre ? | « Non. HASHCODE est ouvert aux débutants, aux étudiants, aux développeurs, aux professionnels, aux entrepreneurs et aux autodidactes. On part de là où tu es vraiment. » |
| 3 | C'est gratuit ? | « Oui. Le Reboot est gratuit : profil + accès communauté. Si un jour une option payante existe, ce sera optionnel et annoncé clairement. Rien n'est prélevé, rien n'est caché. » |
| 4 | Que se passe-t-il après mon inscription ? | « Tu réponds par clic (~2 min), tu reçois ton axe proposé, puis ton accès WhatsApp si ton profil est compatible. Sinon, on te recontacte par email pour une invitation personnalisée. Zéro spam, suppression en 1 message. » |
| 5 | Mes données sont protégées ? | « Oui. On collecte le minimum nécessaire, aucune revente, aucune publicité. Tu peux demander la suppression de tes données à tout moment. » |

La dernière question (détection `f.q.includes("protégées")`) injecte un bouton
**« Voir la politique de confidentialité »** qui ouvre la `PrivacyModal`.
Aucun tracking sur cette action. Sous la FAQ : bouton `Construire mon profil`.

**CTA final** — HashSymbol 48 px + halo pulsé, **« Prêt à rejoindre la
communauté ? »**, **« Crée ton profil en 2 min et reçois ton accès WhatsApp. »**,
bouton `Construire mon profil`, réassurance ✓ **« Gratuit · Environ 2 minutes ·
Zéro spam »**.

**Footer** — 4 statistiques (`2026` Première cohorte ouverte · `3` Axes : web,
cyber, IA · `~2 min` Profil par clic, sans friction · **compteur live**) puis
3 colonnes :
1. Logo + « La nouvelle communauté dev, cyber & IA. Ton premier challenge
   t'attend cette semaine, où que tu sois. »
2. **Liens** : Construire mon profil · Voir les 3 axes · Questions fréquentes
3. **Confidentialité** : « Minimum nécessaire, zéro revente, zéro pub.
   Suppression en 1 message, à tout moment. » + « Lire la politique complète → »

Bas de page : « © 2026 Hashcode · Reboot » et « Née au Bénin · Ouverte à toutes
et tous ».

**StickyMobileCta** — visible seulement si `scrollY > 60 % de la hauteur` **et**
section `#rejoindre` hors viewport ; contenu « **2 min · Gratuit** » / « Ton
challenge cette semaine » + bouton `Construire mon profil`.

### 1.6 Compteur communauté (`LiveMemberCount`, `landing/social-proof.tsx`)

`GET /api/community/count` (`cache:"no-store"`). Si `count > 0` → valeur en
`font-display font-bold text-lime tabular-nums` + label **« Profils déjà créés »** ;
sinon (0, erreur ou en cours) → **« 1ère »** + **« Cohorte en cours »**.
**Aucun spinner, aucune animation de comptage**, aucun état d'erreur distinct.
Endpoint public, rate-limit 30/IP/10 min, cache `s-maxage=60`.

### 1.7 Vue partage `?share=<id>` (`SharedProfileView`)

`GET /api/members/{id}/share` (`no-store`).

- **Erreur** → HashSymbol + **« Profil introuvable ou non public. »** + bouton
  `Retour à HASHCODE`.
- **Chargement** → **rendu vide** (aucun spinner / skeleton).
- **Succès** :
  - Eyebrow **« Profil public · HASHCODE REBOOT »**
  - H1 `{firstName} · {ARCHÉTYPE}` (archétype en lime, `text-glow-lime`)
  - **« Voici comment HASHCODE a compris ce membre. »**
  - Champs : **Domaine** (Web Development / Cybersecurity / Applied AI) ·
    **Niveau** (Débutant / Pratique / Autonome / Avancé) · **Objectif** (code
    brut) · **Rythme** (code brut) · **Style** (code brut) · **Mentorat**
    (`yes` → Intéressé, `maybe` → Curieux, sinon « Pas pour le moment »)
  - **« Objectif à 3 mois »** si présent (guillemets italiques), tags (max 8)
  - CTA **« Construire mon profil »** → sortie + `history.replaceState("/")`
- `accessLane` est transporté mais **jamais affiché**. API : 30/IP/10 min,
  aucun champ sensible.

### 1.8 Inventaire des actions et du tracking

| Libellé exact | Action | `track()` |
|---|---|---|
| Axes | `scrollToId("axes")` | non |
| Événements | navigation `/evenements` | non |
| FAQ | `scrollToId("faq")` | non |
| Se connecter | navigation `/login` | non |
| **Construire mon profil** (×7 emplacements) | `onJoin` → profilage | **oui** `reboot_cta_clicked` (+ `profiling_started` 1ʳᵉ fois) |
| **Rejoindre** (nav mobile) | `onJoin` | **oui** |
| **Rejoindre la communauté** (sous les axes, mobile) | `onJoin` | **oui** |
| Découvrir les axes | scroll | non |
| Défiler (chevron) | scroll programmatique | non |
| Tags audience (×8) | `onJoin` | **oui** |
| Voir la politique de confidentialité | ouverture modale | non |
| Voir les 3 axes / Questions fréquentes | scroll | non |
| Lire la politique complète → | ouverture modale | non |
| Flèches et dots du carrousel | navigation interne | non |

---

## 2. Parcours de profilage (`profiling-flow.tsx` + `profiling/`, #26)

### 2.1 Enveloppe (`ProfilingShell`)

- Header sticky `h-14 max-w-2xl` : bouton **« Retour »** (icône `ArrowLeft` seule
  en mobile, texte masqué < `sm`) · libellé central `mono-label` =
  **« Ton profil HASHCODE »** (ou **« WhatsApp (presque fini) »** sur le groupe
  contact) · à droite **`~N min restantes` · `NN%`**.
- **Barre de progression** `h-0.5` lime, largeur animée.
- **Step tracker — 6 jalons** (scrollable horizontalement) :
  **Profil → Objectif → Rythme → Mentorat → Vision → Contact**, avec états
  actif (lime) / fait / à venir et séparateurs colorés.
- Main centré `max-w-2xl` ; microcopy de la question affichée au-dessus en lime
  italique.
- Footer : **« Tes réponses servent à mieux comprendre ton profil. »** + hint
  clavier `1` – `9` **pour choisir** (hors groupes vision et contact).
- **Le nombre d'étapes n'est jamais affiché** : uniquement le % et l'estimation
  en minutes.

### 2.2 Les 18 questions (12 à 16 réellement affichées)

| # | id | Type | Titre exact | Oblig. | Options / limites | Groupe | Condition |
|---|---|---|---|---|---|---|---|
| Q1 | `firstName` | text | « Comment devons-nous t'appeler ? » | ✅ | 1–40 car., placeholder `Ex. Eurin` | profil | — |
| Q2 | `email` | email | « Où t'envoyer ton profil et ton accès ? » | ✅ | regex email | profil | — |
| Q3 | `country` | country | « Tu vis dans quel pays ? » | ✅ | sélecteur recherchable | profil | — |
| Q4 | `primaryDomain` | radio | « Quel domaine t'attire le plus ? » | ✅ | 🌐 Web Development · 🛡️ Cybersecurity · 🤖 Applied AI | profil | — |
| Q5 | `domainSpecialty` | multi | « Qu'est-ce qui t'intéresse dans ce domaine ? » | ❌ | 6 options dynamiques selon le domaine | profil | domaine choisi |
| Q6 | `goal` | radio | « Qu'aimerais-tu accomplir avec HASHCODE ? » | ✅ | 🚀 Construire un projet · 💼 Trouver un emploi · 🧳 Devenir freelance · 📈 Monter en compétences · 🧩 Développer une activité · 🎯 Préparer une carrière · ✦ Autre chose | objectifs | — |
| Q7 | `goalSituation` | radio | « Où en es-tu aujourd'hui côté emploi ? » | ❌ | 🎓 Étudiant·e · 🔎 En recherche active · 🔄 En poste, je veux pivoter · 🌤️ Entre deux choses | objectifs | goal ∈ {employment, career} |
| Q8 | `goalProjectStage` | radio | « Où en est ton projet aujourd'hui ? » | ❌ | 💡 Juste une idée · 🧭 En réflexion / planification · 🚧 En cours de construction · 🚀 Déjà lancé | objectifs | goal ∈ {project, business} |
| Q9 | `level` | radio | « Où te situes-tu aujourd'hui ? » | ✅ | 🌱 Je débute · ⚙️ Je pratique déjà · 🧭 Je suis autonome · 🏆 Je suis avancé | objectifs | — |
| Q10 | `availability` | radio | « Combien de temps peux-tu consacrer à ta progression chaque semaine ? » | ✅ | Moins de 2 h *(Rythme léger)* · 2–5 h *(Constant)* · 5–10 h *(Engagé)* · 10–15 h *(Intensif)* · 15 h et plus *(Plein focus)* | rythme | — |
| Q11 | `learningStyle` | radio | « Comment progresses-tu le mieux ? » | ✅ | 🧩 En pratiquant · 🧭 Avec un parcours · 🤝 Avec un groupe · 🧑‍🏫 Avec un mentor · 🚧 En construisant un projet | rythme | — |
| Q12 | `mentoringInterest` | radio | « As-tu besoin d'un accompagnement personnalisé ? » | ✅ | Non *(« Je préfère avancer seul pour le moment. »)* · Peut-être *(« Je veux comprendre ce que ça peut m'apporter. »)* · Oui *(« Un accompagnement m'aiderait à progresser. »)* | mentorat | — |
| Q13 | `mentoringMaybeReason` | longtext | « Qu'est-ce qui pourrait te faire envisager un mentor ? » | ❌ | 4–240 car., placeholder `Ex. Si je me sens bloqué sur un projet concret.` | mentorat | interest = `maybe` |
| Q14 | `mentoringTypes` | multi | « Sur quoi aimerais-tu être accompagné ? » | ❌ | 6 options par domaine (labels sans emoji) | mentorat | interest = `yes` |
| Q15 | `mentoringFrequency` | radio | « À quelle fréquence aimerais-tu un accompagnement ? » | ❌ | Hebdomadaire · Toutes les 2 semaines · Mensuel · À la demande | mentorat | interest = `yes` |
| Q16 | `budgetRange` | radio | « Quel niveau d'investissement mensuel pourrais-tu envisager ? » | ❌ | 7 paliers FCFA + « Je ne sais pas encore » + **« Pas pour le moment »** | mentorat | interest ∈ {yes, maybe} |
| Q17 | `threeMonthGoal` | longtext | « Dans 3 mois, qu'aimerais-tu avoir accompli ? » | ✅ | 4–280 car. + **4 suggestions cliquables** | vision | — |
| Q18 | `phone` | text | « Ton numéro WhatsApp ? » | ❌ | placeholder `+229 ...` | contact | — |

**Suggestions 1-clic de Q17** : Décrocher mon premier stage · Finir mon
portfolio · Lancer mon premier projet · Être à l'aise avec les bases.

**Options dynamiques de Q5** :
- `web` : 🎨 Frontend · 🔧 Backend · 🏛️ Architecture · 🚧 Projet web · 🧳 Freelance · 💼 Carrière web
- `cybersecurity` : 🛡️ SOC / Blue Team · ⚔️ Pentest / Red Team · 🔍 OSINT · 💼 Carrière cyber · 📜 Certification · 🚧 Projet cyber
- `ai` : 🧠 LLM · 🤖 Agents · ⚙️ Automation · 🛠️ AI Engineering · 🚧 Projet AI · 💼 Business AI

**Options dynamiques de Q14** : mêmes valeurs, labels sans emoji.

**Microcopies** (affichées en lime italique avant la question) : « Parfait. C'est
parti. » · « On sauvegarde ton profil. » · « On commence à cerner ton profil. » ·
« Bien. On sait où tu veux aller. » · « On affine. » · « Ton profil prend forme. » ·
« Encore quelques choix. » · « Presque terminé. » · « Tu peux passer. »

**Branchement** : 12 questions toujours visibles + au plus 1 des Q7/Q8 (aucune
pour `freelance`, `upskill`, `other`) + 0/2/3 selon le mentorat (`no` → 0,
`maybe` → Q13 + Q16, `yes` → Q14 + Q15 + Q16).

### 2.3 Rendu des contrôles

- **Radio / multi** → `OptionCard` (`option-card.tsx`) : bouton pleine largeur,
  emoji qui grossit au survol, label + `hint` mono à droite, description,
  pastille radio (ou case à cocher avec `Check`), bordure lime + fond `lime/5`
  si sélectionné, `aria-pressed`. **Badge de raccourci clavier `1-9`** en haut à
  droite, visible au survol, desktop uniquement (`hidden sm:flex`).
- **Multi** : grille 1 colonne (2 sur `sm`), footer `{n} sélectionné(s)` /
  « Choisis au moins une option » / « Facultatif — tu peux passer », bouton
  `Continuer` ou `Passer`.
- **Texte** : input `autoFocus`, bouton `Continuer` (désactivé si requis et vide)
  ou `Passer`, mention « Facultatif ».
- **Longtext** : textarea 3 lignes `resize-none`, compteur `n/280`, message
  `Encore N caractères` (destructive si sous le minimum) puis « Une phrase
  suffit. », chips de suggestions pour `threeMonthGoal`.
- **Pays** → `CountrySelect` (`country-select.tsx`) : bouton `h-12`
  (« Sélectionne ton pays » puis drapeau + nom, bordure lime si choisi),
  popover Radix avec champ `Rechercher un pays…` (filtre insensible à la casse
  sur le nom ou le code, **sans normalisation d'accents**), liste `max-h-64`
  scrollable, drapeaux emoji, coche ✓ sur le pays courant, état
  **« Aucun pays trouvé. »**, fermeture par sélection / clic extérieur / Échap.

### 2.4 Navigation et clavier

- **Radio = auto-avance** : un clic sélectionne **et** passe à la question
  suivante (pas de bouton `Continuer`) → il faut `Retour` pour modifier.
- **Touches `1`-`9`** : sélectionnent l'option N (radio uniquement, ignorées si
  le focus est dans un `INPUT`/`TEXTAREA`/`SELECT`).
- **Entrée** : soumet les champs texte (pas les textareas).
- **Aucune navigation par flèches ←/→** entre questions.
- Désactivations : pays si vide ; multi si requis et 0 sélection ; texte si
  requis et vide ; textarea si vide.

### 2.5 Validation — messages exacts

| Cas | Message |
|---|---|
| radio sans valeur / valeur hors liste | `Choisis une option.` / `Option invalide.` |
| multi non tableau | `Sélection invalide.` (aucune borne min/max en UI) |
| texte requis vide | `Ce champ est requis.` |
| texte trop court / trop long | `Minimum N caractères.` / `Maximum N caractères.` |
| longtext requis vide | `Écris au moins une phrase.` |
| longtext trop court / trop long | `Sois un peu plus précis (min. N caractères).` / `Trop long (max. N caractères).` |
| email vide / invalide | `Ton adresse email est requise.` / `Format d'email invalide.` |
| pays vide | `Choisis ton pays.` |

Affichés dans un `<p role="alert">` sous le champ.

**Validation serveur (zod, `validate.ts`)** — messages complémentaires :
`Prénom requis`, `Email invalide`, `Numéro WhatsApp invalide (format
international : +229 ...)`, `Pays requis`, `Objectif trop court`, `Objectif trop
long`, `Ne devrait pas être défini sans intérêt mentorat` (budget incohérent).

### 2.6 Brouillon et reprise

- **localStorage chiffré**, clé **`hashcode:reboot:profiling`**, contenu
  `{answers, answeredIds, step}`, réécrit à chaque changement et effacé quand
  `answeredIds` est vide.
- **Au retour** : écran `ResumePrompt` — titre **« Tu avais un brouillon en
  cours. »** ou **« Tu as déjà un compte HASHCODE. »** (si un email était déjà
  saisi), texte « Tu as déjà répondu à N question(s). Tu peux reprendre là où tu
  t'étais arrêté. », boutons **« Reprendre »** et **« Recommencer »**
  (icône `RotateCcw`).
- **Brouillon serveur (relance email)** : `POST /api/profiling/draft`
  `{email, answers, lastQuestionId}` via `navigator.sendBeacon` (fallback
  `fetch keepalive`), déclenché sur `beforeunload` et sur
  `visibilitychange → hidden` (debounce 5 s), + `track profiling_abandoned`.
  No-op sans email.
- **Aucun indicateur visuel d'auto-sauvegarde pendant la saisie.**

### 2.7 Prévisualisation, transition et soumission

- Après `threeMonthGoal`, phase `preview` : HashSymbol + **« Ton profil HASHCODE
  est prêt. »**, sous-titre `{archétype} — {domaine}. Voici la première
  orientation qu'on tire de tes réponses.`, `ProfileCard` récapitulative, boutons
  **« Finaliser mon profil »** (saute à la question WhatsApp) et **« Modifier mes
  réponses »**, note **« Plus que ton WhatsApp pour recevoir ton invitation.
  15 secondes. »**
- Transition : écran **« On finalise ton profil… »** / **« Une seconde. »** avec
  HashSymbol animé.
- Soumission (`page.tsx` → `POST /api/members`) : phase `submitting` →
  **« On enregistre ton profil… »** + **« Contrôles automatiques en cours. »**
- Erreurs :
  - réseau → **« Connexion impossible. Ton profil est prêt — réessaie dans un
    instant. »** ; sur retry → **« Toujours impossible. Vérifie ta connexion. »**
  - API → message serveur ou **« Échec de la soumission. »**
  - bannière d'erreur flottante en haut + bouton **« Réessayer »**
  - mode « duplicate » → résultat recalculé localement avec `memberId: "local"`

### 2.8 Transitions et accessibilité

`AnimatePresence mode="wait"` + `motion.div` : glissement ±16 px / opacité,
240 ms, direction dépendante du sens de navigation. `role="alert"` sur les
erreurs, `autoFocus` sur les champs, `focus-lime` partout,
`prefers-reduced-motion` respecté par les animations CSS.
**Manques** : pas d'`aria-live`, pas d'`aria-label`, **pas de gestion du focus
sur le titre de la nouvelle question**.

---

## 3. Écran de résultat (`welcome.tsx`)

Titre commun : **« Bienvenue dans le Reboot. »**

| Branche | Sous-titre |
|---|---|
| `immediate` | **« Ton profil est enregistré. La nouvelle expérience HASHCODE se construit maintenant. »** |
| `pending` | **« Ton profil est enregistré. On te recontacte très vite pour ton invitation personnelle. »** |

- Bandeau **doublon** (si `duplicate`) : ShieldCheck + **« Tu as déjà commencé ton
  profil HASHCODE. »** / **« On a retrouvé ton profil. Voici où en est ton
  accès. »**
- **Branche immédiate** : `MonoLabel` **« Accès immédiat »**, h2 **« Tu peux
  rejoindre la communauté officielle maintenant. »**, texte « Ton profil est
  compatible avec HASHCODE. On t'ouvre l'accès tout de suite — pas d'attente,
  pas de friction. », mini-stats **Profil validé = APPROVED** / **Invitation =
  Envoyée**, heure locale `Maintenant · HH:MM`, ligne pays « Communauté locale :
  🇧🇯 {pays} — on te retrouvera aussi là. », et **`WhatsAppCapture`** si aucun
  téléphone.
- **Branche pending** : `MonoLabel` **« En traitement »**, h2 **« On prépare ton
  invitation personnalisée. »**, texte « Pour certaines inscriptions, une touche
  humaine fait une vraie différence. On revient vers toi par email avec ton
  accès. », **liste des raisons** issues du moteur automatique, mini-stats
  **Statut = EN ATTENTE** / **Contact = {email}**, note « Délai estimé : sous
  48 h. Vérifie tes spams — l'email vient de HASHCODE. »

### 3.1 Actions

| Action | Libellé exact | Comportement |
|---|---|---|
| Rejoindre la communauté (immédiate uniquement) | **« Rejoindre la communauté officielle »** + `MessageCircle` | lien externe `WHATSAPP_URL`, `target="_blank"` `rel="noopener noreferrer"`, track `whatsapp_join_clicked` |
| Retour | **« Retourner à HASHCODE »** (`outline`, `lg`) | `onReset()` |
| Partager | **« Partager mon profil »** / **« Lien copié ✓ »** | `navigator.share` (title « Mon profil HASHCODE », texte « Je viens de rejoindre le Reboot HASHCODE comme {archétype}. », URL `/?share={memberId}`), sinon presse-papiers + état 2 s ; track `share_profile_clicked` |
| Confidentialité | **« Confidentialité »** + `ShieldCheck` | ouverture `PrivacyModal` |
| WhatsApp phone capture | **« On t'ajoute directement au groupe ? »** / bouton **« Ajouter »** | `POST /api/account/phone {memberId, phone}` |
| Identifiant | bloc **ID** | `<code>` `select-all tabular-nums` avec `memberId` |

**`WhatsAppCapture`** : input `type=tel` `inputMode=tel` `autoComplete=tel`
`maxLength=40` `aria-label="Numéro WhatsApp"`, états `idle/saving/saved`.
Succès → **« C'est noté ! On t'ajoute directement au groupe WhatsApp. »** ;
erreurs `data.error ?? "Erreur. Réessaie."` ou **« Erreur réseau. Vérifie ta
connexion. »** ; microtexte « Laisse ton WhatsApp — sinon, utilise le lien
d'invitation reçu par email. »

**`EmailVerificationNudge`** (affiché hors doublon) : **« Vérifie ton email —
1 clic suffit. »** + « On t'a envoyé un 2e email avec un lien magique à {email}
(avec ton invitation). Clique dedans pour confirmer — valide 24 h, pas de code à
recopier. » + bouton **« Renvoyer le lien »** (spinner en cours, compte à
rebours) → `POST /api/verify-email`, cooldown 60 s.

> ⚠️ Les statuts affichés sont **codés en dur** (`"APPROVED"`, `"Envoyée"`,
> `"EN ATTENTE"`) ; `profileStatus` et `communityStatus` reçus ne sont jamais
> rendus. Le CTA WhatsApp est un **lien externe direct** : **aucun appel à
> `/api/community/join`** dans cet écran.

---

## 4. Authentification

### 4.1 `/login`

- Header `Retour` (→ `/`) + Logo. H1 **« Connexion »**, sous-titre **« Saisis
  l'email de ton compte HASHCODE. On t'envoie un code de connexion. »**
- Champ **Email** (`type=email`, `inputMode=email`, `autoComplete=email`,
  `autoFocus`), placeholder `toi@exemple.com`, validation client
  `Email invalide.`
- Bouton **« Recevoir mon code »** (état `Envoi en cours…` + spinner) →
  `POST /api/auth/request-magic-link` → redirection immédiate
  `/verify-otp?email=…&next=…`
- Lien **« Pas encore de compte ? Créer mon profil »** → `/`
- Erreurs (`role="alert"`) : 429 → **« Trop de demandes. Réessaie dans quelques
  minutes. »** ; autre → **« Une erreur est survenue. Réessaie. »** ; réseau →
  **« Erreur réseau. Vérifie ta connexion. »**
- `?next=` accepté uniquement s'il commence par `/` et pas `//` (sinon
  `/dashboard`) — le middleware injecte automatiquement `next=<page protégée>`
- **Aucun contrôle d'approbation** au login.

### 4.2 `/verify-otp`

- H1 **« Saisis ton code »**, texte **« On a envoyé un code à 6 chiffres + un
  lien 1-clic à {email}. »**
- **6 inputs** `inputMode=numeric` `maxLength=1` `aria-label="Chiffre N"`
  (`autocomplete="one-time-code"` sur le premier) : auto-avance, Backspace
  arrière, flèches ←/→, **collage intelligent** (extrait les chiffres, remplit
  et place le focus).
- **Auto-submit dès 6 chiffres** ; bouton **« Valider »** (`Vérification…`) →
  `POST /api/auth/verify-otp {email, otp}` → `router.push(next)` + `refresh()`.
- **Lien magique 1-clic** : détection de `?code=NNNNNN`, auto-submit unique, info
  **« Lien détecté — connexion automatique… »**, puis nettoyage de l'URL.
- Resend : **« Renvoyer le code (Ns) »** → `POST /api/auth/request-magic-link`,
  cooldown **60 s**, info **« Un nouveau code + lien ont été envoyés. Ils
  expirent dans 15 minutes. »** ; note **« Rien reçu ? Vérifie tes spams, puis
  renvoie un code. »**
- Erreurs : `INVALID_CODE` / `LOCKED` → **« Code invalide ou expiré. »** +
  vidage des 6 champs ; `RATE_LIMITED` → **« Trop de tentatives. Réessaie dans
  quelques minutes. »** ; réseau → **« Erreur réseau. Vérifie ta connexion. »**
- **Règles serveur** : OTP 6 chiffres (`crypto.randomInt`), hash bcrypt 12,
  **TTL 15 min**, **3 tentatives max** (puis session révoquée et code `LOCKED`),
  rate-limit 10/IP/10 min, anti-énumération (membre absent → `INVALID_CODE`).
  Le champ `remaining` renvoyé par l'API **n'est pas affiché**.

### 4.3 Session

Cookie `hashcode_session` : httpOnly, Secure en prod, SameSite=Lax, **TTL 30 j
glissant** (rafraîchi si `lastSeenAt > 1 h`), révoqué par
`POST /api/auth/logout`.

### 4.4 `/verify-email`

- Pendant : **« Vérification en cours… » / « Une seconde. »**
- Succès : eyebrow **« EMAIL VÉRIFIÉ »**, H1 **« C'est bon, ton email est
  confirmé. »**, `{email} — tu peux retourner à HASHCODE.`, boutons
  **« Retourner à HASHCODE »** et **« Se connecter »**.
- Erreur : eyebrow **« LIEN INVALIDE »**, H1 **« Ce lien ne marche plus. »**,
  messages `Lien manquant. Demande un nouveau lien depuis ton profil.` /
  `Lien invalide ou expiré.` / `Erreur réseau. Vérifie ta connexion puis
  réessaie.`, astuce « demande un nouveau lien depuis la fin de ton inscription
  ou ton espace. »
- **Liens email** : TTL **24 h**, usage unique, 1 actif par email, renvoi min
  **60 s** ; flag vérifié 30 j. `POST /api/verify-email/confirm` est
  **déprécié** (410).

---

## 5. Événements

### 5.1 `/evenements` — page publique

- Header sticky : logo + nav `Événements` (`aria-current="page"`, masqué < `sm`),
  `Axes` et `FAQ` (masqués < `md`), puis **`Mon espace`** (connecté) ou
  **`Se connecter`** ; bouton **`Rejoindre`** → `/` (anonyme, < `sm`).
  Footer : « HASHCODE · REBOOT — Édition 2026 » + « Retour à l'accueil ».
- H1 **« Événements HASHCODE REBOOT »**, sous-titre adapté :
  - connecté → « Sessions, workshops et meetups ouverts à la communauté.
    Inscris-toi en un clic [, {firstName}] — ton RSVP est enregistré dans ton
    espace. »
  - anonyme → « … Dis-nous que ça t'intéresse, puis crée ton profil pour
    t'inscrire officiellement. »
- **Filtres** : label `Type :` + icône `Filter`, boutons `Tous`, `Sessions`,
  `Workshops`, `Meetups`, `Webinaires` (`aria-pressed`).
  **Pas de filtre domaine, pas de recherche, pas de tri utilisateur.**
- Groupement par date (en-têtes `fr-FR` : *weekday day month year*), ordre
  `startsAt asc`, pas de pagination : **20 événements en SSR** puis refetch
  client à **50**.
- **Carte événement** : badge type (Session / Workshop / Meetup / Webinaire /
  Événement), titre, domaine (Web / Cyber / AI), niveau (Débutant / Pratiquant /
  Autonome / Avancé), badge **`Complet`** si 0 place, description, date lisible
  (`Aujourd'hui à HH:MM`, `Demain à HH:MM`, sinon date), durée, lieu (`MapPin`),
  récurrence (Chaque semaine / Toutes les 2 semaines / Chaque mois),
  `N inscrit(s)`, `N intéressé(s)` (anonyme seulement), lien externe (title
  « Ouvrir le lien de l'événement »), badge **`EN DIRECT`** pulsé avec bordure
  rouge.
- **Actions** :
  - connecté sans RSVP → **« Je participe »** + **« Peut-être »**
  - `going` → **« Inscrit · Annuler »** ; `maybe` → **« Peut-être · Annuler »**
    (toggle optimiste, `POST` / `DELETE /api/events/{id}/rsvp`)
  - anonyme → **« Ça m'intéresse »** (dédupliqué localement via
    `localStorage["hashcode:event-interest"]`, track `event_interest`) et
    **« Créer mon profil pour m'inscrire »** ; une fois intéressé → badge
    **« Intérêt enregistré »**
  - mention anonyme : « "Ça m'intéresse" est un signal anonyme : aucun compte
    requis, aucune donnée personnelle collectée. Pour t'inscrire réellement,
    crée ton profil — tu pourras alors t'inscrire en un clic depuis ton espace. »
- **États** : spinner `aria-label="Chargement"` · erreur `AlertTriangle` +
  **« Impossible de charger les événements. »** · vide **« Aucun événement à
  venir pour le moment. »** / **« Les prochaines sessions seront annoncées
  ici. »**
- **Capacité pleine, événement passé ou terminé** : contrôlés **côté serveur
  uniquement** (409 / 400 / 404).

---

## 6. Profil public `/profile/[id]`

- `generateMetadata` : titre `{firstName} — HASHCODE Profile`, description
  `{archetype} · {domain} · {level}` ; introuvable → 404 dédiée :
  **« Profil introuvable »** + **« Ce profil n'existe pas ou a été supprimé. »**
  + **« ← Retour au site »**.
- Carte : eyebrow **« Profil public »**, H1 italique `{firstName}`, badge
  **« HASHCODE »** avec point lime pulsé, « # » décoratif, archétype en lime
  italique, grille 2×2 **Domaine / Niveau / Disponibilité / Objectif**, bloc
  conditionnel **« Ouvert au mentorat »**, bloc **« Objectif 3 mois »**, tags,
  CTA **« ← Rejoins le réseau HASHCODE »**.
- **Champs jamais exposés par l'API** : email, téléphone, ville, genre, statuts
  internes. Seuls `id`, `firstName`, `archetype`, `primaryDomain`, `level`,
  `goal`, `availability`, `mentoringInterest`, `threeMonthGoal`, `tags`,
  `accessLane` sont projetés.

---

## 7. Espace membre `/dashboard`

### 7.1 Garde d'accès et enveloppe

- Middleware : `/account/*` et `/dashboard/*` sans cookie → `302
  /login?next=<pathname>` ; `/api/account/*` → `401 {error:"Non authentifié.",
  code:"UNAUTHENTICATED"}`. Le middleware **ne vérifie que la présence** du
  cookie, pas sa validité en base.
- `dashboard/layout.tsx` : top bar sticky + sidebar desktop / drawer mobile +
  `main pb-20 md:pb-0` + bottom nav mobile.
- `loading.tsx` : skeleton `role="status" aria-label="Chargement du
  dashboard"`, 4 blocs, `max-w-4xl`.
- **Aucun `error.tsx`** sous `/dashboard` (error boundary Next par défaut).

### 7.2 `/dashboard` — vue d'ensemble

- Redirection automatique vers `/dashboard/profile-complet` si
  `profileStatus === "PENDING"` et objectif vide.
- Cartes : **WelcomeCard** (prénom, archétype, « Membre depuis {mois année} ») ·
  **StatusCard** (statut de profil + statut communauté, pastille « En attente »,
  libellés FR) · **ProfileSummary** (domaine, niveau, rythme, style, mentorat +
  tags) · **NextSteps** · **QuickActions** (**« Rejoindre WhatsApp »** →
  `/api/community/join`, **« Compléter mon profil »**, **« Voir mon profil
  public »**) · **AgendaCard** (prochains événements + RSVP inline).
- **Bannière WhatsApp** si aucun téléphone (`page.tsx:38-48`) : encart lime
  cliquable menant aux paramètres.
- Si le profil n'a pas de domaine exploitable : **« Profil en cours de
  génération… »**.

### 7.3 `/dashboard/agenda`

Liste des événements à venir avec les mêmes cartes + RSVP que la page publique,
en mode connecté (`memberId=me`). États : spinner `Loader2`, erreur
**« Impossible de charger l'agenda. »**, état vide avec message + sous-message.
RSVP : 3 statuts (`going`, `maybe`, `cancelled`), mise à jour **optimiste** ;
un événement `EN DIRECT` n'a **aucun bouton RSVP** (badge seul).

### 7.4 `/dashboard/profile`

- **ProfileSummary / StatusCard** en lecture (archétype, domaine, niveau, tags,
  statut, lane d'accès).
- **`GoalEditor`** : édition de l'objectif à 3 mois, états
  `dirty/loading/error/success`, alertes `role`, bouton désactivé hors
  modification.
- **`ShareProfile`** : lien public `/profile/{id}` + copie presse-papiers.

### 7.5 `/dashboard/profile-complet`

Formulaire de finalisation post-inscription, hydraté depuis
`/api/account/me` : prénom, nom, téléphone, ville, pays, domaine principal,
niveau, objectif, disponibilité, style d'apprentissage, objectif à 3 mois.
Bouton **« Confirmer mon profil »** → `POST /api/account/complete-profile`
(refuse si déjà finalisé : `409` **« Ton profil est déjà finalisé. »**).

Écran de succès :

| Cas | Icône | Titre | Sous-texte |
|---|---|---|---|
| `profileStatus === "APPROVED"` | `CheckCircle2` lime | **« Profil validé, bienvenue. »** | `Ton profil {archetype} est confirmé. Rejoins la communauté.` |
| sinon | `Clock` amber | **« Profil reçu, on l'examine. »** | **« Notre équipe relit ton dossier sous 48 h. Tu recevras un email. »** |

Boutons : **« Rejoindre WhatsApp »** (uniquement si approuvé) →
`/api/community/join` ; **« Voir mon espace »** → `/dashboard`.

> ⚠️ `mentoringInterest` est forcé à `"no"` sans UI ; ni genre ni spécialités ne
> sont collectés ici.

### 7.6 `/dashboard/settings`

**Mes coordonnées** (`ContactForm`) — en-tête « mets-les à jour à tout moment » :

| Label | Type | Oblig. | Limite | Défaut | Note |
|---|---|---|---|---|---|
| **Email** | email | — | — | `member.email` | **désactivé + note « Pour changer ton email, contacte-nous via WhatsApp. »** |
| **Prénom** | text | — | — | `member.firstName` | **désactivé** |
| **Nom (facultatif)** | text | non | 60 | `member.lastName` | placeholder `Ex. Dossou` |
| **WhatsApp** | tel | non | 40 | `member.phone` | `+229 ...` ; « Format international (+229...). On utilise ce numéro pour t'inviter au groupe. » |
| **Ville (facultatif)** | text | non | 80 | `member.city` | `Ex. Cotonou` |
| **Genre (facultatif)** | select | non | — | `member.gender` | Ne pas préciser / Homme / Femme / Autre / Préfère ne pas dire |
| **Objectif à 3 mois** | textarea | non | 280 | `member.threeMonthGoal` | « 4 caractères minimum. C'est ce qui t'aide à la validation. » + compteur `n / 280` |

- Bouton **« Enregistrer »** (`Enregistrement…`), désactivé si `loading` ou
  aucune modification → `PATCH /api/account/profile` (`{lastName, phone, city,
  gender|null, threeMonthGoal}`).
- Messages : **« Modifications enregistrées. »** ; 429 → **« Trop de
  modifications. Réessaie dans quelques minutes. »** ; sinon serveur ou
  **« Erreur lors de la mise à jour. »** ; réseau → **« Erreur réseau. Vérifie
  ta connexion. »**

**Compte** (lecture seule) : Email · Pays · Membre depuis + note « Pour changer
ton email, contacte-nous via WhatsApp. La suppression de ton compte se fait
ci-dessous, dans “Mes données”. »

**Mes données** (RGPD #64, `DataSection`) : **« Exporter mes données »**
(`GET /api/account/export` → téléchargement `hashcode-mes-donnees.json` :
profil, RSVP, ateliers, emails, brouillon, sessions, analytics plafonnés à
500) ; **« Supprimer mon compte »** (zone danger : clic → saisie du mot exact
`SUPPRIMER` → `DELETE /api/account` → soft-delete + blacklist anti-relance +
révocation toutes sessions + retour `/`).

**Session** : **« Déconnecte cet appareil. »** + `LogoutButton` **« Se
déconnecter »**.

### 7.7 `/dashboard/ateliers` — ateliers (membre)

- **Liste** (`ateliers/page.tsx`) : cartes par atelier (titre, badges
  domaine/niveau, barre de progression `transition-[width]`, états
  inscrit/non-inscrit) ; CTA **« Découvrir » / « Continuer »**
  (`aria-label="Continuer vers l'atelier …"`, `focus-visible:ring-lime`) ;
  états chargement (`Loader2 motion-reduce:animate-none`), erreur et vide
  **« Aucun atelier disponible pour le moment. »**.
- **Détail** (`ateliers/[slug]/page.tsx`) : header (titre, badges, progression
  globale), **« S'inscrire »** (`EnrollButton`, `aria-label="S'inscrire à
  l'atelier"`, `Inscription…` pendant l'envoi) puis liste des séances par
  semaine (`SessionStateBadge` : verrouillée/débloquée/terminée), liens
  séance avec `aria-label="Accéder à la séance …"`.
- **Séance** (`ateliers/[slug]/sessions/[sessionId]/page.tsx`,
  `SessionDetailView`) : activités dans l'ordre, livrable + soumission
  (textarea + envoi, feedback affiché après review), **quiz interactif**
  (questions sans réponses exposées — ADR-004 —, score + passé/échoué après
  soumission, nouvelle tentative si échoué).
- **Progression verrouillée** : séance N inaccessible tant que N−1 non
  terminée (ADR-002, `getSessionAccess` côté serveur) ; inscription,
  soumission, review et tentative de quiz déclenchent chacun un **email
  transactionnel** (`src/lib/workshop-emails.ts`, fire-and-forget).
- **Admin** (`/admin/ateliers` : liste + détail `[id]` + `submissions`) :
  création/édition d'ateliers, revue des soumissions (**Approuvé / Révision /
  Rejeté** + feedback → email au membre), stats. Entrée **Ateliers**
  (`BookOpen`) dans `AdminSidebar` et la bottom nav admin.

---

## 8. Chrome de navigation (espace membre)

- **Top bar** (`h-14`, sticky, `bg-card/80 backdrop-blur-sm`) : logo → `/`,
  prénom (masqué < `sm`), bouton de déconnexion.
- **Sidebar desktop** — pliable `w-56` ↔ `w-[60px]`, état persisté dans
  `localStorage["sidebar-collapsed"]`, tooltips en mode replié :

  | # | Label | href | Icône |
  |---|---|---|---|
  | 1 | **Vue d'ensemble** | `/dashboard` | `LayoutDashboard` |
  | 2 | **Ateliers** | `/dashboard/ateliers` | `BookOpen` |
  | 3 | **Agenda** | `/dashboard/agenda` | `Calendar` |
  | 4 | **Mon profil** | `/dashboard/profile` | `User` |
  | 5 | **Paramètres** | `/dashboard/settings` | `Settings` |

  Bas de bloc : **WhatsApp** (lien externe tracké, `MessageCircle`) et
  **Déconnexion** (`LogOut`). Lien actif : `bg-lime/10 text-lime font-medium`.
- **Drawer mobile** : overlay flouté cliquable, panneau 288 px glissant
  (`-translate-x-full` ↔ `0`), logo + prénom + bouton fermer
  (`aria-label="Fermer le menu"`), fermeture sur Échap, sur changement de route,
  et verrouillage du scroll de fond.
- **FAB hamburger** : rond lime 48 px en bas à gauche (`fixed bottom-5 left-5
  z-50`, `hover:scale-105 active:scale-95`), `aria-label="Ouvrir le menu"`.
- **Bottom nav mobile** (`md:hidden`, `paddingBottom: env(safe-area-inset-bottom)`,
  `aria-label="Navigation principale"`) : **Accueil · Ateliers · Agenda · Profil ·
  Paramètres**, barre lime en haut de l'onglet actif, `aria-current="page"`,
  cibles 44 px (ce sont des `<a href>`, donc rechargement complet).
- `LogoutButton` : `POST /api/auth/logout` (idempotent) puis `/login` +
  `router.refresh()`.

---

## 9. Composants transverses

| Composant | Où | Détail |
|---|---|---|
| **CookieConsent** | landing uniquement | localStorage `hashcode:reboot:consent` ; texte « HASHCODE utilise des cookies anonymes pour mesurer le parcours (entonnoir) et améliorer l'expérience. Aucune publicité, aucune revente. » ; boutons **Accepter** / **Refuser** / X (`aria-label="Fermer et refuser"`) ; `fixed bottom-4 z-50` + animation ; **aucun effet réel sur `track()`**, non réouvrable après choix |
| **PrivacyModal** | landing + profilage + résultat | Titre **« Tes données. Ton profil. Ton choix. »** + 5 sections (Ce qu'on collecte / Pourquoi on les collecte / Combien de temps — suppression sous 30 jours / Tes droits — accéder, corriger, exporter, supprimer, retirer / Sécurité) + `privacy@joinhashcode.com` + footer « Hashcode · Reboot — v1.0 · Édition 2026 » ; fermeture overlay / Échap / X ; `max-w-[100vw] md:max-w-lg max-h-[85vh]` scrollable |
| **OfflineBanner** | landing uniquement | détection `online`/`offline` ; **« Tu es hors-ligne. Tes réponses sont sauvegardées — reconnecte-toi pour soumettre ton profil. »** + `WifiOff` ; bandeau amber en haut (pas de `role`) |
| **Loading global** | toutes pages | `role="status" aria-label="Chargement en cours"` + HashSymbol pulsé + « Chargement… » |
| **global-error** | global | « Une erreur s'est produite 😔 » + « Quelque chose a mal tourné de notre côté. L'équipe a été notifiée automatiquement. » + `Référence : <digest>` + bouton **Réessayer** + contact `support@joinhashcode.com` |
| **TopLoader** | global | barre lime 3 px en haut, sans spinner |
| **Toaster** | global | toasts shadcn |
| **TanStack Query** | global | `staleTime` 60 s, `gcTime` 24 h, `refetchOnWindowFocus: false`, `retry: 2`, redirection sur `unauthorized` |

---

## 10. Primitives UI

- **`RebootButton`** : tailles `sm/md/lg` (44-48 px), variantes `primary`
  (lime/black), `outline`, `ghost` ; `focus-lime`, `disabled:opacity-50`,
  transition 180 ms.
- **`CtaArrow`** : flèche qui translate de 0,5 px au survol du parent.
- **`Tag`** : chip arrondi 44 px ; `onClick` → `<button>`, sinon `<span>` ;
  état actif lime.
- **`MonoLabel`**, `SectionHeader` (index + titre + intro), `Eyebrow`,
  `Hairline`, `Card`, `HashBullet`, `ScrollReveal` (fade/slide au scroll, utilisé
  sur 2 sections).
- **`OptionCard`** et **`CountrySelect`** : voir §2.3.
- **`ProfileCard`** : carte récapitulative (hairline lime, coins `┌ ┐`, glow,
  badge **REBOOT** pulsé, HashSymbol, archétype italique + emoji, grille 2×2
  **Domaine / Niveau / Objectif / Rythme / Style / Mentorat**, bloc « Objectif à
  3 mois », max 8 tags).
- **`Logo` / `HashSymbol`** : identité de marque (H stylisé, lime).

---

## 11. Règles métier visibles par l'utilisateur

### 11.1 Archétypes (calculés par le moteur)

| Condition | Archétype |
|---|---|
| `primaryDomain = cybersecurity` | 🛡️ **CYBER BUILDER** |
| `primaryDomain = ai` | 🤖 **AI EXPLORER** |
| `web` + niveau `advanced` ou `autonomous` | 🏛️ **WEB ARCHITECT** |
| `web` + niveau `beginner` ou `practicing` | 🌐 **WEB BUILDER** |
| fallback (domaine absent/inconnu) | ✦ **HASHCODE BUILDER** |

### 11.2 Bascule d'accès automatique (`runAutoControls`)

Le profil passe en **accès immédiat** (`accessLane=immediate`,
`profileStatus=APPROVED`, `communityStatus=INVITED`) **par défaut**.
Il bascule en **pending** (`PENDING`, `NOT_INVITED`) si au moins une raison est
détectée :

| Raison (code) | Libellé affiché à l'utilisateur | Déclencheur |
|---|---|---|
| `missing-core` | Informations essentielles à confirmer | email/nom/domaine/objectif/niveau/disponibilité incomplets |
| `disposable-email` | Adresse email à vérifier | domaine dans la blacklist jetable (12 domaines : mailinator, guerrillamail, 10minutemail, tempmail, temp-mail, throwawaymail, yopmail, trashmail, getnada, maildrop, sharklasers, dispostable) |
| `low-signal-goal` | Objectif à préciser ensemble | objectif 3 mois < 4 caractères |
| `high-value-mentoring-lead` | Demande d'accompagnement prioritaire | mentorat `yes` + budget ≥ 20 000 FCFA |

> ⚠️ Les états `REJECTED` et `WAITLIST` existent dans le modèle mais **ne sont
> jamais produits** par ce flux ; `accessLane` n'a que 2 valeurs
> (`immediate`, `pending`).

### 11.3 Tags générés (max 8 affichés)

`CYBER` / `WEB` / `AI` · `BEGINNER` / `ADVANCED` · `EMPLOYMENT-FOCUSED` ·
`PROJECT-FOCUSED` · `FREELANCE-FOCUSED` · `HIGH-AVAILABILITY` · `LIGHT-RHYTHM` ·
`MENTORING-INTERESTED` / `MENTORING-CURIOUS` · `PROJECT-LEARNER` ·
`HIGH-BUDGET` · `COUNTRY:<pays>` · `GENDER:<genre>`.

---

## 12. API appelées par l'interface + protections

| Route | Méthode | Auth | Rate-limit | Rôle dans l'UI |
|---|---|---|---|---|
| `/api/community/count` | GET | public | 30/IP/10 min | compteur landing |
| `/api/members` | POST | public | — | soumission du profilage |
| `/api/profiling/draft` | POST | public | — | brouillon de relance email |
| `/api/auth/request-magic-link` | POST | public | 5/IP/10 min | login + renvoi OTP |
| `/api/auth/verify-otp` | POST | public | 10/IP/10 min + 3 essais | connexion |
| `/api/auth/logout` | POST | public | — | déconnexion |
| `/api/verify-email` | GET / POST | public | 10/IP/10 min · 5/IP/10 min + 60 s/email | vérification et renvoi de lien |
| `/api/check-email` | GET | public | 10/IP/10 min | sonde de santé (aucun appel UI) |
| `/api/community/join` | GET | session (sinon `302 /login`) | — | marque `JOINED` puis redirige vers WhatsApp |
| `/api/account/me` | GET | session | — | hydratation du dashboard |
| `/api/account/profile` | PATCH | session | 10/IP/10 min | coordonnées |
| `/api/account/complete-profile` | POST | session | 10/IP/10 min | finalisation (409 si déjà finalisé) |
| `/api/account/phone` | POST | **aucune session** (memberId en body) | 5/IP/10 min | capture WhatsApp post-inscription, remplissage unique, réponse anti-énumération |
| `/api/events` | GET | session | — | agenda membre (`memberId=me`) |
| `/api/events/[id]/rsvp` | POST / DELETE | session | 5/membre/10 min | inscription / annulation |
| `/api/public/events` | GET | public | 60/IP/min | liste publique |
| `/api/profile/[id]` | GET | public | — | profil public |
| `/api/members/[id]/share` | GET | public | 30/IP/10 min | vue `?share=` |

**Bannière WhatsApp par défaut** :
`https://chat.whatsapp.com/JwJGgoQpS46I9r81QPrCs4` (surchargée par `WHATSAPP_URL`
ou `NEXT_PUBLIC_WHATSAPP_URL`).

---

## 13. Événements analytics instrumentés

`reboot_page_view` (dont `ref:"shared-profile"` et `ref:"relance-resume"`) ·
`profiling_resumed` · `profiling_started` · `reboot_cta_clicked` ·
`profiling_completed` · `profiling_question_answered` · `profiling_question_timed` ·
`profiling_abandoned` · `event_rsvp` · `event_interest` · `whatsapp_join_clicked` ·
`share_profile_clicked`.

Défini mais **jamais appelé** : `community_cta_clicked`.

---

## 14. Limites et anomalies constatées (factuelles, non corrigées)

1. **RSVP optimiste jamais annulé** : `handleRsvp` ne teste pas `res.ok` → sur
   `409` « L'événement est complet. », `404`, `429` ou `403`, l'UI affiche quand
   même « Inscrit » (le `catch` ne couvre que le réseau).
2. **`PublicProfileCard`** : tables de correspondance désalignées
   (`fulltime/parttime/weekends/evenings` vs valeurs DB `<2h…15h+`) →
   disponibilité, objectif et mentorat s'affichent parfois en **codes bruts**.
3. **Compteur communauté** : aucun état de chargement/erreur distinct, pas
   d'animation ; « 0 » et « erreur » donnent tous deux « 1ère ».
4. **Profil public** : deux fetchs `no-store` par affichage (page +
   `generateMetadata`), et l'URL absolue dépend de `NEXT_PUBLIC_URL` (fallback
   `localhost:3000`).
5. **Landing** : pas d'état connecté (un membre voit toujours « Se connecter »),
   pas de menu burger, `?share=` et `?resume=` écrasent la landing sans
   possibilité de fermer la vue partage autrement qu'en cliquant le CTA.
6. **Chevauchement mobile** : le FAB hamburger (`bottom-5`, z-50) recouvre la
   bottom nav (`h-14`, z-40) sur les écrans < `md`.
7. **Cookie consent décoratif** : `track()` n'est pas conditionné au choix, et la
   bannière ne peut plus être rouverte.
8. **Offline banner** sans `role="status"`, limité à la landing.
9. **Deux éditeurs du même champ** `threeMonthGoal` (`GoalEditor` sur
   `/dashboard/profile` et `ContactForm` sur `/dashboard/settings`) avec des
   textes d'aide différents.
10. **Profilage** : `multi_choice` sans borne min/max côté UI (seul zod borne à
    6) ; `phone` sans validation dans le moteur de questions ; bouton « Retour »
    masqué sur mobile ; pas de gestion du focus à chaque changement de question ;
    champs non collectés (`gender`, `secondaryDomains`, `availabilityTimes`,
    `mentoringDomain`, `city`, `lastName`).
11. **`/dashboard/profile-complet`** envoie `mentoringInterest: "no"` en dur, ce
    qui fausse les tags de mentorat.
12. **`verify-otp`** : le champ `remaining` (essais restants) n'est jamais
    affiché ; après un `LOCKED`, l'utilisateur peut retaper un code mais la
    session est révoquée → seul le renvoi d'un code permet de repartir.
13. **`/evenements`** : un cookie présent mais une session expirée donne un `401`
    → message générique « Impossible de charger les événements. » sans
    redirection vers `/login`.
14. **Anti open-redirect** (`?next=` et `?code=`) : bloque `//` mais pas `/\`
    (backslash) ni les schémas encodés.
15. **`PublicProfileCard`** : filet décoratif `absolute` sans conteneur parent
    `relative`.

---

## 15. Références

- `docs/espace-membre.md` — fonctionnement complet de l'espace membre (état au
  2026-09-09).
- `src/app/page.tsx` — machine à phases du parcours public.
- `src/components/reboot/profiling-flow.tsx` (orchestrateur) + `profiling/`
  (storage, use-debounce, draft, shell, resume-prompt, question-view, views,
  preview), `welcome.tsx`, `profile-card.tsx`,
  `option-card.tsx`, `country-select.tsx`, `landing.tsx` + `landing/` (data,
  scroll, account-link, site-header, hero, axes, pillars, audience,
  testimonial, coming, faq, faq-section, final-cta, social-proof,
  site-footer, sticky-cta),
  `public-events.tsx`, `profile/PublicProfileCard.tsx`.
- `src/lib/profiling/questions.ts`, `engine.ts`, `validate.ts`, `auto-controls.ts`,
  `types.ts`, `labels.ts`.
- `src/app/dashboard/**`, `src/app/account/**`, `src/middleware.ts`.
- Ateliers : `src/app/dashboard/ateliers/**` (liste, détail, séance,
  `_components/EnrollButton.tsx`, `SessionDetailView.tsx`,
  `SessionStateBadge.tsx`), `src/app/admin/ateliers/**`,
  `src/lib/workshop-*.ts`, `docs/ateliers/ARCHITECTURE.md`,
  `docs/ateliers/AUDIT-UX.md`, `docs/adr/ADR-001` à `ADR-004`.
