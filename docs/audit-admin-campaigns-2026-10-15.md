# Audit campagnes/invitations/email — avant/après (#223, 2026-10-15)

## 1. Inventaire (conforme à la méthode de l'issue)
| Périmètre | État trouvé |
|---|---|
| `ImportInvitePanel` (269 l.) | Dry-run (comptes + échantillon) → confirm → toast ; erreurs 429/validation ; **défaut : toggle sans `aria-expanded`** |
| `invitations/page` (765 l.) | StatCards-filtres, tri, pagination, recherche, `RelanceDialog` (compte affiché = volume estimé, confirm, loading, erreurs 429/fournisseur), empty states. **Défauts : StatCards sans `aria-pressed`, dialogue sans `role=dialog`** |
| `marketing/page` (240 l.) | Onglets `role=tab` + `aria-selected` ✅, sections labellisées ✅ — rien à corriger |
| États métier | brouillon→prêt→envoyé/partiel/échec portés par dry-run/result/failed ✅ ; doubles clics bloqués par `loading`/`disabled` ✅ |

## 2. Changements (3 écarts, ciblés)
- Toggle import : `aria-expanded` + `aria-controls="import-invite-panel"`.
- StatCards invitations : `aria-pressed` (seulement quand cliquables).
- `RelanceDialog` : `role="dialog"` + `aria-modal` + `aria-labelledby` (harmonisé avec le dialogue revue missions #222).

## 3. Preuves
- `typecheck`/`lint` ✅ · aucune API touchée (intégration inchangée par construction).
- Pas de tests DOM (pas d'infra jsdom — voir #112).

## 4. Validation manuelle restante
- [ ] Lecteur d'écran : filtres annoncés (enfoncé/non), dialogue relance nommé, toggle import annoncé.
- [ ] Dry-run → envoi : volume estimé = envoyés ; double-clic sans double envoi.
