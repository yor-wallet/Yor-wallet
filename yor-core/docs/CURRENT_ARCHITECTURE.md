# YOR WALLET — Architecture actuelle (audit Phase 1)

| | |
|---|---|
| Version auditée | 12.1.0 (copie de travail non déployée) ; le site en ligne est la 12.0.2 |
| Date de l'audit | 8 octobre 2026 |
| Méthode | Lecture seule : code source de l'app + base Supabase `gebjmguoauvutiqvoswl` (politiques, fonctions, déclencheurs, tâches planifiées, données agrégées). **Rien n'a été modifié**, ni dans l'app ni en production. |
| Périmètre non couvert | Aucun accès réseau à TRON depuis l'environnement de travail ; aucune clé privée ni phrase de récupération vue ou demandée. |

Légende des catégories (reprise du prompt V2) :
**(1)** réellement implémenté · **(2)** connecté à un service externe réel · **(3)** prêt à recevoir une intégration · **(4)** mode test / développement · **(5)** indisponible tant qu'un fournisseur réel n'est pas configuré.

---

## 1. Vue d'ensemble

```
Navigateur (PWA statique, JS vanilla, sans build)
  index.html + css/ + js/ + sw.js            hébergé sur Netlify (yor-wallet.netlify.app)
        │  supabase-js 2.45.4 (CDN jsdelivr, sans SRI)
        ▼
Supabase (ap-south-1, Postgres 17)
  ├─ Auth (inscription, connexion, récupération)
  ├─ Tables public.* (21, RLS activée partout) + 59 fonctions SQL
  │     └─ logique d'argent = fonctions RPC SECURITY DEFINER (code PIN + clé d'idempotence)
  ├─ pg_cron : e-mails (5 min) + avancement des virements bancaires simulés (1 min)
  ├─ Edge Function send-email  ──► Brevo (API e-mail)
  └─ Storage : bucket public « avatars »
```

Aucun code blockchain n'existe dans le projet (ni TronWeb, ni appel TronGrid, ni ABI, ni contrat).

Volumes en base au moment de l'audit : 13 utilisateurs (9 e-mails confirmés), 41 transactions, 26 comptes, 104 portefeuilles crypto (8 par utilisateur), 61 écritures de grand livre, 66 e-mails journalisés, 13 cartes, 77 reçus, 134 sessions, 2 lignes d'audit.

## 2. Fichiers de l'application

Taille : JS ≈ 438 Ko (dont `wire.js` 78 Ko), CSS ≈ 128 Ko, assets ≈ 148 Ko.

| Dossier | Fichiers | Rôle |
|---|---|---|
| racine | `index.html`, `sw.js`, `manifest.webmanifest`, `_headers` (Netlify), `vercel.json` + `.vercelignore` + `DEPLOIEMENT-VERCEL.md` (obsolètes), `ARCHITECTURE.md` (périmé, décrit la 11.3.0), `CHANGELOG.md` | coque PWA, en-têtes de sécurité, cache hors ligne |
| `css/` | `base`, `buttons`, `layout`, `motion`, `home`, `redesign`, `v12` (chargé en dernier) | thèmes sombre/clair, charte YOR 12.1 |
| `js/core/` | `supabase-client`, `engines`, `domain`, `notifications`, `utils-lang`, `router`, `state`, `helpers` | client Supabase, `UserContext`/`UserDataEngine`/`Runtime`, moteurs métier (change, frais, adresses, réseaux) |
| `js/data/` | `reference-data` | `CONFIG`, devises, pays, cryptos, réseaux, banques, **taux et prix statiques** |
| `js/i18n/` | `translations` | EN / FR / AR (RTL) |
| `js/features/` | `auth`, `pin`, `app-lock`, `onboarding`, `transfer-engine`, `crypto-buy`, `recovery`, `v12` | authentification, code à 6 chiffres, verrouillage, appels RPC, couche design v12 (cartes) |
| `js/screens/` | 14 fichiers (login, home, drawer, transfer-flow, receipt, history-cards, profile-settings, info, crypto-market, crypto-trade, crypto-receive-bank, register…) | écrans |
| `js/ui/`, `js/layout/` | `icons`, `receipt-export`, `uikit`, `sidebar`, `viewport` | composants, export reçu PNG/PDF, mise en page |
| `js/wire.js`, `js/boot.js` | | branchement des actions (monolithe de 78 Ko) et démarrage |
| `assets/` | marque, 4 cartes SVG, icônes PWA, illustrations, pictos | |

Modèle d'exécution : 38 scripts `defer` (dont supabase-js) dans **une seule portée globale**, ordre de chargement obligatoire (pas de modules ES). Toute nouvelle pièce doit être ajoutée à `index.html` et à la liste `SHELL` de `sw.js`, avec un nouveau nom de cache.

## 3. Écrans (table de routes `js/screens/register.js`)

Authentification : `login`, `signup`, `reset`. Accueil/navigation : `home`, `history`, `cards`, `profile`, `settings`, `notifications`, `services`.
Cartes : `cards`, `cards-add`, `card-settings`.
Transferts fiat : `country-select`, `service-select`, `identifier-input`, `tx-amount`, `tx-review`, `processing`, `receipt`.
Crypto : `crypto`, `crypto-market`, `crypto-networks`, `crypto-spot`, `crypto-buy*`, `crypto-sell*`, `crypto-swap*`, `crypto-send*`, `crypto-review`, `crypto-receive*`, `crypto-to-bank*`.
Autres : `contact-add`, `devices`, `sessions`, `privacy`, `help`, `about`, `banks`, `banks-add`.
**Il n'existe aucun écran d'administration** : les opérations admin n'existent que sous forme de fonctions SQL.

## 4. Moteurs et fonctions principales (côté navigateur)

| Moteur | Fichier | Rôle | Réalité |
|---|---|---|---|
| `UserContext`, `UserDataEngine`, `Runtime` | `engines.js` | contexte utilisateur, lecture/écriture Supabase limitée à l'utilisateur, état en mémoire | (1) |
| `PinEngine`, `AppLock` | `pin.js`, `app-lock.js` | saisie du code à 6 chiffres, délégué à `verify_pin` / `set_pin` | (1) |
| `TransferEngine` | `transfer-engine.js` | `transfer_fiat`, `fiat_send_external`, `find_user_by_yor_id` | (1)/(4) voir §8 |
| `CryptoBuyEngine` | `crypto-buy.js` | `crypto_buy/sell/swap/send_external/to_bank`, `get_receive_address` (appel générique `sb.rpc(fn, …)`) | (4) |
| `ExchangeEngine`, `FeeEngine`, `GasFeeEngine`, `AddressEngine` | `domain.js` | taux, frais, **frais réseau fixes**, validation/**génération d'adresses aléatoires** côté navigateur | (4) |
| `FXProvider`, `MarketDataProvider`, `CountryServiceProvider`, `PortfolioProvider` | `engines.js` | fines enveloppes autour des tables statiques ; point d'insertion prévu pour une vraie source | (3) |
| `V12` | `features/v12.js` | accueil, cartes (animations, gel, détails, création), thème | (1) pour l'interface ; (4) pour la donnée carte |
| `AuthEngine` | `features/auth.js` | session Supabase, hydratation du `Runtime` | (1) |

Appels RPC effectivement émis par l'app : `verify_pin`, `set_pin`, `pin_status`, `find_user_by_yor_id`, `transfer_fiat`, `fiat_send_external`, `my_transactions`, `get_receive_address`, et via `CryptoBuyEngine` : `crypto_buy`, `crypto_sell`, `crypto_swap`, `crypto_send_external`, `crypto_to_bank`.
Fonctions exposées mais **non appelées** par l'app : `admin_deposit`, `admin_deposit_crypto`, `admin_search_users`, `admin_user_overview`, `bank_send`, `transfer_crypto`, `change_pin`, `notify_security_event`, `mail_mark_read`.
Tables lues directement : `profiles`, `accounts`, `crypto_wallets`, `notifications`, `user_docs`, `user_items`.

## 5. Stockage côté navigateur

| Clé | Support | Contenu |
|---|---|---|
| `yor_device_id` | localStorage | identifiant d'appareil |
| `yor_device_lang`, `yor_lang_chosen` | localStorage | langue de l'appareil / choisie |
| `yor_onboarded` | localStorage | présentation déjà vue |
| `yor_layout_mode` | localStorage | mode d'affichage mobile/ordinateur |
| `yor_session_id` | sessionStorage | identifiant de session d'app |
| `yor.offers.dismissed` | sessionStorage | offres masquées pendant la session |
| jeton Supabase (`sb-…-auth-token`) | localStorage (géré par supabase-js, `persistSession: true`) | session d'authentification |
| `yor-shell-v12.1.0` | Cache Storage (service worker) | coque de l'app ; le service worker ne touche qu'aux requêtes GET de même origine, **jamais au trafic Supabase ni CDN** |

Aucune clé privée, phrase de récupération, PIN ni solde n'est stocké dans le navigateur (vérifié par recherche dans tout le code : seules ces clés existent).

## 6. Dépendances externes

| Dépendance | Usage | Remarque |
|---|---|---|
| `cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4` | client Supabase | **pas d'attribut `integrity` (SRI)** ; version épinglée |
| Supabase (Auth, Postgres, Edge Functions, Storage) | tout le back-end | clé `anon` publique dans `supabase-client.js` (normal) ; aucune clé `service_role` dans le code |
| Brevo | e-mails transactionnels via `send-email` | clé en secret de la fonction |
| Netlify | hébergement statique | site `yor-wallet` |

CSP (`_headers`) : `default-src 'self'`, scripts `self` + `'unsafe-inline'` + jsdelivr, connexions limitées à Supabase.

## 7. Base Supabase

### 7.1 Tables (`public`, RLS activée sur les 21)

| Table | Politiques | Droits `authenticated` | Rôle |
|---|---|---|---|
| `profiles` | select (soi ou admin), update (soi) | SELECT ; UPDATE limité aux colonnes `first_name, last_name, phone, country, photo` | profil, `role` (`user`/`admin` seulement), `status`, `kyc` (JSON, défaut `UNVERIFIED`) |
| `accounts` | select (soi ou admin) | SELECT | comptes fiat (OMR, XOF, USD, AED, SAR) — **registre interne** |
| `crypto_wallets` | select (soi ou admin) | SELECT | 8 lignes par utilisateur ; `address` générée en SQL |
| `transactions` | select (expéditeur, destinataire ou admin) | SELECT | statut par défaut **`CONFIRMED`** |
| `ledger_entries`, `tx_events`, `notifications`, `email_logs`, `yor_mail`, `audit_log` | lecture propriétaire (admin en plus sur `ledger_entries` et `email_logs` ; `audit_log` : admin seulement) ; `notifications` : update `read` + delete | SELECT (+ ciblé) | historique, journaux |
| `user_docs` | CRUD propriétaire | CRUD | `preferences`, `security` (JSON libre) |
| `user_items` | CRUD propriétaire | CRUD | collections `cards`, `bankAccounts`, `contacts`, `beneficiaries`, `devices`, `sessions`, `receipts` (JSON libre) |
| `fx_rates`, `market_prices`, `network_fees`, `asset_networks` | lecture pour tout connecté | SELECT | tables de référence **statiques** |
| `app_private`, `bank_jobs`, `idempotency_keys`, `pin_credentials`, `pin_grants` | aucune (refus total, voulu) | aucun | secrets, file de virements simulés, idempotence, PIN (hash bcrypt `crypt`, 5 échecs → blocage 15 min), jetons PIN à usage unique valables 2 min |

Aucune écriture directe n'est possible sur soldes, transactions, statuts ni rôle depuis le navigateur : confirmé par les droits de colonne (aucun UPDATE sur `role`, `status`, `kyc`, ni sur les tables d'argent).

### 7.2 Fonctions, déclencheurs, tâches

- 59 fonctions dans `public`, toutes avec `search_path` fixé **sauf** `demo_advance_jobs` (`public`). Les 23 fonctions exposées à `authenticated` sont des RPC volontaires ; sur les 10 relues en détail, toutes contrôlent `auth.uid()` (et `is_admin()` pour `admin_deposit`).
- Déclencheurs : `handle_new_user` (profil, 2 comptes, 8 portefeuilles, préférences), `trg_tx_email`, `trg_auth_emails`, `trg_email_logs_dispatch`, `trg_bank_job`, `_wallet_address_trigger`, `promote_owner_on_confirm`, `set_updated_at`.
- `pg_cron` : `yor-email-retry` (toutes les 5 min), `yor-demo-advance` (**chaque minute**, exécute `demo_advance_jobs`).
- Edge Function `send-email` (v2, `verify_jwt=false`) : protégée par un secret partagé stocké dans `app_private` ; expéditeur fixé `yordigitalefinance@gmail.com` ; trois langues ; ne traite que les transactions au statut `CONFIRMED/SUCCESS/COMPLETED`.
- **12.3.0 — messages au destinataire** : table `recipient_notices` (RLS sans politique : serveur seul), remplie par `enqueue_recipient_notices` depuis `trg_tx_email` ; Edge Function `send-notice` (`verify_jwt=true`, seul l'expéditeur de la transaction peut la déclencher). Pas de cron ni d'appel `pg_net` pour cette fonction. Détail et limites : `docs/NOTICES.md`.
- **0.8.8 — brouillon de jeton « contrôlé »** : `proposals/controlled-usdt/` (contrat ERC-20/TRC-20 avec plafond, pause, burn, permit, liste noire, récupération, propriété en deux temps, marque « YOR » obligatoire + 31 tests Foundry). **Jamais compilé ni exécuté** (aucun compilateur ni registre de paquets accessible) ; hors de `contracts/` pour ne pas toucher au CI. Le jeton déployé sur Nile n'est pas modifié. Détail : `proposals/controlled-usdt/README.md`.
- **0.9.2 — côté serveur seulement (application inchangée, 12.3.7)** : (1) migration `20261012b_crypto_send_external_instant_confirm.sql` : un envoi crypto externe est `CONFIRMED` dès la création (`meta.ledger_only = true` : écriture du registre YOR, sans diffusion on-chain) ; (2) `send-email` v9 : l'e-mail de l'expéditeur d'un `CRYPTO_SEND`/`CRYPTO_TRANSFER` affiche l'adresse de destination complète, le réseau et le mémo (fr/en/ar). Non-régression : HTML identique à la v8 sur 6 e-mails existants (dry-run, MD5). Pas de test rejouable dans le dépôt pour `send-email`. Détail : `docs/NOTICES.md`.
- **12.4.0 / 0.9.3 — refonte design premium (application seulement)** : nouvelle feuille `css/yor-ds.css` (système de design, chargée en dernier), accueil / cartes (`js/features/v12.js`) / historique / reçu / affiche PNG-PDF (`js/ui/receipt-export.js`) pilotés par le **statut réel** (`txState`, `js/core/helpers.js`). Cartes = aperçu non émis (aucun réseau, CVV, date ni « active » sans `issued === true` ; logo de réseau seulement avec un vrai réseau ET un vrai émetteur). Aucune migration, aucune fonction serveur modifiée. Tests : `tests/ui/redesign.test.mjs`. Détail : `docs/NOTICES.md`.
- **12.3.7 / 0.9.1 — envoi crypto vers n'importe quelle adresse** : `AddressEngine` (`js/core/domain.js`) accepte toute adresse que `_crypto_send_external_impl` accepte (15 à 128 caractères `[A-Za-z0-9:_.-]`) ; le format propre au réseau devient un avertissement (`strict:false`, `looksLike`). Nettoyage du texte collé (`AddressEngine.clean`, dupliqué dans `YorChain.cleanAddressInput` pour l'écran TronLink, accord vérifié par test). La confirmation affiche l'adresse complète. `CryptoBuyEngine` traduit les refus du serveur (`invalid_address`, `self_transfer`, `address_network_mismatch`, `unsupported_asset_network`, `invalid_amount`). Écran TronLink : lien d'explorateur et hexadécimal `41…` reconnus, adresse `0x…` refusée avec un message clair (jamais convertie). Aucun changement de base de données. En parallèle : `send-notice` v20 (SMS arabe au destinataire, voir NOTICES.md). Tests : `tests/ui/address-any.test.mjs` (7).
- **12.3.6 / 0.9.0 — e-mail des envois YOR-USDT** : Edge Function `chain-notice` (v2, `verify_jwt` actif) + table `chain_notices` (RLS sans politique). « sent » part sans attendre la chaîne ; « confirmed » seulement avec preuve on-chain relue par le serveur. Application : `js/features/chain-notice.js`, branché dans `chain-wallet.js`. Détail : `docs/NOTICES.md`.
- **12.3.4 — numéro de l'expéditeur chez le destinataire** : `send-notice` (v19) lit le numéro de la ligne SMS `SENDER` du même transfert (`fromPhone`) et l'écrit dans le SMS / l'e-mail du destinataire à la place du nom (repli sur le nom si aucun numéro). Reçu de l'application et export : ligne « De » (`receiptSenderPhone()`, réglage `confirmPhone` puis téléphone du profil). Détail : `docs/NOTICES.md`.
- **12.3.3 — envoi automatique et immédiat des SMS** : la base appelle `send-notice` (pg_net, jeton interne dans la table privée `notice_dispatch_cfg`) dès qu'un transfert externe ou interne est enregistré ; balayage `pg_cron` chaque minute (2 h) ; SMS tous en anglais, style notification bancaire (OMR pour Oman, FCFA pour Orange Money / Wave) ; l'expéditeur d'un transfert interne reçoit aussi sa confirmation. `send-notice` v16, migration `20261010_notice_auto_dispatch.sql`. Voir `docs/NOTICES.md`.
- **12.3.2 — confirmation à l'expéditeur** : audience `SENDER` dans `recipient_notices` (SMS vers le numéro saisi dans Réglages → `user_docs` « preferences » → `confirmPhone`, e-mail vers l'adresse du compte), texte et langue : arabe pour tout compte d'un pays arabophone (Orange Money → XOF + OMR ; Oman → OMR), sinon langue du service ; aucun message pour les envois crypto. `send-notice` v7.
- Storage : bucket public `avatars` (512 Ko max, jpeg/png/webp).
- Extensions installées : `pgcrypto` (hash du PIN), `pg_net` (appel de la fonction e-mail), `pg_cron`, `uuid-ossp`, `supabase_vault`, `pg_stat_statements`.

### 7.x Mise à jour 12.6.1 (e-mails, reçu)
Les e-mails (`send-email`, `send-notice`, `chain-notice`) sont émis au nom de NEX WALLET. Le reçu et l'e-mail de transaction n'affichent aucun solde (ni avant, ni après).

### 7.x Mise à jour 12.6.0 (inscription)
`public.handle_new_user()` (déclencheur `on_auth_user_created` sur `auth.users`) exige désormais `raw_user_meta_data.phone` au format `^\+[0-9]{8,15}$` et lève `P0001 / phone number required` sinon ; le client envoie `phone` et `country` (ISO‑2). Migration `20261013_signup_phone_required.sql`. Les comptes existants ne sont pas modifiés. Toute création d'utilisateur hors application (tableau de bord Supabase, `auth.admin.createUser`) doit désormais fournir ces métadonnées.

### 7.x Mise à jour 12.5.0 (SMS et solde)
- `recipient_notices` : colonnes `delivery_status` (PENDING / DELIVERED / UNDELIVERABLE / UNKNOWN / UNSUPPORTED), `delivery_checked_at`, `delivered_at`, `delivery_error` + index partiel `recipient_notices_delivery_pending_idx` (migration `20261012c_sms_delivery_balance.sql`).
- Fonctions : `_dispatch_sweep()` relit aussi les rapports de livraison ; `get_recipient_notice_status(p_tx)` renvoie `delivery` ; `get_tx_balance_after(p_tx)` renvoie `{amount, asset, at}` du dernier mouvement de registre **de l'appelant** pour la transaction (`authenticated` seulement).
- Edge Function `send-notice` v21 : modèle SMS structuré (`SMS_TEMPLATE`), solde du registre, suivi de livraison (`checkDelivery`).

## 8. Classification des fonctionnalités

| Fonctionnalité | Cat. | Constat |
|---|---|---|
| Inscription, connexion, récupération de mot de passe, confirmation d'e-mail | (1) | Supabase Auth |
| Profil, YOR ID, photo | (1) | |
| Code à 6 chiffres (création, vérification, verrouillage, jeton unique 2 min) | (1) | côté serveur, bcrypt |
| Verrouillage de l'app par code | (1) | |
| Interrupteur « biométrie » des réglages | (4) | simple booléen dans `user_docs` ; aucun appel WebAuthn dans le code |
| Transfert fiat entre utilisateurs YOR (par YOR ID) | (1) comme **registre interne** | atomique, idempotent, limites ; l'argent n'est pas adossé à un compte bancaire réel |
| Dépôt administrateur / soldes initiaux | (4) | crée de l'argent interne : 2 `ADMIN_DEPOSIT` + `OWNER_INITIAL_BALANCE` de 12 450,800 OMR et 8 500 000 XOF |
| Virement international (« FIAT_EXTERNAL ») | (4) | débite et passe directement en `CONFIRMED`, e-mail « Transaction réussie » ; aucun circuit de paiement (19 transactions) |
| Crypto : achat, vente, échange | (4) | contre des prix **statiques** ; registre interne |
| Crypto : réception (adresse) | (4) | adresses **tirées au hasard** (`_gen_address`), sans clé associée |
| Crypto : envoi vers une adresse YOR | (4) | transfert interne instantané, frais 0, `CONFIRMED` |
| Crypto : envoi vers une adresse externe | (5) | débit + frais fixe, statut `PENDING`, **rien n'est diffusé et rien ne le dénoue** |
| Crypto → banque, `bank_send` | (4) | file `bank_jobs` + pg_cron ; scénario par défaut « rejet puis remboursement » après 240–300 s |
| Taux de change et prix crypto | (4)/(3) | tables statiques (identiques dans le JS et en base, dernière mise à jour 4 oct. 2026, aucun flux) ; enveloppes `FXProvider`/`MarketDataProvider` prêtes à brancher |
| Frais réseau (gas) | (4) | table fixe ; `network_fees` en base |
| Cartes YOR (création, gel, plafonds, détails, animations) | (4) | numéro Luhn et CVV générés **dans le navigateur** ; statut `ACTIVE` sans émetteur ; le gel est un drapeau JSON |
| Reçus, export PNG/PDF | (1) pour le rendu ; (4) pour la donnée | reçus écrits par le client dans `user_items` |
| Notifications internes, boîte `yor_mail` | (1) | |
| E-mails de bienvenue / transaction / sécurité | (2) | Brevo ; 66 lignes `SENT` (8 bienvenue, 57 transactions, 1 sécurité). La réception réelle n'a pas été vérifiée par l'audit |
| Appareils, sessions | (1) pour l'affichage ; (4) pour la donnée | écrites par le client |
| KYC | (5) | colonne `kyc` toujours `UNVERIFIED`, aucun fournisseur |
| Blockchain TRON, contrat, indexeur, confirmations, expiration | (5) | **inexistants** |
| Émission de vraies cartes, webhooks émetteur, 3DS | (5) | inexistants |
| Mobile money / banques / pays de destination | (5) | listes statiques (`BANKS`, `COUNTRY_TRANSFER_CONFIG`) |
| Administration | (4) | uniquement via SQL, aucun écran, aucun `super_admin` |

## 9. Problèmes et risques constatés

Gravité : **C** critique (contredit une règle absolue du prompt V2 ou peut faire perdre des fonds réels à un utilisateur), **É** élevé, **M** moyen, **F** faible, **I** information.

| # | Gr. | Constat | Preuve |
|---|---|---|---|
| R-01 | C | Les « adresses de dépôt » crypto sont des chaînes aléatoires, sans clé privée derrière. Si un utilisateur y envoie de vrais fonds depuis l'extérieur, ils sont perdus. Le code les présente comme des adresses réelles. | `_gen_address()` (SQL) ; commentaire de `receiveAddress()` ; 104 lignes `crypto_wallets` |
| R-02 | C | `crypto_send_external` vers une adresse inconnue débite le montant + frais et laisse la transaction `PENDING` pour toujours : rien n'est diffusé, aucun processus ne la résout. | `_crypto_send_external_impl` ; aucun déclencheur ni tâche ne traite `CRYPTO_SEND` ; 0 cas en production à ce jour |
| R-03 | C | Les virements internationaux sont marqués `CONFIRMED` immédiatement et déclenchent « Transaction réussie » alors qu'aucun paiement n'existe. | `_fiat_send_external_impl` ; 19 transactions ; `send-email` |
| R-04 | C | Cartes : numéro et CVV (aléatoires, `Math.random`) créés dans le navigateur et stockés en clair dans `user_items` ; statut `ACTIVE` sans carte émise ; gel = drapeau JSON. | `v12.js:259`, `wire.js:1160`, `helpers.js:24` ; 13 cartes sur 13 avec `number` + `cvv`, toutes `ACTIVE` |
| R-05 | É | Les soldes sont des nombres d'un registre interne, créés par l'administrateur ; aucun adossement. | `admin_deposit*`, audit `OWNER_INITIAL_BALANCE` |
| R-06 | É | Prix et taux sont statiques et dupliqués (JS + base) ; aucune mise à jour automatique ; l'écart avec le marché réel est inconnu. | `CRYPTO_PRICES_SEED`, `FX_RATES`, `market_prices` (même valeurs) |
| R-07 | É | Le résultat d'un virement bancaire est simulé par pg_cron ; un utilisateur peut basculer son propre scénario en « succès » en écrivant `user_docs.preferences.demoScenario` (autorisé par la RLS) et obtenir un faux « Terminé ». | `trg_bank_job`, `demo_advance_jobs` |
| R-08 | É | Promotion administrateur par adresse e-mail codée en dur dans un déclencheur ; pas de rôle `super_admin` (CHECK = `user`,`admin`). Le compte admin actuel n'a ni l'adresse `yordigitalefinance@gmail.com` ni celle du compte Claude ; l'adresse codée en dur n'a aucun compte. À confirmer par le propriétaire. | `promote_owner_on_confirm`, `profiles_role_check` |
| R-09 | M | Reçus, appareils, sessions, contacts, bénéficiaires sont écrits par le client : un reçu peut être falsifié par son propriétaire. | `user_items`, `recordLocalReceipt` |
| R-10 | M | `supabase-js` chargé depuis un CDN sans SRI ; CSP avec `'unsafe-inline'`. Pour un portefeuille, un script tiers compromis verrait la session. | `index.html`, `_headers` |
| R-11 | M | Protection contre les mots de passe compromis désactivée dans Supabase Auth. | advisor sécurité |
| R-12 | M | 23 RPC `SECURITY DEFINER` exposées. Contrôles relus et corrects sur 10 d'entre elles ; les 13 autres (dont `admin_deposit_crypto`, `admin_search_users`, `admin_user_overview`, `crypto_sell`, `crypto_swap`, `crypto_to_bank`, `transfer_*`, `change_pin`, `notify_security_event`, `mail_mark_read`, `find_user_by_yor_id`, `pin_status`) restent à relire et à tester en phase 3. | advisor + lecture du code SQL |
| R-13 | F | `demo_advance_jobs` a un `search_path` mutable ; nommage « demo » dans le code SQL. | advisor |
| R-14 | F | 5 clés étrangères sans index ; `ARCHITECTURE.md` périmé (11.3.0, cite un `js/dev/` inexistant) ; fichiers Vercel restés dans l'archive. | advisor, inspection |
| R-15 | I | Aucun code blockchain : tout ce qui touche TRON, jeton, contrat, indexeur, expiration est à construire. | recherche dans le code |

Points solides à préserver : toute écriture d'argent passe par des RPC atomiques avec clé d'idempotence et jeton PIN à usage unique ; aucune clé de service dans le front ; RLS partout ; aucune écriture directe de solde ; e-mails protégés par secret partagé ; expéditeur e-mail fixé côté serveur.

## 10. Risques de régression pour la migration

1. **Portée globale unique** : renommer ou déplacer une fonction casse silencieusement un autre fichier. Migration progressive uniquement (« étrangler » l'ancien code), jamais de réécriture d'un bloc.
2. **`wire.js` (78 Ko)** concentre les actions de tous les écrans : à découper écran par écran, avec un test de fumée par écran avant et après.
3. **Statuts de transaction** : `CONFIRMED`/`SUCCESS`/`COMPLETED` sont codés en dur dans `trg_tx_email`, `tx_set_status` (liste blanche), la contrainte `transactions_kind_check`, `send-email` et la table de correspondance du front (`CONFIRMED → SUCCESS`). Introduire les états du prompt (`draft`, `pending_signature`, `broadcasted`, `confirming`, `confirmed`, `failed`, `expired`, `cancelled`) impose de modifier ces cinq endroits ensemble.
4. **Base en production avec 13 vrais comptes** : toute migration RLS/RPC doit être testée sur une branche Supabase avant production ; uniquement des migrations additives (nouvelles tables, nouvelles colonnes) tant que l'ancien code lit les anciennes.
5. **Cache du service worker** : chaque fichier nouveau doit être listé dans `SHELL` ; sinon l'app hors ligne casse après la mise à jour.
6. **Collision de noms** : le portefeuille interne `USDT / tron` existe déjà (104 lignes de portefeuilles) ; le futur jeton expérimental ne doit réutiliser ni cet actif ni ces lignes.
7. **E-mails** : tout changement du moment où une transaction devient « réussie » change le moment où part l'e-mail « Transaction réussie ».
8. **Cartes existantes** : 13 cartes avec PAN/CVV en clair doivent être migrées (suppression des champs sensibles après remplacement), pas supprimées avant validation.

## 11. Ce qui n'a pas pu être vérifié (NOT EXECUTED)

- Toute interaction avec un réseau TRON (aucun accès réseau, aucune clé).
- La réception effective des e-mails Brevo (seul le statut `SENT` en base est observé).
- Le comportement des 13 RPC exposées dont le code n'a pas été relu (liste en R-12).
- Les tests de pénétration RLS avec plusieurs comptes (prévus en phase 3/13).
- (12.3.0 / 12.3.2) Aucun message n'a encore été envoyé par la fonction `send-notice` avec la clé Infobip (essais d'envoi faits seulement via le connecteur Infobip de Claude) ; la remise sur le téléphone n'est pas suivie ; aucun profil n'a de numéro dans `profiles.phone`. Voir `docs/NOTICES.md`.
