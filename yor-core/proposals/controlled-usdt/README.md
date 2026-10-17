# YOR Experimental USDT « contrôlé » — BROUILLON NON COMPILÉ, NON TESTÉ

**Statut honnête (12 octobre 2026).** Ces deux fichiers ont été écrits et relus à la main, mais **jamais compilés ni exécutés** :
l'environnement de travail n'avait ni compilateur Solidity, ni Foundry, ni accès au registre de paquets (accès refusé par la
politique réseau). Tant qu'ils n'ont pas compilé et passé leurs tests, ils restent ici, **hors de `contracts/` et de
`test/foundry/`**, pour ne pas faire échouer `forge build` / le CI du contrat déjà déployé sur Nile.

| Fichier | Rôle |
|---|---|
| `YORExperimentalUSDTControlled.sol` | ERC-20 / TRC-20 sans dépendance : plafond 1 milliard, offre initiale 50 M, pause, burn, permit (EIP-2612), liste noire + `destroyBlackFunds`, récupération (`rescueERC20`, `rescueNative`), propriété en deux temps. Nom et symbole donnés au déploiement mais **obligatoirement** « YOR … » / « YOR-… ». |
| `YORExperimentalUSDTControlled.t.sol` | Tests Foundry (sans forge-std) : 31 tests dont 2 de fuzz, y compris la réentrance, les signatures permit malléables, la marque obligatoire et le plafond exact. |

**Ce n'est pas le jeton déjà déployé.** `contracts/YORExperimentalUSDT.sol` (jeton à lots, Nile `TYnzmp…zdf`) n'est ni modifié ni remplacé.

## Pour l'activer (quand un compilateur est disponible)
1. Copier le contrat dans `contracts/` et le test dans `test/foundry/` (le chemin d'import du test est déjà celui de cet emplacement final).
2. `forge build --sizes` (solc 0.8.19, evm istanbul, comme `foundry.toml`), puis `node scripts/check-bytecode.mjs`, puis `forge test -vvv`.
3. Corriger ce que le compilateur ou les tests signalent (c'est attendu sur un brouillon jamais compilé).
4. Le déploiement sur Nile passe par `token-admin`, dont les empreintes épinglées ne couvrent QUE le contrat actuel : ce brouillon n'est pas déployable par cette fonction sans une mise à jour séparée. Testnets seulement.

## Corrections par rapport au fichier d'origine (OpenZeppelin 5, solc 0.8.24, nom « TETHER » / symbole « USDT »)
- **Marque** : le fichier d'origine fixait le nom « TETHER » et le symbole « USDT » (et n'était pas compilable : `string memory name_,TETHER`, `ERC20(nameTETHER, symbolUSDT)`). Ce serait un faux Tether. Le constructeur refuse tout nom qui ne commence pas par « YOR » + espace et tout symbole qui ne commence pas par « YOR- ».
- **`destroyBlackFunds` ne marchait jamais** dans l'original : la destruction passait par `_update`, qui refuse tout mouvement depuis une adresse listée. Ici la destruction est directe (et reste possible pendant la pause).
- Un jeton envoyé au contrat lui-même est refusé (il serait bloqué : `rescueERC20` refuse le jeton lui-même).
- Un dépensier listé ne peut plus utiliser une allocation antérieure ; propriétaire candidat listé : `acceptOwnership` refusé.
- Permit : `s` haut et `v` hors 27/28 refusés ; séparateur de domaine recalculé à chaque appel.
- Aucune dépendance et solc 0.8.19 / istanbul (pas de PUSH0) : le même compilateur que le jeton déjà déployé, et un seul fichier (compilable par `token-admin`).

## Points à contrôler au premier compilateur
- Pile (« stack too deep ») sur `permit` : déjà scindé en `_checkPermitSignature` / `_permitDigest` ; à confirmer.
- Compatibilité TVM de `block.chainid` et `ecrecover` (permit) : **non vérifiée** sur Nile.
- Taille du code déployé et sortie de `scripts/check-bytecode.mjs` : inconnues.
