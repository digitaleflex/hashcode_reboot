## Objectif
Intégrer Brevo comme fallback automatique si Resend atteint ses quotas (429 Too Many Requests).

## Stratégie
- **Primary** : Resend (actuellement utilisé dans `lib/mail.ts`)
- **Fallback** : Brevo (si Resend échoue avec 429 ou quota dépassé)
- **Basculement automatique** : `BREVO_FALLBACK_ON_429=true` dans `.env`

## Variables d'environnement nécessaires
- `BREVO_API_KEY` (clé API Brevo)
- `BREVO_EMAIL_FROM` (déjà configuré : `admin@joinhashcode.com`)
- `BREVO_WEBHOOK_SECRET` (secret webhook)
- `BREVO_FALLBACK_ON_429=true`
- `BREVO_FALLBACK_ON_QUOTA=true`

## Cas d'usage prioritaires
1. **Emails transactionnels** : bienvenue, invitation, vérification, relance
2. **SMS marketing** : rappels, notifications communautaires
3. **WhatsApp** : support et discussions en direct
4. **Chat en direct** : widget de support

## Implémentation prévue
- Modifier `lib/mail.ts` pour ajouter la logique de fallback
- Ajouter `sendViaBrevo()` comme fonction alternative
- Gestion des erreurs 429 et quota
- Logging des basculements Resend → Brevo

## Status
- [ ] Variables d'environnement configurées ✅
- [ ] Clé API Brevo obtenue
- [ ] Implémentation du fallback dans `lib/mail.ts`
- [ ] Tests de basculement automatique
- [ ] Activation des canaux SMS/WhatsApp/Chat
