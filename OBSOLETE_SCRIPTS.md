# Scripts Obsoletes pour Déploiement VPS

Voici la liste des scripts devenus inutiles/obsolètes lors du déploiement sur VPS. Ces scripts sont principalement destinés au développement local, au débogage, ou contiennent des chemins spécifiques à un environnement de développement Windows.

## Scripts à Supprimer

### 1. Scripts de Débogage avec Chemins Windows Fixe
Ces scripts contiennent des chemins absolus Windows spécifiques à l'environnement de développement d'un individu et ne fonctionneront pas sur un VPS Linux.

- `scripts/debug-context.mjs` - Chemin fixe: `C:\Users\PC\Documents\hashcode_reboot\...`
- `scripts/debug-context2.mjs` - Chemin fixe: `C:\Users\PC\Documents\hashcode_reboot\...`
- `scripts/fix-globals.mjs` - Chemin fixe: `C:\Users\PC\Documents\hashcode_reboot\...`
- `scripts/fix-globals2.mjs` - Chemin fixe: `C:\Users\PC\Documents\hashcode_reboot\...`
- `scripts/fix-membertable.mjs` - Chemin fixe: `C:\Users\PC\Documents\hashcode_reboot\...`
- `scripts/fix-prerender.mjs` - Chemins fixes Windows (lignes 3, 14, 29, 44)
- `scripts/fix-prerender2.mjs` - Chemin fixe: `C:\\Users\\PC\\Documents\\hashcode_reboot\\...`
- `scripts/fix-typo.mjs` - Chemin fixe: `C:\Users\PC\Documents\hashcode_reboot\...`

### 2. Scripts de Seeding/Données de Test
Ces scripts créent des données de démonstration/test pour l'environnement de développement local et ne sont pas nécessaires en production VPS.

- `scripts/seed-email-templates.ts` - Crée des modèles d'emails pour le développement
- `scripts/seed-github-program.ts` - Seeds des données de programme GitHub (développement)
- `scripts/seed-github-workshop.ts` - Seeds des données d'atelier GitHub (développement)
- `scripts/seed-workshops.ts` - Seeds des données d'ateliers (développement)

### 3. Scripts de Test et Validation Locaux
Ces scripts sont utilisés pour le développement et les tests locaux, pas pour les opérations VPS en production.

- `scripts/collect-email-metrics.ts` - Collecte des métriques d'emails (peut être utile mais principalement pour dev)
- `scripts/copy-standalone.mjs` - Post-build pour le déploiement autonome local
- `scripts/test-brevo-api.js` - Test de l'API Brevo (développement)
- `scripts/test-collector.ts` - Collecteur de tests (développement)
- `scripts/test-email-services.mjs` - Test des services email (développement)

## Scripts à Conserver (Essentiels pour VPS)

Ces scripts sont critiques pour le déploiement et les opérations sur VPS :

- `scripts/deploy.sh` - Script principal de déploiement (dev/prod)
- `scripts/backup.sh` - Sauvegarde/restauration (appelée par deploy.sh)
- `scripts/generate-crontab.ts` - Génération de crontab pour les tâches cron VPS
- `scripts/check-messages.mjs` - Vérifie la parité FR/EN et les placeholders ICU ; exécuté par la CI (`.github/workflows/ci.yml`, étape « Validate translation keys »)
- `scripts/task-tracker.mjs` - Suivi des tâches (peut être utile pour la maintenance VPS)

## Notes

- Les scripts marqués avec des chemins Windows fixes sont totalement inopérants sur un VPS Linux et doivent être supprimés.
- Les scripts de seeding sont conçus uniquement pour peupler des bases de données de développement avec des données de test.
- Certains scripts comme `collect-email-metrics.ts` pourraient avoir une utilité sur VPS s'ils sont appelés via cron, mais ils nécessiteraient une configuration appropriée.
- Avant suppression définitive, vérifier que aucun processus automatisé (CI/CD, cron jobs) ne dépend de ces scripts.

## Commande de Suppression (après validation)

```bash
# Supprimer les scripts clairement obsolètes
rm scripts/debug-context.mjs scripts/debug-context2.mjs
rm scripts/fix-globals.mjs scripts/fix-globals2.mjs
rm scripts/fix-membertable.mjs scripts/fix-prerender.mjs
rm scripts/fix-prerender2.mjs scripts/fix-typo.mjs
rm scripts/seed-email-templates.ts scripts/seed-github-program.ts
rm scripts/seed-github-workshop.ts scripts/seed-workshops.ts
rm scripts/copy-standalone.mjs
rm scripts/test-brevo-api.js scripts/test-collector.ts
rm scripts/test-email-services.mjs
```