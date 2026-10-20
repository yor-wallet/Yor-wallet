# SULFA — سلفه

Plateforme de demandes de financement (Oman, OMR) : site public, espace client et centre d'administration.
**Fonctionnement 100 % local** : aucun opérateur de paiement externe. Chaque confirmation (décaissement, remboursement,
retrait, vérification d'identité, décision) est faite par un administrateur depuis son espace, avec auteur, date, motif ou
référence, et une ligne dans le journal d'audit.

| Dossier | Contenu |
|---|---|
| `supabase/migrations/` | Schéma `sulfa_*` (additif, n'altère aucune table existante), fonctions serveur, RLS, bucket privé |
| `supabase/tests/` | Tests SQL sur PostgreSQL 16 local (47 assertions), générateur de fixtures du calcul |
| `web/` | Site Next.js 15 + TypeScript + Tailwind, export statique, arabe (par défaut, RTL) / français / anglais |
| `legacy/sulfa-static/` | Version précédente conservée telle quelle (non supprimée) |
| `docs/` | Installation, guide administrateur, opérateurs futurs, tests et limites |

## Principes (appliqués dans le code, vérifiés par les tests)
- **Aucune écriture directe** : toutes les tables refusent INSERT/UPDATE/DELETE hors des fonctions serveur (`sulfa_direct_write_forbidden`), même pour le propriétaire de la base.
- **Registre en partie double immuable** : chaque opération est équilibrée (débits = crédits), ne peut être ni modifiée ni supprimée ; une correction est une contre-passation traçable.
- **Capital de référence ≠ fonds** : 1 000 000,000 OMR est une valeur de configuration affichée à part ; la trésorerie démarre à 0,000 et seuls les fonds réellement reçus, enregistrés avec une référence, permettent un décaissement.
- **Idempotence** : demande, retrait, décaissement, remboursement, apport de capital et contre-passation portent une clé ; une même requête envoyée deux fois n'enregistre qu'une opération.
- **Jamais de faux succès** : sans réponse du serveur, l'écran affiche « résultat incertain » et la nouvelle tentative réutilise la même clé.
- **Aucun secret dans le site** : seule la clé publique (anon) est compilée ; pas de clé `service_role`.
- **Pas de licence affirmée** : la page réglementaire l'indique explicitement.

## Démarrage rapide
Voir [`docs/INSTALLATION.md`](docs/INSTALLATION.md). En bref : sauvegarde → migration → premier administrateur → variables publiques → `npm ci && npm run build` → déployer `web/out/`.
