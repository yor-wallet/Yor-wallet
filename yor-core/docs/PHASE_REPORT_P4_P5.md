# Rapport de phase — Phase 4 (couche TRON) et Phase 5 (jeton)

Date : 2026-10-08. Règle appliquée : tout ce qui n'a pas été réellement exécuté est marqué **NOT EXECUTED**, avec la raison.

## 1. Résultat en une phrase
La logique du jeton (lots, expiration, rôles) et la couche TRON locale sont écrites et testées (79 tests passent).
Supabase atteint réellement Shasta et Nile. **Le contrat Solidity compile avec solc 0.8.19 et est déployé et confirmé sur le testnet Nile (`TYnzmpqeUWtXWjymVtdj4SADzW45adnzdf`, transaction signée côté serveur, solidifiée, receipt SUCCESS, lecture on-chain conforme). Aucun jeton n'a été créé (`totalSupply` = 0), aucun transfert n'a eu lieu, les tests Solidity (Foundry) n'ont pas tourné.**

## 2. Classement des fonctionnalités (5 catégories du prompt V2)
| # | Élément | Catégorie | Preuve / raison |
|---|---|---|---|
| 1 | Modèle de référence des lots (`model/lot-model.mjs`) | 1. Implémenté | 16 tests, test de propriétés, 4 mutations détectées |
| 2 | Configuration, adresses, unités, machine d'états, fournisseur TRON, service de transfert | 1. Implémenté | 63 tests, 10 mutations détectées |
| 3 | Lecture TRON testnet depuis Supabase (`tron-status`) | 2. Connecté à un service externe réel | Blocs réels lus sur Shasta et Nile |
| 4 | Contrat `YORExperimentalUSDT.sol` | 2. Connecté à un service externe réel (testnet) | Écrit, relu, compilé, **déployé et confirmé sur Nile** ; lectures vérifiées on-chain ; écritures (`mint`, `transfer`…) et tests Solidity non exécutés |
| 5 | Construction/diffusion de transfert, suivi jusqu'à la solidification | 3. Prêt pour l'intégration | Testé avec un réseau simulé uniquement |
| 6 | Fournisseur de signature | 3. Prêt pour l'intégration | Interface + `NullSigningProvider` ; aucun fournisseur réel |
| 7 | TEST BALANCE 1 870 000 | 4. Mode test | Étiqueté, refusé en production/mainnet, jamais écrit en table |
| 8 | Transferts on-chain pour les utilisateurs | 5. Indisponible | Pas de contrat déployé, pas de signature : « Wallet signing provider not configured » |

## 3. PASSED (exécuté)
- `node --test` : **79 / 79** (16 modèle + 63 TRON), sans réseau.
- Mutations volontaires de la couche TRON : 10 / 10 détectées (mainnet en dev, confirmation sans preuve, garde « contrat non déployé »,
  confirmation sans solidification, transaction signée altérée, somme de contrôle, plafond de frais par défaut, clé API énumérable,
  expiration jamais déclenchée, TEST BALANCE en production).
- Un test a trouvé un vrai défaut pendant l'écriture : `balanceOf` levait de façon synchrone pour une adresse invalide (corrigé).
- Réel : `tron-status` sur Shasta (bloc 69 069 513) et Nile (bloc 71 655 202) ; mainnet ⇒ 400 ; sans JWT ⇒ 401 ;
  formes de réponse `{}` (transaction inconnue, nœuds complet et solidity) et `CONTRACT_VALIDATE_ERROR` (adresse sans contrat).
- **Compilation réelle** du contrat (fonction `token-admin`, solc 0.8.19, evm istanbul, optimiseur 200) : 0 erreur, 0 avertissement, aucun opcode PUSH0/MCOPY/TLOAD/TSTORE, code déployé 7 496 octets (limite 24 576), 29 fonctions et 9 événements attendus dans l'ABI. Source épinglée par sha256 `a8b220e3…825c` (identique au fichier local). Empreintes : exécution `33dae51e…e6cf`, initialisation `f8251171…f53b`.
- Contrôle d'accès de `token-admin` : bon secret ⇒ 200 ; sans secret, mauvais secret ou sans JWT ⇒ 401.
- Garde-fou : aucun secret, clé privée ou littéral de 64 hex dans `src`, `contracts`, `supabase`, `model` ni dans l'application web v12.1.0 (seules exceptions : empreintes publiques et vecteurs de test portant le marqueur `public-hash`, jamais sur une ligne qui parle de clé ou de secret ; l'exception est elle-même testée).
- `node --test` : **94 / 94** (79 + 14 tests de la logique pure de `token-admin` + 1 test du garde-fou). 10 mutations de la logique de vérification et de confirmation, toutes détectées (confirmation sans solidification, sans SUCCESS, contenu de transaction non contrôlé, txID non recalculé, somme de contrôle, expiration, plafond de frais par défaut, plafond non contrôlé, adresse de contrat non exigée).
- Réel, fonction `token-admin` v3 : `selftest` 10 / 10 (keccak256 vide, clé privée 1 → adresse Ethereum connue et adresse TRON `TMVQGm1q…`, vecteur base58check USDT, signature 65 octets, clé publique récupérée, vérification, déterminisme) ; refus constatés : sans secret 401, `keygen` en GET 405, mainnet 400, action inconnue 400, `deploy` sans `fee_limit_trx` 400.
- Réel, Nile : paramètres de chaîne lus (énergie 100 sun, plafond de frais 15 000 TRX) ; le nœud construit la transaction de déploiement et les 15 contrôles passent (construction à blanc : ni signée, ni diffusée). Adresse du déployeur générée : `TQUGUePy8AXUEWhwsaAGZMseLUoF9QZyad` (somme de contrôle confirmée par l'implémentation indépendante `address.mjs`).
- **Réel, déploiement Nile** (2026-10-08) : le contrat a été déployé par `token-admin` avec un plafond de 225 TRX ; transaction `f0d4d61bcf034016eb8dd2e6b448aca3eb00e654e3d6f9010b415ac82305d65d`, bloc 71 657 671, **solidifiée, receipt SUCCESS**. Adresse du contrat `TYnzmpqeUWtXWjymVtdj4SADzW45adnzdf`. Lecture on-chain : `name` « YOR Experimental USDT », `symbol` « YOR-USDT », `decimals` 6, `totalSupply` 0, administrateur = déployeur ; code d'exécution lu sur la chaîne = code compilé (7 496 octets, sha256 `33dae51e…e6cf`). Coût réel lu sur le reçu : 154,3347 TRX d'énergie + 10,425 TRX de bande passante = 164,7597 TRX (plafond 225 TRX).
- Réel : le nœud Nile a accepté la signature produite côté serveur (clé jamais exposée), et la transaction de déploiement a passé les 15 contrôles avant signature (adresse de contrat prédite = adresse annoncée par le nœud).
- Réel, base : `public.app_private` a la RLS activée, 0 politique, et ni `anon` ni `authenticated` n'ont le droit de lecture.

## 4. FAILED
Aucun test en échec à la clôture. (Un échec intermédiaire a été corrigé, voir §3.)

## 5. NOT EXECUTED
| Élément | Raison |
|---|---|
| Compilation avec le compilateur TRON (tron-solc) | Non faite : seul solc-js 0.8.19 a été utilisé. La compatibilité TVM est en revanche **établie pour le déploiement, le constructeur et les lectures** par le déploiement réel sur Nile ; les écritures ne sont pas exécutées |
| Intégration continue GitHub (Foundry) | Fichiers prêts, mais l'envoi est refusé (403) : l'application GitHub Claude n'a pas accès en écriture à l'organisation `yor-wallet` |
| Déploiement du contrat sur Shasta | Non fait (Nile seulement) |
| Exécution sur machine virtuelle, tests différentiels contrat ↔ modèle (tests Foundry) | Pas de machine virtuelle locale ; Foundry n'a pas pu tourner (GitHub refusé) |
| Signature, diffusion, suivi d'une vraie transaction | Pas de contrat déployé, pas de fournisseur de signature |
| `triggerconstantcontract` sur un vrai contrat YOR, `triggersmartcontract`, `broadcasttransaction` | Idem ; seule la forme des requêtes est testée avec un réseau simulé |
| Signature et diffusion d'un transfert de jeton, `mint`, `grantRole` | Pas d'action pour appeler une fonction d'écriture du contrat ; aucun rôle `MINTER_ROLE` attribué ; aucun jeton créé |
| Phases 2, 3 et 6 à 16 du prompt V2 (sécurité base de données, rôles `super_admin`, cartes, webhooks, etc.) | Hors périmètre de cette étape |

## 6. Modifications en production (Supabase, additives)
- Fonction `tron-status` v2 : nouvelle, lecture seule, JWT requis.
- Fonction `token-admin` v3 : compile et, sur testnet uniquement, déploie le seul contrat dont le sha256 est épinglé ; secret propre ; clé de déploiement générée côté serveur (voir §6 base de données).
- Table `public.app_private` (RLS activée, aucune politique, lecture réservée au `service_role`) : 7 lignes ajoutées (`token_admin_secret`, `yor_src_1` à `yor_src_5` = le code du contrat, `deployer_testnet_key` = clé jetable de testnet générée par la fonction, jamais lue ni affichée par moi). Aucune autre table ni fonction SQL modifiée. Lignes ajoutées ensuite : `yor_artifact_v1` (code compilé, ABI, empreintes ; re-vérifié contre les empreintes épinglées à chaque usage) et `yor_deploy_nile` (réservation du déploiement : txid, adresses, état `confirmed`). Une transaction réelle a été diffusée sur le testnet Nile (aucune sur mainnet).
- Fonction `yor-devtools` : coquille désactivée (410). Mes outils ne peuvent pas la supprimer ; suppression manuelle conseillée.
- Aucune politique, fonction SQL ni donnée utilisateur modifiée. Application web : inchangée (v12.1.0 non déployée).

## 7. Risques connus
1. Compatibilité TVM établie pour le déploiement, le constructeur et les lectures (déploiement réel sur Nile) ; **non établie pour les écritures** (`mint`, `transfer`, `approve`, `expireLots`), qui n'ont jamais été exécutées sur la chaîne.
2. Écarts possibles entre contrat et modèle tant qu'aucun test différentiel n'a tourné (Foundry non exécuté).
2bis. La clé du déployeur testnet (administrateur du contrat) est stockée côté serveur dans `app_private` : acceptable pour un testnet, à ne jamais reproduire sur un réseau réel (voir décisions).
3. Pas d'audit externe : testnet uniquement.
4. Limites de débit TronGrid sans clé API.

## 8. Décisions attendues du propriétaire
1. Voie retenue : `token-admin` (compilation faite). GitHub reste optionnel pour les tests sur machine virtuelle.
2. Clé de déploiement testnet jetable : **décidé (a)** — générée dans la fonction, jamais affichée ; le propriétaire finance seulement son adresse avec des TRX de test. Clé TronGrid gratuite : **acceptée** (optionnelle, secret Supabase `TRONGRID_API_KEY`).
3. Politique d'étiquetage (« TEST » ou « Non disponible ») et nom affiché du jeton.
4. Modèle de signature pour les utilisateurs (recommandé : portefeuille externe).

## Addendum 2026-10-09 — écriture réelle : droit de mint
- `token-admin` v5 (plateforme v6) : actions `callplan`, `opstatus` (lecture) et `grant_minter`, `testmint` (écriture, testnets seulement). Montant, fonction appelée et échéance sont fixés dans le code ; plafond de frais obligatoire ; simulation puis transaction re-encodée et contrôlée (17 vérifications) avant signature ; réservation avant diffusion ; `confirmed` seulement après solidification + SUCCESS + lecture on-chain.
- **Exécuté en réel sur Nile** : `grant_minter` — txid `46b4e57552eb7276ccd1f30e1d73fa63c4b9c2c5f0efb68e4c8af837a6ea7eda`, bloc 71 666 105, receipt SUCCESS, coût réel 2,2929 TRX (= simulation). Ligne ajoutée dans `public.app_private` : `yor_op_nile_grant_minter` (état `confirmed`).
- **Exécuté en réel sur Nile** : `testmint` — 1 870 000 YOR-USDT (« TEST BALANCE ») vers l'adresse TronLink du propriétaire (`TWoXF3…rfaX9`) : txid `7d4fbdfad22e3dd4f0919167a185d87f8d943efa358643a002b9e4dd98b7e8bf`, bloc 71 666 573, SUCCESS, solidifié ; coût réel 19,7323 TRX (193 543 énergie + 0,378 TRX de bande passante). `balanceOf` et `totalSupply` relus sur le nœud solidity = 1 870 000,000000. Ligne ajoutée dans `public.app_private` : `yor_op_nile_testmint` (état `confirmed`). **Solde de test, sans valeur, non lié à Tether.**
- **NON EXÉCUTÉ** : `transfer`, `approve`, `expireLots` (aucun transfert n'a eu lieu sur la chaîne), tests Foundry, Shasta.
- Tests : 105 purs + 23 de simulation (`tests/edge-sim`, faux nœud ; 7 garde-fous désactivés tour à tour ⇒ chaque désactivation fait échouer au moins un test). La cryptographie réelle n'est pas rejouée localement (noble non installable ici) : prouvée par `selftest` 10/10 et par les transactions acceptées par Nile.
- Limite connue : le runtime Supabase ne permet pas à la fonction de lire ses propres sources (`selfHash` = null) ; l'identité octet pour octet entre le dépôt et la version déployée n'est pas prouvée par empreinte, seulement par comportement.
