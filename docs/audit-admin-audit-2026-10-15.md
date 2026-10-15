# Audit journal/audit admin — avant/après (#220, 2026-10-15)

## 1. Inventaire
| Périmètre | État trouvé |
|---|---|
| `AuditLogViewer` (326 l.) | Sain : recherche, expand, export CSV, erreur/empty/loading, retry conservant le contexte, dates FR, clavier (boutons). **Défauts : dates sans année ni fuseau** (liste) **ni fuseau** (détail) ; **export CSV sans état busy** (double-clic = double téléchargement) |
| `ActivityLog` (325 l.) | Mêmes défauts de dates (2 endroits) |
| API `audit-log` | Opérateurs seuls ✅ ; params `format`/`limit` uniquement → recherche côté client **alignée** (500 lignes max, pas de filtre serveur à refléter) ; pas de mutation possible (append-only respecté) |
| Détails sensibles | Métadonnées affichées aux opérateurs uniquement ✅ ; exception `blacklist.remove` (email = entité administrée) déjà justifiée en #153 |

## 2. Changements (zéro duplication : helper partagé)
- **`admin/lib/dates.ts` (nouveau)** : `formatShortFr` (jour+mois FR+année+heure+fuseau court) et `formatFullFr` (+secondes) ; fuseau = navigateur de l'admin ; invalide → "—".
- `AuditLogViewer` + `ActivityLog` : 4 rendus migrés vers le helper.
- Export CSV : état `exporting` (désactivé + libellé "Export…", anti-double-clic).
- Recherche/filtres inchangés (alignés API : pas de filtre serveur inexistant à refléter).

## 3. Preuves
- `tests/admin-dates.test.ts` (nouveau) **4/4** : année+mois FR+fuseau, invalide→"—", secondes, cohérence.
- `typecheck`/`lint` ✅ · unitaires 491/491 · intégration audit-log existante rejouée (§4).

## 4. Validation manuelle restante
- [ ] `/admin/audit-log` : dates avec année + "UTC+1", expand, export (1 seul téléchargement au double-clic), retry après coupure réseau (filtre conservé).
- [ ] Fuseau navigateur non-Europe/Paris : libellé cohérent.
