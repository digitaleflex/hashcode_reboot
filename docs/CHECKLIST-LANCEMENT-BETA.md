# Checklist de lancement — bêta fermée

Complète `docs/deployment-checklist-v1.md` (déploiement technique, VPS, sauvegardes).
Ce document répond à une autre question : **est-on prêt à faire entrer de vraies personnes ?**

Principe : on ouvre d'abord à quelques dizaines de personnes, on mesure, on corrige,
puis on élargit. Le parrainage, l'annuaire des membres et la modération viennent après.

## 0. Le parcours complet tourne (à relancer avant chaque ouverture)

Script de parcours de bout en bout, sur une base **de test** :

```bash
DATABASE_URL=postgresql://… BASE_URL=http://localhost:3000 npm run smoke:journey
```

Il déroule : inscription → connexion par code → espace membre → l'admin crée une
mission et un événement → le membre démarre, soumet, s'inscrit → l'admin valide →
contrôles de sécurité (rôles, CSRF, admin supprimé ou blacklisté, consentements d'un tiers).
Il refuse de tourner sur une base non locale (sauf `SMOKE_ALLOW_REMOTE=1`) et nettoie ses données.

- [ ] Tous les contrôles passent (état au 20/10/2026 : 34 sur 34 en local).

**Ce que ce script ne couvre pas** : les ateliers (séances, livrables, quiz), le mentorat,
l'envoi réel des emails, les tâches planifiées, l'interface dans un navigateur, le mobile.
À vérifier à la main (section 3).

## 1. Variables d'environnement de production

Voir le tableau de `deployment-checklist-v1.md` §1, plus ce que les PR d'audit ont ajouté :

- [ ] `BREVO_WEBHOOK_SECRET` : **secret dédié**. Il ne retombe plus sur `CRON_SECRET`.
      Sans lui, le webhook Brevo répond 404 et les rebonds d'emails ne sont plus traités.
      URL à déclarer chez Brevo : `https://<domaine>/api/webhooks/brevo?secret=<valeur>`.
- [ ] `TRUSTED_PROXY_HOPS` : `1` si Traefik est seul devant l'app (valeur par défaut),
      `2` si un CDN (ex. Cloudflare) est devant Traefik. Une mauvaise valeur fausse le
      rate-limit (tout le monde partage une IP, ou le contournement redevient possible).
- [ ] `CRON_SECRET`, `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD` : générés, longs, différents.
- [ ] `ADMIN_OPERATORS` : ton email. Le rôle n'est posé que si le membre existe déjà :
      te connecter une première fois via `/login`, puis relancer `ensure-admin`.
- [ ] `NEXT_PUBLIC_WHATSAPP_URL` / `WHATSAPP_URL` : le lien de la communauté (sans lui, la
      page d'accueil ne démarre pas).

## 2. Contenu de départ

Une installation neuve est **vide** : aucun atelier, aucune mission, aucun événement
(il n'existe pas de script de contenu de départ). Avant d'inviter quelqu'un :

- [ ] Au moins 1 atelier publié (avec ses séances), 3 à 5 missions publiées, 1 événement à venir.
- [ ] Domaine et niveau renseignés sur chaque contenu (sinon les recommandations
      retombent sur le catalogue statique).

## 3. À vérifier à la main (une fois, en conditions réelles)

- [ ] **Un vrai code de connexion arrive dans une vraie boîte** (Gmail et une adresse
      d'un autre fournisseur), en moins d'une minute, et pas dans les indésirables.
      L'API répond « envoyé » même si l'envoi échoue (volontaire : anti-énumération des
      adresses). Une clé d'envoi absente ou un domaine non validé ne se voit donc pas à
      l'écran : regarde les journaux et le tableau de délivrabilité de l'admin.
- [ ] Domaine d'envoi validé chez Resend **et** Brevo (SPF, DKIM).
- [ ] Un atelier de bout en bout : s'inscrire, ouvrir une séance, soumettre un livrable,
      passer le quiz, validation côté admin.
- [ ] Le mentorat : demande côté membre, attribution côté admin.
- [ ] L'espace membre et l'admin **sur un téléphone** et sur un ordinateur.
- [ ] Les tâches planifiées s'exécutent (`docker compose logs cron`), et tu es prévenu
      si l'une s'arrête (alertes admin).
- [ ] Une sauvegarde de la base **et sa restauration** testées une fois
      (`./scripts/backup.sh`, `verify`, `restore`), copiée hors du serveur.

## 4. Juridique et confiance

- [ ] Les pages Confidentialité, CGU, Mentions légales et Cookies sont relues par toi et
      décrivent bien ce que tu collectes (email, téléphone, pays, réponses du profil).
- [ ] Un moyen réel de joindre quelqu'un (l'adresse `privacy@joinhashcode.com` répond).
- [ ] Le bouton de suppression de compte et l'export des données fonctionnent
      (couverts par le script de parcours : export oui, suppression à tester à la main).

## 5. Accès admin

- [ ] Les droits admin se donnent **depuis la fiche du membre** (champ rôle). Les
      invitations admin et `/admin/setup` créent encore des comptes sans effet réel
      (ancien système, à nettoyer) : ne pas s'en servir.
- [ ] Pas de double authentification pour les admins : un code reçu par email suffit.
      Limiter le nombre d'opérateurs au strict nécessaire, et surveiller le journal d'audit.

## 6. Pendant la bêta : quoi mesurer

Trois chiffres suffisent pour décider de la suite :

1. Inscrits.
2. Parmi eux : combien ouvrent un atelier ou démarrent une mission dans les 48 h.
3. Parmi eux : combien reviennent une semaine plus tard.

Si le 2 est faible, corriger l'accueil avant tout le reste. Le parrainage multiplierait
ce problème au lieu de le résoudre.

## 7. Ensuite (pas avant la fin de la bêta)

Parrainage et recommandation → annuaire des membres → modération et signalement →
publications → paiement et PWA.
