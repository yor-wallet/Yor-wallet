# YOR Experimental USDT (YOR-USDT)

**Jeton EXPÉRIMENTAL de test, standard TRC-20, réseau TRON.** Ce n'est pas Tether USDT, il n'a aucun lien avec Tether
et ne représente aucune valeur garantie. Il ne doit jamais être présenté comme du USDT.

| Élément | Valeur |
|---|---|
| Nom | `YOR Experimental USDT` |
| Symbole | `YOR-USDT` |
| Décimales | 6 (1 YOR-USDT = 1 000 000 unités brutes) |
| Contrat | `contracts/YORExperimentalUSDT.sol` |
| Adresse (Nile, testnet) | `TYnzmpqeUWtXWjymVtdj4SADzW45adnzdf` : déployée et **confirmée** le 2026-10-08 (transaction `f0d4d61bcf034016eb8dd2e6b448aca3eb00e654e3d6f9010b415ac82305d65d`, bloc 71 657 671, solidifiée, receipt SUCCESS). Aucune adresse sur un autre réseau |
| Réseaux autorisés | Shasta, Nile (testnets). Mainnet : interdit tant qu'il n'y a pas d'audit indépendant et de validation du propriétaire |

## Source de vérité
Le solde d'un utilisateur est **ce que `balanceOf` renvoie sur la chaîne**. Supabase ne contient que comptes, profils,
préférences, index des transactions, métadonnées, notifications et journal d'audit. Aucune table ne doit contenir
« balance = 1870000 ».

Le chiffre 1 870 000 n'existe que comme **TEST BALANCE** étiqueté (`src/services/blockchain/test-balance.mjs`),
c'est-à-dire une quantité à minter par un `MINTER_ROLE` sur un testnet, ou comme valeur réellement lue par `balanceOf`.
Le module refuse de servir en production et sur mainnet.

## Rôles
- `DEFAULT_ADMIN_ROLE` : accorde et retire les rôles. Attribué à l'adresse `admin` passée au constructeur.
- `MINTER_ROLE` : seul à pouvoir créer des jetons (`mint`).
- `BURNER_ROLE` : seul à pouvoir détruire des jetons (`burn`).
- Aucun utilisateur ordinaire ne peut créer de jetons.

## Fonctions
| Fonction | Rôle requis | Effet |
|---|---|---|
| `transfer`, `approve`, `transferFrom` | aucun | TRC-20 standard, avec consommation de lots (voir EXPIRATION.md) |
| `mint(to, amount, expiresAt)` | MINTER_ROLE | crée ou fusionne un lot ; `expiresAt = 0` : sans échéance |
| `burn(from, amount)` | BURNER_ROLE | détruit des jetons dépensables |
| `expireLots(owner, maxLots)` / `expireLotsFrom(owner, start, maxLots)` | aucun | brûle les lots réellement échus (≤ 50 lots par appel) |
| `balanceOf` | — | total brut des lots restants, y compris les lots échus non encore purgés |
| `availableBalanceOf` | — | part dépensable |
| `expiredBalanceOf` | — | part échue non encore purgée |
| `lotsSummary(owner, start, count)`, `lotCount`, `headOf`, `lotAt` | — | lecture paginée des lots |

## Événements
`Transfer`, `Approval`, `Mint`, `Burn`, `Expiration`, `LotCredited`, `LotDebited`, `RoleGranted`, `RoleRevoked`.

## Ce qui a été vérifié, et ce qui ne l'a pas été
- **Vérifié (exécuté)** : le *modèle de référence* JavaScript `model/lot-model.mjs` applique ces règles ; 16 tests passent,
  dont un test de propriétés (5 graines × 600 opérations) et 4 mutations volontaires qui font échouer les tests.
- **Compilé (exécuté)** : le contrat compile avec solc 0.8.19 (evm istanbul, optimiseur 200) : 0 erreur, 0 avertissement, aucun opcode récent,
  code déployé 7 496 octets. Le risque « stack too deep » est écarté pour ce compilateur.
- **Écrit mais NON exécuté** : les tests Solidity (`test/foundry/`) n'ont pas encore tourné.
- **Déployé et lu en réel (Nile)** : le contrat s'exécute sur la machine virtuelle TRON (déploiement, constructeur, lectures). Lu sur la chaîne : `name` = « YOR Experimental USDT », `symbol` = « YOR-USDT », `decimals` = 6, `totalSupply` = 0, `hasRole(DEFAULT_ADMIN_ROLE, déployeur)` = vrai. Le code d'exécution lu sur la chaîne (7 496 octets) est identique au code compilé (sha256 `33dae51e…e6cf`).
- **Coût réel du déploiement (reçu)** : énergie 1 543 347 (154,3347 TRX), bande passante 10,425 TRX, total 164,7597 TRX, pour un plafond de 225 TRX.
- **Écriture réelle (Nile, 2026-10-09)** : `grantRole(MINTER_ROLE, déployeur)` exécuté par `token-admin` (action `grant_minter`) : txid `46b4e57552eb7276ccd1f30e1d73fa63c4b9c2c5f0efb68e4c8af837a6ea7eda`, bloc 71 666 105, solidifié, receipt SUCCESS ; coût réel 22 929 énergie = 2,2929 TRX (la simulation avait annoncé exactement 22 929). `hasRole(MINTER_ROLE, déployeur)` relu = vrai sur le nœud solidity.
- **Mint réel (Nile, 2026-10-09)** : `mint(propriétaire, 1 870 000 000 000, 0)` exécuté par `token-admin` (action `testmint`), le « TEST BALANCE » de **1 870 000 YOR-USDT** vers l'adresse TronLink Nile du propriétaire (`TWoXF3…rfaX9`) : txid `7d4fbdfad22e3dd4f0919167a185d87f8d943efa358643a002b9e4dd98b7e8bf`, bloc 71 666 573, solidifié, receipt SUCCESS. Coût réel : énergie 193 543 (19,3543 TRX, = simulation) + bande passante 0,378 TRX = 19,7323 TRX. Lu on-chain sur le nœud solidity : `balanceOf` = 1 870 000 000 000 (1 870 000,000000), `availableBalanceOf` = identique, `lotCount` = 1, `totalSupply` = 1 870 000 000 000. **Ce solde est un solde de TEST, créé volontairement par le propriétaire du contrat ; il n'a aucune valeur et n'a aucun lien avec Tether USDT.**
- **Non fait** : exécution de `transfer`, `approve`, `expireLots` sur la chaîne, tests Foundry, audit externe. Le déployeur a `MINTER_ROLE` (il peut donc encore émettre ; `testmint` est verrouillé à une seule émission côté fonction, pas côté contrat).
- **Adresse du déployeur testnet** (publique, générée côté serveur, clé jamais exposée) : `TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad`. Elle ne porte aucun solde réel ; c'est elle qui deviendra `DEFAULT_ADMIN_ROLE` du contrat (argument du constructeur). Il détient `DEFAULT_ADMIN_ROLE` et, depuis le 2026-10-09, `MINTER_ROLE` (pas `BURNER_ROLE`). Sa clé est une clé de testnet jetable stockée côté serveur.
