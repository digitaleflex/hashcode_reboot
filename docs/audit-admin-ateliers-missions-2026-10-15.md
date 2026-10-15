# Audit admin ateliers/missions — avant/après (#222, 2026-10-15)

## 1. Inventaire (méthode de l'issue : auditer avant de coder)
| Périmètre | État trouvé |
|---|---|
| `admin/ateliers/page.tsx` (498 l.) | Sain : loading/empty/error, filtres, badges statut, 44 px, responsive. **Défaut : `aria-pressed` absent** sur filtres |
| `admin/ateliers/[id]/page.tsx` (1079 l.) | Lecture + contrôles déblocage/date (busy, confirm) : sains |
| `admin/ateliers/submissions` (596 l.) | Formulaire revue : validation longueur, `formError`+`role=alert`, pending, toast, invalidation. **Défaut : `aria-pressed` absent** |
| `admin/events/page.tsx` (448 l.) | Pas de filtres (rien à corriger) ; événements ≠ sessions atelier : **aucune confusion trouvée** (types et routes distincts) |
| UI missions | **INEXISTANTE** (APIs #232c seules) — à créer sans dupliquer |
| Sidebar/shell | Entrées codées en dur FR ; maps bidirectionnelles à étendre |

## 2. Changements (aucun doublon modèle/auth/API/notification/composant)
- **Nouveau** `admin/missions/page.tsx` : liste (filtres + `aria-pressed` natif), compteurs `_count`, dialogue création (validation slug regex + titre, `role=alert`, pending, toast, invalidation).
- **Nouveau** `admin/missions/[id]/page.tsx` : détail, boutons limités aux transitions moteur (`NEXT_STATUSES`), file PENDING, dialogue revue (radiogroup + feedback requis + toast).
- Sidebar `Missions` (Flag) + `AdminShell` maps (2 sens).
- `aria-pressed` ajouté aux filtres ateliers + submissions.
- Réutilisé : `AdminShell`, `fetchJson`/`withRetryAfter`, react-query, `useToast`, `cn`, patterns badges/dialogues, moteur `canTransitionMission`, APIs #232c.

## 3. Décisions
- Normalisation slug (minuscules) plutôt que rejet casse : UX ; prouvé par test.
- Pas de suppression de fonctionnalité ; contrats API inchangés.
- Notes admin : auteur exclu de l'export (déjà #153) — UI Inchangée.

## 4. Preuves
- Intégration **53/53** : 403 sans session (liste/création/revue), normalisation slug, 422 formes invalides, boucle #232c intacte.
- `typecheck`/`lint` ✅ · unitaires 492/492.

## 5. Validation manuelle restante (pas de DB admin en local)
- [ ] Ouvrir `/admin/missions`, créer (slug invalide → erreur champ), publier, revoir une soumission (feedback < 4 → erreur), toast + invalidation.
- [ ] Clavier : Tab jusqu'aux filtres (aria-pressed annoncé), dialogs focus + Échap (natif ? — à vérifier : pas de trap focus, même pattern que ateliers).
- [ ] Mobile 390 : cartes + dialogs sans débordement.
