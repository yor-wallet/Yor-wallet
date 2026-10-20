# Tests et limites

## Ce qui est vérifié automatiquement
| Suite | Commande | Résultat |
|---|---|---|
| SQL (PostgreSQL 16 local + bouchon Supabase) | `bash supabase/tests/run.sh` (en tant qu'utilisateur non-root) | 47 assertions passées ; migration appliquée deux fois |
| Unitaires (Vitest) | `cd web && npm test` | 17 tests : calcul = fonction SQL sur 315 cas réels, dictionnaires ar/fr/en identiques, chaque erreur et notification du serveur traduite, chaque appel RPC du site existe avec les bons paramètres |
| Navigateur (Chromium, site compilé, Supabase simulé au niveau réseau) | `cd web && npm run build:e2e && npm run test:e2e` | 15 tests : arabe RTL par défaut, changement de langue, simulateur, largeur téléphone 375 px sur 14 pages × 2 langues, coupure réseau = « incertain » + même clé à la reprise, motif et référence obligatoires côté admin, rôles |
| Types | `cd web && npm run typecheck` | sans erreur |

## Vérification connectée (à lancer après la migration)
`npm run check:connected` contre le vrai projet : lecture seule, avec la clé publique.

## Ce qui n'a PAS été vérifié
- La migration **n'a pas été appliquée** à un vrai projet Supabase : les tests SQL tournent sur PostgreSQL 16 avec un bouchon des schémas `auth` / `storage`. Appliquer d'abord sur un projet de test ou une branche, puis lancer `check:connected`.
- Les tests navigateur simulent Supabase : ils prouvent le comportement de l'interface, pas celui du réseau réel ni d'Auth (e-mails de confirmation, liens de réinitialisation).
- Aucun test sur un **vrai iPhone** (Safari iOS, installation sur l'écran d'accueil) : seulement Chromium à 375 px.
- Les textes juridiques (confidentialité, conditions) sont des modèles à faire valider par un juriste ; aucune licence n'est affirmée.
- Aucun fournisseur d'e-mail ni opérateur de paiement n'est connecté (par conception).
