# YOR WALLET — Architecture cible (proposition Phase 1)

| | |
|---|---|
| Statut | **Proposition, rien n'est implémenté.** Elle attend vos décisions (section 13) avant la Phase 2. |
| Base | `CURRENT_ARCHITECTURE.md` (audit du 8 octobre 2026) |
| Priorité de conception | RÉEL > SÉCURISÉ > TESTABLE > MAINTENABLE > ÉVOLUTIF > ESTHÉTIQUE |

---

## 1. Principes directeurs

1. **Aucune régression.** Inspecter → migrer l'ancien vers le nouveau → tester → valider → seulement alors supprimer. L'ancienne interface continue de fonctionner pendant toute la migration.
2. **La blockchain est la source de vérité** des soldes de jeton et des transferts (`balanceOf`, hash, confirmations). Supabase ne garde que comptes, profils, préférences, index des transactions, métadonnées, notifications, audit et état applicatif.
3. **Honnêteté d'état.** Chaque fonctionnalité porte l'un de ces statuts : *réelle*, *test (testnet)*, *indisponible (fournisseur non configuré)*. Aucune fonction de test n'est présentée comme réelle. « Confirmé » n'apparaît qu'après vérification d'une confirmation réelle.
4. **Rien d'inventé** : ni hash, ni adresse de contrat, ni carte, ni KYC, ni paiement, ni solde on-chain. Ce qui ne peut pas être exécuté est écrit **NOT EXECUTED** avec la raison.
5. **Aucun secret côté navigateur ni en table publique** : pas de clé privée, de phrase de récupération, de PAN complet, de CVV ni de PIN en base.
6. **Les opérations sensibles passent par le serveur** (fonctions SQL ou Edge Functions) ; le front ne peut modifier ni solde, ni statut de transaction, ni rôle.

## 2. Environnements et configuration

| Environnement | `TRON_NETWORK` | Règles |
|---|---|---|
| `development` | `shasta` | jeton et soldes de test uniquement, bandeau « TEST » visible |
| `testnet` | `nile` | idem, avec indexeur actif |
| `production` | `mainnet` | **jamais utilisé en développement ; aucun déploiement automatique vers mainnet** ; déploiement manuel après revue |

`.env.example` (noms uniquement, aucune valeur réelle ; un vrai `.env` n'est jamais versionné) :

```
APP_ENV=development
TRON_NETWORK=shasta
TRON_FULL_NODE_URL=
TRON_API_KEY=
YOR_EXPERIMENTAL_TOKEN=true
YOR_TOKEN_CONTRACT_ADDRESS=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CARD_PROVIDER=mock
CARD_PROVIDER_API_KEY=
CARD_WEBHOOK_SECRET=
BREVO_API_KEY=
```

`YOR_TOKEN_CONTRACT_ADDRESS` reste **vide** tant qu'aucun déploiement réel n'a eu lieu. La clé `SUPABASE_SERVICE_ROLE_KEY` n'existe que comme secret d'Edge Function.

| Fournisseur | Rôle | Statut |
|---|---|---|
| Supabase (Auth, Postgres, Edge Functions) | back-end | `CONFIGURED` |
| Brevo | e-mails | `CONFIGURED` (clé présente ; réception réelle non vérifiée) |
| Netlify | hébergement | `CONFIGURED` |
| TronGrid ou nœud TRON | lecture/diffusion | `NOT_CONFIGURED` |
| Signature de transactions | voir §6.3 | `NOT_CONFIGURED` |
| Émetteur de cartes | cartes réelles | `NOT_CONFIGURED` |
| KYC | vérification d'identité | `NOT_CONFIGURED` |
| Source de taux/prix | change, marché | `NOT_CONFIGURED` (table statique en attendant) |
| Virements bancaires / mobile money | paiements sortants | `NOT_CONFIGURED` |

## 3. Arborescence cible et migration progressive

```
/src
  /components   /pages   /hooks   /utils   /types   /store
  /config                      (environnements, drapeaux de fonctionnalités)
  /services
     /blockchain               (TronProvider, TokenService, TransferService)
     /supabase                 (accès données, RPC typées)
     /cards                    (CardProvider, MockCardProvider)
/contracts                     (YORExperimentalUSDT.sol)
/supabase
  /functions                   (Edge Functions)
  /migrations                  (SQL versionné, additif)
/tests   /docs
```

Méthode « étrangler l'ancien code » : le dossier actuel `js/` reste servi tel quel. Chaque nouvelle brique est ajoutée **à côté**, exposée derrière un drapeau de fonctionnalité, branchée écran par écran, puis l'écran ancien est retiré une fois le nouveau validé. Comme l'app n'a pas d'étape de build, deux voies sont possibles pour `/src` : (a) modules ES natifs chargés par `index.html` pour les nouvelles pièces uniquement ; (b) introduction d'un bundler plus tard. Je recommande (a) d'abord (aucun risque pour l'existant), décision en §13.

Chaque nouveau fichier doit être ajouté à `SHELL` du service worker, avec un nouveau nom de cache.

## 4. Modèle de données cible (Supabase)

Principe : migrations **additives** testées sur une **branche Supabase**, jamais directement en production. Les tables existantes restent lues par l'ancien code jusqu'à validation.

| Table cible | Source / traitement | Colonnes clés |
|---|---|---|
| `profiles` | existante ; `role` étendu à `user`/`admin`/`super_admin` (contrainte modifiée) | `role`, `status`, `kyc` |
| `wallets` | **nouvelle** (adresses TRON publiques liées à un compte) ; distincte de `crypto_wallets` (registre interne) | `user_id`, `network`, `address`, `provider`, `verified_at` |
| `token_metadata` | nouvelle | `symbol`, `name`, `decimals=6`, `network`, `contract_address` (NULL tant que non déployé), `experimental=true` |
| `token_lots` | **miroir indexé** des lots du contrat (lecture seule côté front) | `lot_id`, `owner_address`, `amount`, `created_at`, `expires_at`, `remaining` |
| `transactions` | existante, **étendue** (colonnes `chain`, `tx_hash`, `confirmations`, `chain_status`, `request_id`) plutôt que remplacée | |
| `transaction_events` | s'appuie sur `tx_events` existante | historique d'états |
| `expiration_events` | nouvelle | `lot_id`, `amount`, `block`, `tx_hash` |
| `audit_logs` | existante `audit_log`, étendue | acteur, action, cible, horodatage, `ip_hash`, métadonnées, résultat — jamais de secret |
| `webhook_events` | nouvelle | `event_id` unique, source, charge utile, signature vérifiée, statut de traitement |
| `card_accounts`, `cards`, `card_transactions`, `card_webhooks` | nouvelles (§8) | jamais de PAN complet, CVV ni PIN |

Règles RLS : lecture propriétaire ou admin ; **aucune** politique d'écriture sur soldes, statuts, rôles ; écriture uniquement par fonctions SQL ou Edge Functions ; `webhook_events` et tables d'état interne en refus total pour `authenticated`. Rôles `user`/`admin`/`super_admin` appliqués **côté serveur** (`is_admin()` / `is_super_admin()`), jamais déduits du front. L'octroi du rôle `super_admin` se fait par une fonction réservée, journalisée, et non par une adresse e-mail codée en dur (suppression de `promote_owner_on_confirm` après remplacement).

Idempotence : `request_id` / `payment_id` / `transaction_id` / `webhook_event_id` uniques ; la table `idempotency_keys` existante est conservée.

## 5. Exposition des états (règle d'interface)

| Cas | Environnement test | Production |
|---|---|---|
| Fonction réelle | affichée | affichée |
| Fonction de test (registre interne, prix statiques…) | affichée avec bandeau « TEST » | **masquée ou « Non disponible »** |
| Fournisseur non configuré | « Fournisseur non configuré » | « Non disponible pour le moment » |
| Solde 1 870 000 | uniquement comme « TEST BALANCE » (testnet) ou valeur lue via `balanceOf` | jamais codé en dur |

Cette règle réconcilie votre consigne d'origine (aucun mot « simulation/démo » en production) avec l'exigence V2 d'étiqueter clairement le test (décision §13-a).

## 6. Couche blockchain TRON

### 6.1 Fournisseur
Interface `TronProvider` (lecture : `getBalance`, `getTransaction`, `getEvents`, `getBlock` ; écriture : `broadcast(signedTx)`) avec une implémentation TronGrid/nœud pour Shasta, Nile et mainnet. Aucune URL ni clé en dur : tout vient de la configuration.

### 6.2 États d'un transfert
`draft → pending_signature → broadcasted → confirming → confirmed`, plus `failed`, `expired`, `cancelled`. « Confirmé » exige : transaction trouvée, exécution réussie, nombre de confirmations atteint, événement `Transfer` correspondant. Les frais sont affichés séparés : **Network Fee** / **Service Fee** / **Total** ; si inconnus : « Fee unavailable » (aucun frais inventé).

### 6.3 Signature — décision requise
| Option | Principe | Avantage | Limite |
|---|---|---|---|
| A. Portefeuille externe | l'utilisateur signe dans son portefeuille TRON ; YOR ne voit jamais la clé | le plus sûr, non-custodial | demande un portefeuille compatible ; moins fluide sur mobile |
| B. Portefeuille serveur sécurisé | clé gardée dans un coffre (secret d'Edge Function / HSM) | expérience simple | YOR devient dépositaire : obligations de sécurité et réglementaires |
| C. Infrastructure custodiale tierce | fournisseur de garde | délègue la garde | fournisseur à choisir et contractualiser |

Tant qu'aucune option n'est choisie, l'interface affiche **« Wallet signing provider not configured »**. Je recommande A pour les utilisateurs et, pour le testnet uniquement, une clé de déploiement dédiée, jetable, créée par vous et jamais transmise dans cette conversation.

### 6.4 Indexeur
Edge Function `tron-indexer` planifiée : lit les blocs/événements du contrat via le fournisseur, **ne fait jamais confiance aux données du front**, écrit `transactions`, `transaction_events`, `token_lots`, `expiration_events` avec reprise sur erreur et idempotence (`tx_hash` + `log_index`). Le solde affiché provient de `balanceOf` (lecture directe ou cache daté), jamais d'une colonne modifiable.

## 7. Jeton « YOR Experimental USDT » (YOR-USDT)

Nom, symbole `YOR-USDT`, 6 décimales, réseau TRON, standard TRC-20, **distinct de Tether USDT** (le texte d'interface doit toujours dire « expérimental », jamais le simple mot « USDT »). `YOR_EXPERIMENTAL_TOKEN=true`. Adresse du contrat : vide jusqu'à un déploiement réel, enregistrée ensuite dans `token_metadata` après vérification on-chain.

### 7.1 Contrat `/contracts/YORExperimentalUSDT.sol` (spécification)
- Fonctions TRC-20 : `totalSupply`, `balanceOf`, `transfer`, `approve`, `allowance`, `transferFrom`.
- Rôles : `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `BURNER_ROLE`. Aucun mint par les utilisateurs. `mint(to, amount, expiresAt)` crée un lot ; `burn` consomme des lots.
- Événements : `Transfer`, `Mint`, `Burn`, `Expiration`.
- Compilateur et bibliothèques compatibles TVM : **à confirmer au moment de la Phase 5** (non vérifié ici).

### 7.2 Expiration par lots (explicite)
`TokenLot { id, owner, amount, createdAt, expiresAt, remainingAmount }`.

- Règle de consommation documentée : **FIFO par ordre d'arrivée** ; un transfert crée chez le destinataire un lot qui **hérite de l'`expiresAt` d'origine**.
- Aucune boucle non bornée : chaque opération touche au plus `MAX_LOTS_PER_OP` lots ; au-delà, elle échoue avec une erreur explicite (« too many lots ») et le détenteur fractionne son opération en plusieurs transferts plus petits ; `expireLots` / `expireLotsFrom` (accessibles à tous) permettent de purger les lots échus par tranches de 50.
- `balanceOf(owner)` = total des lots restants non encore traités ; `availableBalanceOf(owner)` = lots non expirés ; `expiredBalanceOf(owner)` = lots échus non encore brûlés ; versions paginées pour les comptes à nombreux lots.
- `expireLots(owner, maxLots)` : **accessible à tous**, ne peut brûler que des montants réellement échus, émet `Expiration`. Une expiration ne se produit jamais sans lot ni échéance enregistrés.
- `expiresAt = 0` peut signifier « sans échéance » (à valider).

### 7.3 Test critique (environnement de test uniquement)
Wallet A reçoit 1 870 000 YOR-USDT par `mint` réel sur Nile/Shasta → transfert de 50 vers Wallet B → A : 1 869 950, B : 50, **vérifiés par `balanceOf` réel**. **NOT EXECUTED** : aucun accès réseau TRON depuis mon environnement, aucun contrat déployé, aucune clé.

## 8. Cartes YOR

Interface `CardProvider` : `createCard`, `getCard`, `getCardStatus`, `freezeCard`, `unfreezeCard`, `terminateCard`, `setSpendingLimit`, `getTransactions`. Implémentations : `MockCardProvider` (tests uniquement, jamais en production) et un fournisseur réel (Phase 14, `NOT_CONFIGURED`).

- Jamais « Carte active » sans carte réellement émise ; jamais de PAN complet, CVV ni PIN en base (seulement jeton fournisseur, 4 derniers chiffres, expiration).
- Deux soldes séparés : **Solde blockchain** et **Solde disponible carte**, reliés par un parcours explicite *Wallet → Financement → Conversion/Règlement → Registre carte* ; 1 YOR-USDT n'est jamais supposé valoir 1 USD.
- Edge Function `card-webhook` : vérifier la signature, valider la charge utile, vérifier `event_id`, rejeter les doublons, stocker, traiter. 3DS jamais contourné.
- Migration des 13 cartes actuelles : remplacement de leur donnée sensible, puis suppression des champs `number`/`cvv` — après validation.

## 9. Edge Functions cibles

| Fonction | Rôle | Existe |
|---|---|---|
| `send-email` | e-mails Brevo | oui (conserver) |
| `tron-indexer` | synchronisation chaîne → Supabase | non |
| `tron-broadcast` | relais d'une transaction **déjà signée** | non |
| `token-admin` | mint/burn/expiration (testnet, clé dédiée) | non |
| `card-webhook` | événements de l'émetteur | non |
| `admin-roles` | octroi/retrait de rôle (super_admin) avec audit | non |

## 10. Tests

Unitaires et d'intégration : portefeuille, jeton, expiration, blockchain (testnet), RLS/RPC Supabase avec comptes distincts, cartes (mock), idempotence, webhooks dupliqués. Un test RLS vérifie qu'un utilisateur ne peut modifier ni solde, ni statut, ni rôle. Résultats rapportés *PASSED / FAILED / NOT EXECUTED* — jamais présentés comme réussis sans exécution.

## 11. Gains rapides proposés (réversibles, à valider avant d'agir)

Ils répondent à l'audit sans attendre la blockchain, sur branche Supabase d'abord :

1. Masquer en production la réception d'adresses crypto et l'envoi externe tant qu'aucun fournisseur réel n'existe (R-01, R-02).
2. Ne plus marquer `CONFIRMED` un virement international sans circuit de paiement ; afficher « Non disponible » (R-03).
3. Cesser de stocker PAN/CVV ; ne plus créer de cartes `ACTIVE` sans émetteur (R-04).
4. Ignorer `demoScenario` côté serveur (R-07).
5. Remplacer la promotion admin par e-mail par une fonction `super_admin` journalisée (R-08).
6. Activer la protection contre les mots de passe compromis ; ajouter SRI sur `supabase-js` (R-10, R-11).

## 12. Plan des phases

| Phase | Objet | Exécutable ici | Prérequis / sortie |
|---|---|---|---|
| 1 | Audit | **fait** | ces deux documents |
| 2 | Architecture modulaire `/src`, drapeaux d'environnement, `.env.example` | oui | décision §13-c |
| 3 | Supabase : rôles, RLS, audit, tests d'accès | oui, sur branche | décision §13-e |
| 4 | TRON testnet : configuration, `TronProvider` | code oui ; **appels réseau NOT EXECUTED** | clé TronGrid (§13-f) |
| 5 | Contrat expérimental | code et tests locaux possibles ; **déploiement NOT EXECUTED** | décisions §13-b, §13-d |
| 6 | Portefeuille et solde réel | NOT EXECUTED tant que 4–5 non faites | contrat déployé |
| 7 | Transfert et confirmation | idem | signature choisie |
| 8 | Indexeur et synchronisation | code oui ; exécution NOT EXECUTED | contrat déployé |
| 9 | Expiration on-chain | idem | |
| 10 | Historique et audit | oui | |
| 11–12 | Abstraction carte et `MockCardProvider` | oui | |
| 13 | Tests | partiel (hors chaîne) | |
| 14 | Étude d'un fournisseur de cartes réel | recherche web possible ; **connexion NOT EXECUTED** | choix du propriétaire |
| 15 | UI/UX | oui | |
| 16 | Préparation production | revue et check-list ; **mainnet jamais automatique** | validation du propriétaire |

Rapport final en 17 points à chaque clôture de phase, avec *fichiers créés/modifiés/supprimés (AUCUN si aucun)*, tests *PASSED/FAILED/NOT EXECUTED*, actions propriétaire et commandes de démarrage.

## 13. Décisions requises avant la Phase 2

a. **Libellés** : étiquettes « TEST » en développement/testnet et « Non disponible » en production (proposition §5), ou autre règle ?
b. **Nom du jeton** : garder « YOR Experimental USDT / YOR-USDT » avec la mention « expérimental » partout, ou changer de nom pour éviter toute confusion avec Tether ?
c. **Structure du front** : modules ES natifs à côté de l'existant (recommandé) ou bundler ?
d. **Signature** : option A, B ou C (§6.3) ?
e. **Rôles** : qui est le propriétaire `super_admin` (compte à désigner) et autorisez-vous le travail de durcissement sur une branche Supabase avant la production ?
f. **Fournisseur TRON** : créer une clé TronGrid (gratuite, à votre nom) pour Nile/Shasta.
g. **Fonctionnalités de test existantes** (achat/vente/échange crypto sur prix statiques, adresses internes) : à garder en environnement de test seulement, ou à retirer de la production dès maintenant ?
