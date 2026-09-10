# Plan d'invitation des anciens membres — HASHCODE REBOOT

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                     PIPELINE D'INVITATION                       │
│                                                                 │
│  CSV1 (100) + CSV2 (104)                                       │
│        ↓                                                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  PARSE   │───→│ DEDUPL   │───→│  IMPORT  │───→│  ENVOI   │  │
│  │ 204 lignes│   │ 173 uniques│  │ 171 PENDING│  │ 171 emails│ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                 │
│        ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  GESTION QUOTIDIENNE                      │   │
│  │                                                          │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │ SUIVI   │  │ RELANCE │  │MODIFIER │  │SUPPRIMER│   │   │
│  │  │ cliqué? │  │ 2e email│  │ profil  │  │ membre  │   │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │   │
│  │       │            │            │            │          │   │
│  │       ↓            ↓            ↓            ↓          │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │           STATUT DU MEMBRE                       │   │   │
│  │  │                                                  │   │   │
│  │  │  PENDING ──→ cliqué lien ──→ APPROVED            │   │   │
│  │  │     │              │                              │   │   │
│  │  │     │              ↓                              │   │   │
│  │  │     │         Remplit profil                     │   │   │
│  │  │     │              │                              │   │   │
│  │  │     │              ↓                              │   │   │
│  │  │     │         APPROVED ✓                         │   │   │
│  │  │     │                                            │   │   │
│  │  │     ├──→ 7j sans clic ──→ RELANCE                │   │   │
│  │  │     │         │                                  │   │   │
│  │  │     │         ↓                                  │   │   │
│  │  │     │    2e email envoyé                         │   │   │
│  │  │     │         │                                  │   │   │
│  │  │     │         ↓                                  │   │   │
│  │  │     │    14j sans clic ──→ EXPIRÉ                │   │   │
│  │  │     │                                            │   │   │
│  │  │     └──→ email invalide ──→ BOUNCE               │   │   │
│  │  │                                                  │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Scénarios de gestion

### 1. 📥 Import initial
| Élément | Détail |
|---|---|
| **Source** | 2 CSV (HashCode Informatique + innoveCode) |
| **Parsing** | Auto-detect séparateur + colonnes |
| **Filtrage** | Email invalide → erreur, doublons → supprimés |
| **Création** | `profileStatus: "PENDING"`, `communityStatus: "NOT_INVITED"` |
| **Séparation** | ✅ AUCUN risque de mélange avec les membres APPROVED |
| **Email** | Magic link 1-clic (72h) envoyé immédiatement |
| **Stats** | 171 créés, 2 déjà en base, 31 doublons supprimés |

### 2. 📧 Envoi d'invitation
| Élément | Détail |
|---|---|
| **Email** | "Rejoins HASHCODE REBOOT — ton compte t'attend" |
| **Contenu** | Bouton lime + lien fallback texte |
| **Lien** | `/verify-otp?email=...&code=...&next=/dashboard` |
| **Durée** | 72 heures |
| **Contenu** | "Ce qui t'attend" : profil, sessions, WhatsApp |
| **Rate-limit** | 250ms entre chaque envoi |

### 3. 🔍 Suivi des invitations
| Statut | Signification | Action |
|---|---|---|
| `PENDING` + `communityStatus: NOT_INVITED` | Email envoyé, pas encore cliqué | Attendre ou relancer |
| `PENDING` + session active | Lien envoyé, encore valide | Attendre |
| `APPROVED` | A cliqué + rempli profil | ✅ Terminé |
| `PENDING` + session expirée | Lien expiré (72h dépassées) | Relancer ou nouveau lien |
| Email bounce | Adresse invalide | Blacklister |

### 4. 🔄 Relance automatique
| Étape | Délai | Action |
|---|---|---|
| 1er email | J0 (import) | Magic link 1-clic |
| Relance | J+7 | 2e email "On t'attend" |
| Expiration | J+14 | Lien expiré, visible dans admin |
| Nouveau lien | Sur demande | Admin génère un nouveau magic link |

**Email de relance** : template `sendEngagementEmail` existant
```
"On t'attend sur HASHCODE — rejoins le groupe"
```

### 5. ✏️ Modifier un invité
| Champ modifiable | Via |
|---|---|
| Prénom | Admin detail dialog |
| Téléphone | Admin detail dialog |
| Pays | Admin detail dialog |
| Niveau | Admin detail dialog |
| Domaine | Admin detail dialog |
| **Email** | ❌ Non modifiable (clé unique) |
| **Statut** | Bulk actions (approve/reject/waitlist) |

### 6. 🗑️ Supprimer un invité
| Cas | Action |
|---|---|
| Membre PENDING (jamais cliqué) | Delete admin → supprimé de la DB |
| Membre avec session active | Session révoquée + supprimé |
| Membre APPROVED | ⚠️ Attention — c'est un vrai membre |
| Bulk delete | Max 10 à la fois, confirmation requise |

### 7. ⬆️ Promotion PENDING → APPROVED
| Condition | Action |
|---|---|
| Le membre clique le lien | Session vérifiée → login |
| Il remplit son profil (18 questions) | `profileStatus: "APPROVED"` |
| Il rejoint WhatsApp | `communityStatus: "ACTIVE"` |
| **Automatique** | Le profil se remplit → validation auto |

### 8. ❌ Rejeter / Waitlist
| Action | Statut résultant | Email |
|---|---|---|
| Approve | `APPROVED` | `sendWelcomeEmail` |
| Waitlist | `WAITLIST` | `sendStatusChangeEmail` |
| Reject | `REJECTED` | `sendStatusChangeEmail` |

---

## Données par source

### CSV1 — HashCode Informatique (100 membres)
| Colonne CSV | Champ DB |
|---|---|
| Adresse e-mail | `email` |
| Nom Complet | `firstName` (premier mot) |
| Téléphone WhatsApp | `phone` |
| Pays de résidence | `country` (→ ISO) |
| Niveau global | `level` (Débutant→beginner, etc.) |
| Technologies | `primaryDomain` (→ web/ai/cybersecurity) |

### CSV2 — innoveCode (104 membres)
| Colonne CSV | Champ DB |
|---|---|
| Adresse e-mail | `email` |
| Nom complet | `firstName` (premier mot) |
| Numéro de téléphone WhatsApp | `phone` |
| Pays | `country` (→ ISO) |
| Domaine d'expertise | `primaryDomain` (→ web/ai/cybersecurity) |
| *(pas de niveau)* | `level` = "beginner" par défaut |

---

## Stratégie de mélange (ou pas)

```
                    BASE DE DONNÉES
    ┌──────────────────────────────────────┐
    │                                      │
    │   MEMBRES CONFIRMÉS                  │
    │   profileStatus: APPROVED            │
    │   communityStatus: ACTIVE            │
    │   ← ne pas toucher                  │
    │                                      │
    ├──────────────────────────────────────┤
    │                                      │
    │   ANCIENS INVITÉS                    │
    │   profileStatus: PENDING             │
    │   communityStatus: NOT_INVITED       │
    │   ← séparés, visibles dans admin    │
    │   ← filtrables par "PENDING"        │
    │   ← bulk actions disponibles        │
    │                                      │
    └──────────────────────────────────────┘

    ✅ Les PENDING n'apparaissent PAS dans :
       - /api/community/count (compteur public)
       - /api/stats (stats dashboard)
       - Liste WhatsApp
       - Members publics

    ✅ Les PENDING SONT visibles dans :
       - /admin/members (avec filtre status)
       - Admin detail dialog
       - Bulk actions (approve/reject/invite)
```

---

## Plan d'exécution

| Étape | Action | Risque | Durée |
|---|---|---|---|
| 1 | `--dry-run` (déjà fait) | ✅ Aucun | instant |
| 2 | Valider le plan avec toi | ✅ Aucun | - |
| 3 | `--send` (import + emails) | ⚠️ 171 emails envoyés | ~1 min |
| 4 | Vérifier dans admin | ✅ Aucun | - |
| 5 | Relance J+7 (optionnel) | ⚠️ 171 emails relance | ~1 min |

**Point de non-retour** : l'étape 3 envoie 171 emails. Une fois fait, les membres recevront le lien.

---

## Questions avant de lancer

1. **Tu veux envoyer les 171 emails maintenant ?** Ou attendre ?
2. **Relance automatique à J+7 ?** Ou manuelle ?
3. **Les 2 membres déjà en base** (amedsawadogo076, kouassiyves026) — les ignorer ou les relancer aussi ?
4. **Domaine par défaut** pour CSV2 (pas de domaine précisé) : web ?
