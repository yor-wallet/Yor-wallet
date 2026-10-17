# WalletConnect (Reown AppKit) — NEX WALLET 12.7.0

Ce dossier ne sert **qu'à construire** le fichier `js/vendor/reown-appkit.js`. Il n'est pas chargé par l'application :
vous pouvez le supprimer du dossier avant de déployer (le fichier `js/vendor/reown-appkit.js`, lui, est indispensable).

## Pourquoi un bundle
L'application est un site statique sans outil de build (voir `ARCHITECTURE.md`). Reown AppKit n'existe que sous forme de paquets npm :
`src/entry.js` les assemble en **un seul fichier** (esbuild, IIFE) qui expose `window.NexAppKit`. L'interface (`js/features/wallet-connect.js`)
ne le charge **qu'au premier clic** sur « Connect Wallet » (ou au démarrage seulement si une session WalletConnect est déjà enregistrée sur l'appareil).

## Ce que fait l'intégration
- Réseau : **TRON Nile (testnet) uniquement**, identifiant `tron:0xcd8690dc`, le seul réseau de l'application. Portefeuilles : l'extension TronLink (adaptateur inclus ; **connexion réelle non testée**, voir CHANGELOG) et les portefeuilles compatibles WalletConnect (QR / mobile).
- **Connexion seulement.** Aucune signature, aucune transaction, aucun message à signer n'est demandé par ce code. Aucune clé privée ni phrase de récupération n'est demandée, lue ou stockée : elles restent dans le portefeuille de l'utilisateur.
- Affiche l'état (non connecté / connexion / connecté), l'adresse raccourcie (clic = copier), un avertissement si le portefeuille n'est pas sur Nile, les erreurs (chargement, initialisation, refus, déconnexion) et un bouton Déconnecter.
- Les options Reown de compte, e-mail, réseaux sociaux, achat, échange, envoi, historique sont **désactivées**.
- **Piège à connaître** : dans `@reown/appkit/networks`, `tronNile` est une variante *EVM* (`eip155:3448148188`) ; le bon objet est **`tronNileTestnet`** (`tron:0xcd8690dc`). Avec le mauvais, le QR échoue (« Adapter not found »).

## Reconstruire le bundle
Testé avec Node.js 24.21 et npm 11.19 ; l'empreinte du fichier produit doit être vérifiée (sha256 ci-dessous).
```bash
cd walletconnect
npm ci          # exige package-lock.json (fourni à part, à placer dans ce dossier et à conserver) ; sans lui : npm install
npm run build   # écrit ../js/vendor/reown-appkit.js et affiche sa taille et son sha256
```
Versions épinglées exactement : `@reown/appkit` 1.8.24, `@reown/appkit-adapter-tron` 1.8.24, `@tronweb3/tronwallet-adapter-tronlink` 1.3.0, `esbuild` 0.28.2.

Bundle livré avec cette version (testé) :

| Élément | sha256 |
|---|---|
| `js/vendor/reown-appkit.js` (2 425 620 octets) | `a13ad9b8420dfa99b463037530f6c3d7bed1ad213605bf295bf5f5c34213f396` |
| `src/entry.js` (4 272 octets) | `da16d9767d081e294c3d45ef66779e5cbbe431e10ffe228db500b30049f2a9f6` |
| `package-lock.json` | `fda3b7ae8beab734122057a29e3c73927b0e0a4a0834cb929355b6812c8e6749` |

Reconstruction vérifiée : `npm ci` + `npm run build` à partir de ces fichiers et du `package-lock.json` redonne **exactement** le même fichier (comparaison octet par octet). Ne changez pas `"type": "commonjs"` dans `package.json` : avec `"module"` ou sans cette ligne, esbuild produit un fichier différent (2 424 065 octets), qui n'a pas été testé.

Sans `package-lock.json`, les dépendances indirectes sont résolues à la date du build : le fichier obtenu peut différer, il faut alors le **retester** avant de le publier.
Pour mettre à jour le SDK : changez les versions dans `package.json`, `npm install`, `npm run build`, puis refaites le test complet (ouverture du modal, QR, connexion, déconnexion) et regardez la console pour les violations de CSP.

## Réglages à faire côté Reown (obligatoire)
Le Project ID (`af2149939e459cc712a573792d710fb0`, dans `js/features/wallet-connect.js`) est **public par conception** ; la protection est la liste de domaines autorisés.
1. Ouvrez https://dashboard.reown.com → votre projet → **Domain** (liste d'autorisation).
2. Ajoutez le domaine exact de l'application, par exemple `mon-app.netlify.app` et chaque domaine personnalisé (sans `https://`). Pour des essais locaux, `localhost`.
3. Sans cela, le SDK peut afficher une erreur d'origine non autorisée ou ne pas charger la liste des portefeuilles.

## Sécurité : à savoir
- La CSP (`_headers` et `vercel.json`) autorise uniquement les domaines Reown / WalletConnect nécessaires (API, relais `wss://relay.walletconnect.org|com`, polices `fonts.reown.com`, vérification `verify.walletconnect.org|com`, images des portefeuilles). La liste suit la CSP recommandée par Reown ; lors du test (ouverture du modal, clic sur WalletConnect, QR), seuls `fonts.reown.com`, `api.web3modal.org`, `pulse.walletconnect.org`, `verify.walletconnect.org` et le relais `wss://relay.walletconnect.org` ont été contactés, sans aucune violation. Les autres entrées (rpc, keys, notify, echo, push, images…) n'ont pas été exercées et peuvent être retirées si vous voulez une CSP plus stricte, au prix d'un nouveau test. Si une fonction du SDK est bloquée, la console indique « Refused to … » avec le domaine à examiner.
- `npm audit` signale 6 alertes (5 hautes, 1 moyenne) toutes dans les dépendances **indirectes de l'adaptateur TronLink** (`tronweb` → `axios`, `ethers` → `ws`). Je n'ai pas évalué si ce code est atteignable depuis le navigateur. Le « correctif » proposé par npm est un retour à une très ancienne version : à ne pas appliquer sans test. Retirer l'adaptateur TronLink de `src/entry.js` supprimerait ces dépendances, au prix de ne plus proposer l'extension TronLink directement (WalletConnect resterait).
