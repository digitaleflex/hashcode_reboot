# Audit UX — Dashboard Admin 360° (2026-10-10)

## Contexte et périmètre

Dépôt : `digitaleflex/hashcode_reboot`
Baseline examinée : branche `main`
Page : `src/app/[locale]/admin/dashboard/page.tsx`
Composants principaux : `AdminStats`, `HealthAlertsBanner`, `EmailEngagement`, `ActivationSection`, `EmailDeliverabilitySummary`, `EmailOpsSection`, `CronHealthSection`, `CohortRetention`, `LoginActivity`, `ActivityLog`.

Audit statique du code et de la capture. Aucune commande de build, test ou interaction avec la production n'a été exécutée pendant cet audit.

## Diagnostic — constats vérifiés

1. **Composition dense :** la route compose directement neuf grandes sections analytiques/opérations sur une page longue. Certaines sections s'auto-chargent (`ActivationSection`, `CohortRetention`, `LoginActivity`, `ActivityLog`).
2. **Rafraîchissement fréquent :** les données du dashboard sont repollées toutes les 30 secondes et rechargées quand l'onglet redevient visible. Vérifier les requêtes en doublon avec les composants auto-chargeurs.
3. **Horodatage relatif figé :** le rendu calcule `Date.now() - lastRefresh`, mais aucun timer dédié ne provoque de rendu régulier. La durée affichée peut rester figée jusqu'au prochain rendu.
4. **Erreurs potentiellement répétées :** erreurs de sections affichées en groupe au-dessus du dashboard puis réaffichées sous certaines sections. Clarifier le traitement global/sectionnel.
5. **Action inerte :** `onCronsClick={() => {}}` rend le CTA « Vérifier les crons » sans action réelle.
6. **Alertes partiellement visibles :** la bannière montre jusqu'à cinq alertes, et résume les suivantes par un compteur. Prévoir un accès explicite au détail.
7. **Mélange de contextes :** communauté, acquisition, délivrabilité email et santé technique cohabitent dans un seul flux vertical.
8. **Analyse avancée trop présente :** pays, niveaux, budgets, archétypes, rétention, logins et historique d'activité sont pertinents mais ne devraient pas tous avoir le même poids que les actions prioritaires.
9. **Composants d'administration déjà disponibles :** palette de commandes, sidebar, compteur de notifications, navigation mobile et déconnexion. Les réutiliser au lieu d'ajouter une nouvelle navigation.
10. **Design system existant :** le projet a déjà des tokens dark/lime et des composants shadcn. Ne pas introduire de palette ou bibliothèque parallèle.

## Constats visuels sur la capture

- Texte, légendes et métadonnées trop petits à l'échelle de la page.
- Densité élevée, nombreuses sections courtes et défilement interminable.
- Graphiques similaires visuellement sans hiérarchie nette des informations.
- Alertes système et rappel de session flottant concurrencent le contenu.
- Certains KPI ne montrent pas immédiatement période, définition ou contexte.

## Recommandations classées

### P0 — Fiabilité et actions

- Câbler le CTA de santé CRON vers un ancrage ou une route existante pertinente.
- Corriger le libellé relatif du dernier rafraîchissement, ou afficher une heure fixe mise à jour au prochain refresh.
- Dédupliquer et hiérarchiser les erreurs globales et sectionnelles.
- Distinguer clairement zéro donnée, données indisponibles, chargement et erreur.
- Vérifier les requêtes du polling à 30 secondes et des sections auto-chargeuses ; ne pas modifier la fréquence sans mesure.
- Garder les alertes critiques en haut et permettre l'accès au détail de toutes les alertes.

### P1 — Nouvelle hiérarchie, sans nouvelle architecture

1. En-tête : titre, contexte, dernière actualisation, action rafraîchir.
2. Centre d'alertes : incidents et actions prioritaires.
3. Résumé exécutif : 4 à 5 KPI primaires (membres, attente, activation, engagement).
4. Acquisition/engagement : funnel et tendance temporelle si disponibles.
5. Opérations email : délivrabilité et quotas regroupés visuellement.
6. Santé système : crons dans une section compacte et explicite.
7. Analyses détaillées : rétention, activité de connexion et journal dans des panneaux repliables ou routes existantes adaptées.

Ne retirer aucune fonctionnalité sans inventaire d'usage et validation produit.

### P2 — Finition visuelle

- Augmenter le texte secondaire courant vers 14 px et éviter les textes importants en 10–11 px.
- Réserver le lime aux actions primaires et aux signaux positifs importants.
- Unifier padding, rayon, espacement et bordures avec les tokens existants.
- Renforcer la hiérarchie typographique des titres de sections et raccourcir les descriptions.
- Utiliser des barres horizontales et tableaux lisibles pour les comparaisons ; éviter d'ajouter des donuts sans besoin.
- Vérifier contrastes, focus clavier et cibles tactiles d'au moins 44 px pour les actions importantes.
- Respecter `prefers-reduced-motion` et éviter `transition-all` quand une seule propriété change.

### P3 — Responsive et perception de performance

- Vérifier à 1440, 1280, 1024, 768 et 390 px.
- Réduire à une colonne quand la largeur manque et éviter la troncature sans accès au contenu complet.
- Harmoniser les états de chargement par module.
- Fournir des états vides/erreurs lisibles et des résumés textuels de graphiques si nécessaire.

## Ordre d'implémentation

1. Capturer la baseline visuelle et relever l'état des tests/build.
2. Corriger les actions inertes et incohérences d'état.
3. Réorganiser la composition du dashboard et améliorer le premier écran.
4. Améliorer typographie, espacements, contrastes et responsive dans les composants concernés.
5. Comparer les captures et lancer typecheck, lint, tests pertinents et build.

## Contraintes et non-objectifs

- Ne pas toucher à l'authentification, aux rôles, au CSRF, aux API métier ou à Prisma pour un chantier UX.
- Ne pas modifier les variants shadcn partagés sans capture de référence et revue.
- Ne pas ajouter de bibliothèque de charts/UI : Recharts, lucide-react, Tailwind et shadcn sont déjà présents.
- Ne pas modifier le parcours de profiling ni le moteur d'orientation.
- Ne pas déployer ni modifier des données de production pour ce chantier visuel.

## Critères d'acceptation

- Les alertes importantes et les actions prioritaires sont visibles sans parcourir toute la page.
- Aucun bouton présenté comme actionnel n'est inerte.
- Les états loading / empty / unavailable / error sont distincts.
- Les textes et données restent lisibles sur laptop et mobile.
- Le thème dark/lime existant est conservé.
- Typecheck, lint et tests pertinents passent ; les limites restantes sont consignées.