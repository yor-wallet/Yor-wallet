# Couche TRON (Phase 4)

Code : `src/services/blockchain/` (aucune dépendance externe). Tests : `tests/tron/` (63 + garde-fou), `tests/model/` (16) et `tests/edge/` (14, logique pure de `token-admin`).

## Réseaux
| Réseau | URL de base | Usage |
|---|---|---|
| Shasta | `https://api.shasta.trongrid.io` | testnet (défaut) |
| Nile | `https://nile.trongrid.io` | testnet |
| Mainnet | `https://api.trongrid.io` | **refusé** en développement et en testnet ; le jeton expérimental y est refusé en toute circonstance |

URLs et en-tête de clé API (`TRON-PRO-API-KEY`) confirmés dans la documentation TRON.

## Vérifié en réel (2026-10-08, depuis une fonction Edge Supabase)
Fonction `tron-status` (lecture seule, JWT requis, URLs fixes, mainnet refusé) :
- Shasta répond (bloc 69 069 513) et Nile répond (bloc 71 655 202), sans clé API (latence ≈ 1,3 s).
- `GET …?network=mainnet` renvoie 400 ; un appel sans JWT renvoie 401.
- `?probe=1` (trois requêtes fixes) confirme sur les deux testnets :
  - `POST /wallet/gettransactioninfobyid` d'une transaction inconnue renvoie `{}` ;
  - `POST /walletsolidity/gettransactioninfobyid` existe et renvoie `{}` ;
  - `POST /wallet/triggerconstantcontract` sur une adresse sans contrat renvoie
    `{"result":{"code":"CONTRACT_VALIDATE_ERROR","message":"Smart contract is not exist."}}` (message en texte clair).
  Ces formes sont rejouées dans les tests (`CONTRACT_NOT_FOUND`, transaction inconnue ⇒ `broadcasted`).

- **Nile, paramètres de chaîne lus en réel** (`token-admin?action=plan`, 2026-10-08) : prix de l'énergie `getEnergyFee` = 100 sun, plafond de frais `getMaxFeeLimit` = 15 000 TRX, bande passante 1 000 sun/octet.
- **`POST /wallet/deploycontract` sur Nile** : le nœud réel construit la transaction de déploiement (ABI envoyée en chaîne JSON, `bytecode` = code d'initialisation + argument du constructeur, sans champ `parameter`). Les 15 contrôles de `checkBuiltTx` passent et l'adresse de contrat prédite par notre calcul (keccak256(txID ‖ propriétaire)) est celle annoncée par le nœud. Puis signé et diffusé : le nœud Nile a accepté la signature (`broadcasttransaction` : `result` = vrai). Contrat confirmé (voir ci-dessous).

Le bac à sable de développement n'atteint pas TronGrid ; toute vérification réseau passe donc par la fonction Supabase.

- **`POST /wallet/triggersmartcontract` sur Nile (2026-10-09)** : le nœud réel construit un appel `grantRole(bytes32,address)` ; les 17 contrôles de `checkTriggerTx` passent, dont le **re-encodage protobuf** du JSON `raw_data` qui redonne exactement `raw_data_hex` (donc le JSON affiché est bien ce que la signature engage). Signé et diffusé : signature acceptée, puis confirmé (bloc 71 666 105). Coût réel = coût simulé (22 929 énergie).
- **`POST /wallet/triggerconstantcontract` comme simulation** : renvoie `energy_used` (22 929 pour `grantRole`, 193 543 pour `mint`), sert à refuser un plafond de frais insuffisant (< 1,2 × coût simulé) avant toute signature.
- **`POST /walletsolidity/triggerconstantcontract`** : existe sur Nile ; les lectures de confirmation (`hasRole`, `balanceOf`, `totalSupply`) se font dessus, avec repli signalé sur le nœud complet.

## Non vérifié contre un nœud réel
La diffusion d'un **transfert** de jeton, l'exécution de `transfer` / `approve` / `expireLots`, et le comportement d'une transaction qui échoue sur la chaîne (REVERT / OUT_OF_ENERGY) : ces cas sont rejoués par un faux nœud (`tests/edge-sim`) qui vérifie la **logique** et la **forme** des requêtes, pas le réseau. **Vérifié en réel** : le déploiement, `grantRole`, `mint` (193 543 énergie, confirmé, solde relu), le suivi jusqu'à la solidification (`/walletsolidity/gettransactioninfobyid`), `triggerconstantcontract` (plein et solidity) et `getcontractinfo`.

## Règles appliquées dans le code
- **Pas d'adresse inventée** : `YOR_TOKEN_CONTRACT_ADDRESS` vide ⇒ `TOKEN_NOT_DEPLOYED`, aucun appel réseau, aucun solde.
- **Garde-fou d'identité** : `tokenInfo()` lit nom, symbole et décimales on-chain et refuse un contrat différent (par exemple un vrai Tether).
- **Pas de frais inventés** : `YOR_FEE_LIMIT_SUN` absent ⇒ `FEE_LIMIT_NOT_CONFIGURED`.
- **Confirmation** : « confirmed » exige la transaction **solidifiée** (nœud solidity), `receipt.result = SUCCESS`, un numéro de bloc
  et un txid valide ; un échec dans un bloc non solidifié reste provisoire. Un transfert diffusé n'est jamais « confirmé ».
- **Signature** : aucune clé dans le code. Sans fournisseur : `Wallet signing provider not configured`. La transaction signée
  doit être identique à celle construite (txID et `raw_data_hex`).
- **États** : `draft → pending_signature → broadcasted → confirming → confirmed`, plus `failed`, `expired`, `cancelled`.
- **Garde-fou secrets** : un test balaie les sources et l'application web à la recherche de clés privées, de seeds et de
  littéraux hexadécimaux de 64 caractères.

## Fonctions Edge
| Fonction | État |
|---|---|
| `tron-status` | déployée (v2), vérifiée |
| `send-email` | existante (Brevo), inchangée |
| `yor-devtools` | **coquille désactivée** (répond 410, JWT requis) ; à supprimer depuis le tableau de bord Supabase |
| `token-admin` | déployée (plateforme v6 = version interne 5), testnets uniquement (nile, shasta ; mainnet refusé). JWT + secret propre. GET : `ping`, `compile`, `selftest`, `address`, `plan`, `status`, `callplan`, `opstatus`. POST : `cache`, `keygen`, `deploy`, `grant_minter`, `testmint`. Code source figé (sha256 épinglé), aucune entrée libre. Clé de déploiement générée côté serveur, jamais renvoyée. Chaque écriture exige `fee_limit_trx` (aucune valeur par défaut), est **simulée** avant d'être construite, **re-encodée et contrôlée** avant d'être signée, **réservée** avant diffusion (une réservation par opération et par réseau) et n'est annoncée `confirmed` qu'après solidification + receipt SUCCESS + lecture on-chain. Il n'existe pas d'action générique : `grant_minter` (déployeur → `MINTER_ROLE`) et `testmint` (un seul mint de 1 870 000 YOR-USDT vers une adresse publique fournie, sans échéance, refusé si `totalSupply` ≠ 0). **Exécutées sur Nile : `deploy`, `grant_minter` et `testmint` (1 870 000 YOR-USDT, bloc 71 666 573), toutes confirmées.** `testmint` ne peut plus être rejoué (réservation confirmée + `totalSupply` ≠ 0). Les fichiers déployés ne peuvent pas lire leurs propres sources (`ping.selfHash` = null) : l'identité octet pour octet avec le dépôt n'est donc pas prouvée par empreinte, seulement par comportement (selftest 10/10, `callplan` 17/17 sur le vrai nœud). Compilation rangée dans `app_private` et re-vérifiée par empreintes (solc consomme presque toute la limite CPU de 2 s par requête) |

Écran navigateur (TronLink, Nile) : voir `WALLET_SCREEN.md`.
