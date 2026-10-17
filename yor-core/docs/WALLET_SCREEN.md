# Écran « YOR-USDT » (Services → Blockchain, réseau de test Nile)

Version : app 12.2.1, yor-core 0.6.1. Réseau : **TRON Nile (testnet) uniquement**. Jeton : **YOR Experimental USDT** (YOR-USDT, 6 décimales),
contrat `TYnzmpqeUWtXWjymVtdj4SADzW45adnzdf`. Ce n'est **pas** Tether.

## Qui peut voir l'écran
Réservé aux comptes dont `profiles.role = 'admin'` (deux comptes : YOR-754SNC et YOR-ASFNLS). Les autres comptes n'ont ni la tuile ni l'accès direct.
Masquage d'interface seulement (`canUseChain()` dans `chain-wallet.js`, garde `ADMIN_SCREENS` dans `router.js`) ; les fichiers de l'écran restent téléchargés par tous, et la blockchain est publique.
Le rôle est lu au chargement du profil : un compte promu doit se reconnecter. Dans Supabase, un utilisateur ne peut pas modifier sa colonne `role` (privilèges de colonne : seulement nom, prénom, pays, téléphone, photo).

## Ce que fait l'écran
- Connexion à **TronLink** (navigateur DApp de l'appli TronLink sur mobile, extension sur ordinateur). L'app ne voit jamais la clé privée.
- Lecture du solde YOR-USDT **sur la blockchain** (nœud solidity d'abord, nœud complet en secours, avec étiquette « read from full node »)
  et du solde TRX (frais). Le solde 1 870 000 s'affiche avec l'étiquette **TEST BALANCE** : c'est la valeur lue, jamais une valeur codée.
- Envoi de YOR-USDT : saisie → **simulation** (`triggerconstantcontract`) → écran de revue (énergie, frais estimés, plafond) → construction par le nœud →
  **vérification locale de la transaction** (17 contrôles) → signature dans TronLink → re-vérification → diffusion → suivi jusqu'à preuve.
- Activité : transferts de ce navigateur (états réels) + historique indexé par TronGrid (libellé « confirmé, indexé par TronGrid »).

## États d'un transfert (jamais « Confirmé » sans preuve)
`draft → pending_signature → broadcasted → confirming → confirmed` (+ `failed`, `expired`, `cancelled`).
« Confirmé » exige : nœud **solidity** + bloc > 0 + reçu `SUCCESS` + événement `Transfer` du contrat avec bons `from`, `to`, `montant`.
Un reçu vu seulement sur le nœud complet = « Confirmation en cours ». Reçu SUCCESS sans événement attendu = reste « en cours » avec alerte d'anomalie.
Introuvable après expiration + 60 s = « Expiré ».

## Sécurité
- Aucune clé dans le HTML/JS/stockage (test automatique `tests/tron/no-secrets.test.mjs`, test navigateur « aucune clé en clair »).
- Le nœud n'est pas cru sur parole : `L.checkTriggerTx` ré-encode `raw_data` (protobuf) et exige `txID = sha256(raw_data_hex)`, contrat = jeton,
  sélecteur `transfer`, destinataire et montant identiques à la revue, `fee_limit` ≤ plafond, `call_value` = 0, expiration valide, etc.
  Après signature : même `txID`, même `raw_data_hex`, une seule signature de 65 octets.
- Réseau : l'app n'appelle que `nile.trongrid.io`. La CSP (`_headers`, `vercel.json`) n'autorise que cet hôte TRON : le mainnet est bloqué par le navigateur
  (testé). Si TronLink est détecté sur un autre réseau, l'envoi est bloqué.
- Fenêtre de signature : le nœud propose 60 s ; l'app allonge l'expiration à **5 minutes** (limite de configuration : 10 min max) puis re-contrôle la transaction modifiée (17 vérifications). Si TronLink renvoie une autre transaction, rien n'est diffusé et l'essai suivant utilise la transaction standard (60 s). S'il reste moins de 4 s après la signature, elle n'est pas diffusée (« Expiré »).
- Aucun frais inventé : énergie = simulation du nœud, prix de l'énergie = `getchainparameters`. Le premier envoi vers une adresse neuve coûte ~18,6 TRX.

## Architecture / procédure de build
- `yor-core/supabase/functions/token-admin/lib.ts` + `yor-core/src/services/blockchain/transfer-state.mjs` + `yor-core/web/chain-client.js`
  → `node scripts/build-web.mjs` → `yor-wallet/js/features/yor-chain.js` (**fichier généré, ne pas modifier à la main**). Une seule source de vérité pour
  la logique qui protège les fonds (partagée avec la fonction Edge).
- `yor-wallet/js/screens/chain-wallet.js` (écran, EN/FR/AR) et `css/chain.css`.
- Vérifier la synchronisation : `npm run check:web` (échoue si le bundle servi diffère des sources).
- Tests : `npm test` (modèle, TRON, Edge, web = 69 tests, sim = 23) ; `npm run test:ui` (20 tests Chromium sans tête, sur la vraie app et la vraie CSP).

## Ce qui est réellement vérifié, et ce qui ne l'est pas
Vérifié (hors ligne, sur réponses Nile **réelles** enregistrées) : formats de réponses, transaction réelle de transfert (17 contrôles + ré-encodage exact),
reçu réel du mint (classification « confirmé »), simulation réelle (succès et revert), 12 scénarios d'écran, app réelle + CSP.

**NON EXÉCUTÉ** :
- aucune signature ni diffusion réelle depuis cet écran (il faut TronLink de l'utilisateur) ;
- comportement du **vrai TronLink** mobile (injection dans le navigateur DApp, `tronWeb.trx.sign`, effet de la CSP sur le `tronWeb` injecté) ;
- connexion en direct au Nile depuis le navigateur (les tests utilisent un faux nœud rejouant des réponses réelles ; le bac à sable n'atteint pas TronGrid) ;
- déploiement Netlify de la 12.2.0 ;
- persistance Supabase des transferts (aujourd'hui : stockage du navigateur + historique on-chain).

## Test à faire par l'utilisateur (téléphone)
1. Déployer le zip de l'app sur Netlify. 2. Obtenir des TRX de test : https://nileex.io/join/getJoinPage (l'adresse n'existe sur Nile qu'après avoir reçu des TRX).
3. Ouvrir https://yor-wallet.netlify.app **dans le navigateur DApp de TronLink**, se connecter, Services → YOR-USDT → Connecter TronLink.
4. Envoyer 1 YOR-USDT vers une autre adresse Nile ; signer dans TronLink dans la minute. 5. Vérifier le hash sur https://nile.tronscan.org.
6. En cas de problème : noter le texte exact affiché et l'étape.
