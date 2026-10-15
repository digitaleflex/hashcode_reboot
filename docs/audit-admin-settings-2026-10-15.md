# Audit paramètres/blacklist/sensible — avant/après (#224, 2026-10-15)

## 1. Inventaire (contrôles serveur vérifiés bons)
| Route | Garde |
|---|---|
| `admins/*` (CRUD, reset-2fa, revoke) | `requireAdminRole(operator)` partout ; CSRF sur reset-2fa ; garde-fous LAST_OPERATOR + SELF_REVOKE |
| `blacklist/*` | `requireAdminRole(operator)` ; CSRF sur POST ; audit `blacklist.remove` (email = entité) |
| UI existante | Session/identité affichées (settings) ; formulaire invitation labellisé ; rôles avec garde serveur |

## 2. Défauts corrigés (cohérence design system, pas de faille)
- `window.confirm()` ×2 (reset 2FA, revoke) → **`ConfirmDialog` partagé** (`admin/ConfirmDialog.tsx` : role/aria, pending, `role=alert`, variantes danger/standard). Erreurs routées dans le dialogue (contexte conservé).
- `RemoveConfirmDialog` (blacklist) : `type="button"`, `role="dialog"` + labels, `role=alert` sur erreur, cibles 44 px.

## 3. Preuves
- Intégration **54/54** : 4× 403 sans session (reset-2fa, revoke, blacklist POST/DELETE) — zéro coût auth, aucune écriture.
- `typecheck`/`lint` ✅ · unitaires (à confirmer au commit).

## 4. Validation manuelle restante
- [ ] Reset 2FA + revoke : dialogue nommé, erreur LAST_OPERATOR/SELF_REVOKE lisible, focus clavier.
- [ ] Blacklist : retrait confirmé, dialogue nommé.
