# YOR WALLET 11.3.0 — architecture

Même application que la 11.2.1, découpée en fichiers. Aucune logique, aucun texte, aucun style n'a été modifié :
le contenu des fichiers `css/` et `js/` mis bout à bout est identique au contenu de l'ancien `index.html`
(seule différence : le numéro de version, 11.2.0 -> 11.3.0, dans `js/data/reference-data.js`).

## Ordre de chargement (important)
`index.html` charge les scripts avec `defer`, dans l'ordre exact ci-dessous. Tous partagent la même portée globale
(comme l'ancien script unique). **Ne changez pas l'ordre** et ne passez pas en `type="module"` sans refactoring.

| Dossier | Contenu |
|---|---|
| `css/` | base, buttons, layout (iPhone/iPad/ordinateur), motion, home, redesign, v12, chain, **yor-ds** (système de design 12.4.0 : jetons `--ds-*`, composants ; chargé EN DERNIER, il surcharge les couches précédentes) |
| `js/core/` | client Supabase, moteurs (appareil, session, contexte, données), domaine, notifications, utilitaires/langue, routeur, état, helpers |
| `js/data/` | configuration, devises, pays, cryptos, réseaux, banques, taux |
| `js/i18n/` | traductions EN / FR / AR |
| `js/features/` | auth, PIN, verrouillage, présentation, transferts, achat crypto, récupération mot de passe |
| `js/screens/` | écrans : connexion, accueil, menu, transfert, reçu, historique/cartes, profil/paramètres, infos, marchés, crypto |
| `js/ui/` | icônes, export du reçu (PNG/PDF), UIKit |
| `js/layout/` | menu latéral, plein écran, moteur de viewport |
| `js/wire.js` | branchement des actions (clics) de chaque écran |
| `js/boot.js` | démarrage — toujours en dernier |
| `js/dev/` | tests d'isolation (console) |

## Ajouter un écran
1. Créer `js/screens/mon-ecran.js` avec `function renderMonEcran(){...}`.
2. L'enregistrer dans `js/screens/register.js` (`R.register({...})`).
3. Ajouter ses actions dans `js/wire.js` (bloc `if (id === 'mon-ecran')`).
4. Ajouter le fichier dans `index.html` (avant `js/wire.js`) et dans `SHELL` de `sw.js`.
5. Changer le nom du cache dans `sw.js` (`CACHE`) à chaque livraison.

## Écran YOR-USDT (12.2.0)
Ordre de chargement ajouté dans `index.html` : `js/features/yor-chain.js` (bundle généré, expose seulement `window.YorChain`), puis `js/screens/chain-wallet.js`
(après `js/screens/home.js` dont il utilise `YT`/`yt`, avant `js/screens/register.js`). Feuille de style `css/chain.css`.
Le bundle est construit dans le dossier `yor-core` (`node scripts/build-web.mjs`) : ne le modifiez pas ici. Voir `yor-core/docs/WALLET_SCREEN.md`.
Les trois fichiers sont dans `SHELL` de `sw.js` ; la CSP n'autorise que `https://nile.trongrid.io` côté TRON.

## Friendly Pay 12.8.0 (identité visuelle)
- Couleurs : source unique dans `css/yor-ds.css` section 1b (`--accent`, `--accent-600`, `--on-accent`, `--btn-grad`, `--btn-glow`, `--brand-grad`, par thème), reprise dans `css/v12.css` (jetons sombre / clair). Ne pas réintroduire de couleur en dur : utiliser ces variables.
- Nom : `APP.name` dans `js/data/reference-data.js`. Logo : `assets/brand/logo-mark.svg`, `logo-wordmark-*.svg`, `friendly-letters-white.svg`, `ui/icons.js` (`logoMark`, `logoLockup`). Icônes PNG : régénérées depuis `assets/icons/icon.svg`.
- Thème par défaut : clair (`boot.js`, `reference-data.js`, `index.html`). Identifiants internes conservés : `NexWC`, `brand:'NEX'`.

## NEX WALLET 12.6.1 (corrections e-mail / reçu) et 12.6.0
- 12.6.1 : e-mails au nom de NEX WALLET ; le reçu (écran, PNG / PDF, e-mail de transaction) n'affiche jamais le solde restant. Repris dans 12.7.0.

## NEX WALLET 12.6.0
- Palette : jetons dans `css/yor-ds.css` §1b (`--on-accent`, accent #FB923C sombre / #EA580C clair), texte sur surface orange via `--on-accent` (§14). L'identifiant de thème de carte `violet` est conservé (données), libellé « Orange ».
- Solde : `displayCurrency()` / `balanceView()` / `balanceText()` (helpers.js) ; conversion seulement avec un taux écrit (`FX_RATES`), montant d'origine toujours affiché.
- Inscription : `signupPhone(dial, raw)` (helpers.js) → `AuthEngine.signUp(email, pass, first, last, phone, country)` → métadonnées `phone` + `country` lues par `handle_new_user` ; le déclencheur refuse un numéro absent ou invalide.
- Carte : calques `.rv-grain` / `.rv-foil` + `--mx --my --shx` (doigt ou `deviceorientation`), §16. Reçu : §17 (animations `backwards`, coupées en mouvement réduit et à l'impression).

## Reçu 12.5.0
- `js/screens/receipt.js` : le statut réel (`txState`) pilote l'écran ; `REFUNDED` / `REVERSED` = non abouti. Lignes lues au serveur, jamais calculées : solde disponible (`wireReceiptBalance` → RPC `get_tx_balance_after`, opération confirmée non crypto, même devise, absent si `Runtime.hideBalance`) et état des messages (`wireReceiptNotice` → `get_recipient_notice_status`, champ `delivery`, relecture 30 s × 10 au plus).
- Boutons du bas : `.rc-another` (`data-nav="country-select"` pour un virement, `crypto-send` pour un envoi crypto, absent sur un reçu entrant) et `.rc-done` (Retour à l'accueil). Masqués à l'impression.
- `js/ui/receipt-export.js` : le PNG / PDF reprend la ligne de solde (`view.balance`) quand elle a été lue.

## WalletConnect 12.7.0
- `js/features/wallet-connect.js` (chargé après `chain-wallet.js`, avant `register.js`) définit `NexWC` : carte `[data-nwc-slot]` insérée dans le bloc `.ds-balance` de `renderHomeV12` (ne pas en faire un enfant direct de l'accueil : la grille bureau repose sur `nth-child`), actions `[data-nwc-act]`, textes `wc.*` dans `TR`. `NexWC.init()` est appelé dans `boot.js`. Feuille `css/wallet-connect.css`.
- `js/vendor/reown-appkit.js` : bundle généré (IIFE, expose `window.NexAppKit`), chargé à la demande par `NexWC`, **non précaché** par `sw.js`. Construit depuis `walletconnect/` (`npm ci && npm run build`) ; ne le modifiez pas à la main.
- TRON Nile uniquement. Connexion seulement : aucune signature ni transaction n'est émise par ce code.

## Friendly Pay 12.9.0 (menu, Face ID, pavé tactile)
- Ordre CSS : …, `yor-ds`, **`friendly`** (dock, solde compact, œil, actions rapides, pavé, verrouillage, animations, impression), `wallet-connect`. `friendly.css` surcharge la barre du bas avec `#bottom-nav.bottom-nav` + `!important` (les couches précédentes en utilisent aussi).
- Nouveaux scripts : `js/ui/keypad.js` (`Keypad` : `padHtml`, `bind`, `fly`, `bloom`, `shuffleOn`) chargé avant `js/features/pin.js` ; `js/features/faceid.js` (`FaceId` : `gate`, `reenroll`, `supported`, `info`, `warm`, `name`) chargé avant `js/features/app-lock.js`. Tous deux dans `SHELL` de `sw.js` (cache `yor-shell-v12.9.0`).
- Face ID : WebAuthn (authentificateur de plate-forme, `userVerification: 'required'`), clé publique dans `localStorage` (`friendly_faceid_v1`), contrôle local de l'assertion. Appelé par `AppLock` (connexion) et `PinFlow.authorize()` (transfert) avant la logique PIN d'origine. Le PIN reste le facteur serveur.
- Identifiants : la base garde `YOR-XXXXXX` (contrainte `profiles_yor_id_check`) ; l'interface affiche `FRD-` via `dispId()` et normalise la saisie via `normId()` (`js/core/helpers.js`).
- Connect Wallet : section « Portefeuille » des Réglages (`NexWC.section`, `js/screens/profile-settings.js`) ; l'ancien emplacement `[data-nwc-slot]` de l'accueil n'existe plus.
- Menu : `buildNav()` / `placeInd()` / `watchNav()` dans `js/screens/v12.js` ; icônes dans `js/ui/icons.js` (`FRIENDLY_ICONS` fusionnées sur `IC`).

## Friendly Pay 12.10.0 (publicités illustrées de l'accueil)
- `js/features/promos.js` (`const Promos`, chargé avec `defer` après `v12.js`) : `Promos.html()` renvoie le carrousel (chaîne vide si masqué pour la session), `Promos.init()` (appelé par `boot.js`) pose **une seule fois** les écouteurs délégués (clic sur points / « Masquer », défilement, toucher) et le minuteur de défilement automatique. L'accueil `renderHomeV12` insère `Promos.html()` juste après la rangée d'actions rapides ; `data-nav` des boutons est géré par la délégation existante (`R.go`).
- `css/promos.css` : piste `flex` + `scroll-snap-type:x mandatory` (compatible droite-gauche), carte `flex:0 0 100%`, fond propre à chaque scène (identique en thème clair / sombre), image en `position:absolute` ancrée par `inset-inline-end`. Les boutons des points neutralisent le `min-width/min-height:44px` global (`button` dans `layout.css`) et gardent une zone de toucher élargie par `::before`.
- `assets/ads/*.svg` : images **générées** (personnages et accessoires en SVG, ~12–19 Ko chacune, sans script ni lien externe) ; les sources de dessin (JS) ne sont pas livrées dans le zip ; elles sont dans `yor-core/tools/ads/` (`node build.mjs <dossier>` régénère les 5 SVG). Les cercles décoratifs restent **dans** le cadre 240×200 (sinon l'`<img>` les rogne et laisse un bord net, surtout en droite-gauche).
- Ajouter ou modifier une carte : éditer `ITEMS` (titre / texte / bouton en `fr`, `en`, `ar` ; `nav` = écran existant ; `art` = fichier SVG), ajouter l'image à `SHELL` dans `sw.js`, relancer `tests/ui/promos.test.mjs`. Ne jamais y mettre de frais, délai, taux ni marque tierce (le test échoue sinon).

## Friendly Pay 12.11.0 (ouverture, robustesse, arabe, fichiers)
- Ordre CSS : …, `promos`, `wallet-connect`, **`opening`**, **`resilience`**. Nouveaux scripts (avec `defer`) : `js/ui/opening-art.js` (`OpeningArt.splash(lang)`, `OpeningArt.slide(i)`), `js/features/resilience.js` (`Resilience`), `js/features/onboarding.js` (réécrit).
- Ouverture : `boot.js` remplace le contenu de `#splash` par `OpeningArt.splash(LANG)`, mesure `splashT0` à l'insertion et attend `SPLASH_MIN` (1900 ms ; 600 ms en mouvement réduit ; crochet de test `window.__FP_SPLASH_MIN`). Les animations ont pour état de base l'état FINAL (`animation-fill-mode:both` sur les images de départ) : en mouvement réduit on voit l'image finale. Pas d'animation CSS sur un élément SVG portant déjà un attribut `transform`.
- Présentation : `Onboarding.show(done)` → `done('signup'|'login')`. Piste horizontale pilotée par `--ob-x` (inversée en RTL), 4 pages, `data-fast` sur « Suivant ».
- Robustesse : `R.go()` rend un écran de secours (`Resilience.errorScreen(id)`, identifiant assaini) si le rendu lève une exception ; `Resilience.init()` écoute `error`, `unhandledrejection`, `online`, `offline` ; `AuthEngine` émet `LOAD_FAILED` si la session existe mais le profil est illisible.
- Raccourcis : `LAUNCH_HASH` est lu au chargement de `boot.js`, `openHome()` ouvre l'accueil puis l'écran demandé s'il est dans `DEEP_OK`. `R.resolve(hash)` renvoie l'identifiant d'écran ou `null`.
- Arabe : `logoLockup()` rend « فرندي » + « باي » (classes `logo-name-ar`, `logo-sub-ar`) ; règle globale `letter-spacing:0` en RTL (liste d'exceptions pour les chiffres) dans `css/base.css` ; `ReceiptExport` espace les lettres latines uniquement.
- Service worker : voir l'en-tête de `sw.js`. **Règle (12.11.1)** : il ne gère QUE les fichiers du même site ; il ne doit jamais intercepter une ressource d'un autre site (le rechargement par le service worker est soumis à `connect-src` de la CSP et casse le démarrage). `js/boot.js` : `healServiceWorker()` répare une seule fois un téléphone resté sur un service worker défaillant. Test : `tests/ui/service-worker-real.test.mjs` (seul test qui autorise les service workers). Règle : tout fichier local chargé par `index.html` doit figurer dans `SHELL` (testé par `friendly-1211.test.mjs`).
- Générateur des PNG / SVG de marque et des écrans de démarrage : `yor-core/tools/brand/build-assets.mjs` (Chromium + Playwright ; `node build-assets.mjs <sortie> <dossier-app>` ; variable `ONLY=brand|splash|…`).

## Friendly Pay 12.12.0 (transferts d'argent uniquement)
- `FEATURES.crypto` (`js/data/reference-data.js`, objet gelé, `false`) masque toute la section crypto ; `CRYPTO_SCREEN_RE` désigne les écrans concernés (`crypto*`, `chain`, `banks*`). Garde dans `router.js` (renvoie à l'accueil), filtres dans `sidebar.js`, `drawer.js`, `crypto-market.js` (Services), `history-cards.js` (`visibleTransactions`), `profile-settings.js`, `v12.js`, `boot.js` (`DEEP_OK`, pas de `NexWC.init()`). Le code crypto reste intact derrière le drapeau.
- Transfert : `country-select` (numéro d'Oman seul : `omLocalDigits`, `omFormatLocal`, `omIntl` dans `transfer-flow.js`) → `tx-amount` → `tx-review` (code personnel) → `processing` → `receipt`. Un seul service (`local_phone`, pays `OM`) ; requête `fiat_send_external` avec `identifierType: 'PHONE'`.
- Frais : `FeeEngine` et `CONFIG.FEES` valent 0 ; le serveur (`_fiat_send_external_impl`) débite le montant seul.
- `ProcessingEngine.run(work, opts)` (`js/core/state.js`) lance le travail tout de suite et fait suivre à l'animation l'état réel ; `SendAnim` (`js/ui/send-anim.js`) dessine la scène (SVG + CSS, seule la pièce est pilotée par script) et expose `svg()`, `setPhase()`, `stop()`.
- Tests : `openApp(browser, { crypto: true })` (`tests/ui/ui-harness.mjs`) réactive le drapeau uniquement dans la copie servie au navigateur de test.

## Friendly Pay 12.13.0 (alertes sur le téléphone — Web Push)
- Chaîne : écriture dans `public.notifications` (types `TRANSFER_SENT`, `TRANSFER_RECEIVED`, `DEPOSIT`) → déclencheur `notifications_push` → `_push_on_notification()` (si la personne a un appareil abonné) → `net.http_post` vers la fonction `push-send` avec le jeton interne (`x-notice-token`, table privée `notice_dispatch_cfg`) → chiffrement RFC 8291 + signature VAPID RFC 8292 → service de push (Apple APNs : `*.push.apple.com`) → appareil → `sw.js` (`push` → `showNotification`).
- Application : `js/features/push.js` (module `Push` : `state()` = `unsupported | install | denied | off | on`, `enable()` appelé directement depuis le toucher, `disable()`, `sync()` à chaque ouverture connectée, `forget()` avant `signOut`, `test()`, `syncBadge()`, `listen()`, ligne des Réglages). Clé publique : `CONFIG.PUSH.vapidPublicKey`. L'enregistrement passe par `sb.functions.invoke('push-send', { action: 'subscribe' | 'unsubscribe' | 'test' })` — aucune fonction SQL.
- Service worker : événements `push` (toujours une alerte visible, titre ≤ 80 / texte ≤ 200, `url` doit commencer par `#`), `notificationclick` (focus + message `fp-push-click`, sinon ouverture de `scope + url`), `pushsubscriptionchange` (message `fp-push-resync`).
- Serveur : `supabase/functions/push-send/{index.ts,lib.ts}` (logique pure testée dans `tests/edge/push-send-lib.test.mjs`), migration `supabase/migrations/20261018_web_push.sql`. Une seule alerte par notification (`push_sent`) ; 404 / 410 → abonnement supprimé ; 10 échecs de suite → supprimé ; 10 appareils au plus par personne ; « test » limité à 1 toutes les 5 s.
- Contraintes Apple : iOS 16.4+, application sur l'écran d'accueil, autorisation demandée sur un geste, chaque push affiche une alerte (`userVisibleOnly`).
- Tests : `tests/ui/push-app.test.mjs` (service worker sous `vm` + écran Réglages dans Chromium avec faux `PushManager`).


## Friendly Pay 12.14.0 (couche premium)
- Ordre CSS : …, `resilience`, **`premium`** (dernière : polices `@font-face`, jetons, accueil, profil, réglages, reçu, animation 4 étapes, mouvement réduit). Elle surcharge `friendly.css` là où celui-ci utilise `!important` (carte de solde, transition d'écran).
- Script `js/features/premium.js` (après `push.js`, avant `wire.js`) : enregistre `home`, `receive`, `profile`, `profile-edit`, `tx-result` (remplace les anciens rendus de `home` et `profile`, qui restent dans le code) ; modules `Premium`, `TxResult`, `PxSearch`, `PxInstall`, `BalanceFx`, aides `maskPhone`, `maskEmail`, `txMatches`. `wire()` appelle `Premium.onScreen(id, root)` ; un `data-nav` sans branche dédiée va vers `R.go(n)` (le routeur refuse les écrans inconnus).
- Transferts : `TransferEngine.isUncertain(error, status)`, `TransferEngine.checkExternal(req)` (lecture sans autorisation PIN), `ProcessingEngine.run(work, { timeoutMs })` (30 s par défaut, phase `uncertain`, `out.late` = requête toujours en cours), `SendAnim.setPhase('uncertain')`. `PinEngine.change()` → `change_pin`.
- Historique : objet `HIST` (`q`, `period`, `dir`) dans `history-cards.js`, appliqué par `historyFilter`.
