# Banc d'essai de `token-admin` (hors réseau)

Exécute `supabase/functions/token-admin/index.ts` **tel quel** contre un faux Supabase (table `app_private` en mémoire) et un faux nœud TRON.
Il vérifie la **logique** : plafond de frais obligatoire, simulation avant signature, contrôle de la transaction (transaction altérée ⇒ refusée,
JSON différent des octets signés ⇒ refusé), réservations idempotentes, rôle `MINTER_ROLE` exigé *solidifié*, verrou anti double mint
(`totalSupply` ≠ 0), échec solidifié ⇒ nouvel essai permis, solde « TEST BALANCE » annoncé seulement s'il est lu on-chain, aucune fuite de clé.

Ce que ce banc **ne prouve pas** : le comportement du vrai réseau et la vraie cryptographie (noble est remplacé par des stubs).
Ces deux points sont prouvés en réel par `selftest`, `callplan` et les transactions exécutées sur Nile (voir `docs/TRON.md`).

Lancer : `npm run test:sim` (Node ≥ 22.18, aucune dépendance).
