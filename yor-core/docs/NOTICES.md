# Messages d'un transfert : bénéficiaire (12.3.0), confirmation de débit à l'expéditeur (12.3.2), envoi automatique et SMS bancaires en anglais (12.3.3), SMS structurés et suivi de livraison (12.5.0)

## 12.13.0 — Alertes sur le téléphone (notifications push) (17 octobre 2026)

Distinct des SMS et des e-mails ci-dessous : une notification push s'affiche sur l'écran verrouillé de l'iPhone / Android, application fermée. Elle ne remplace ni le SMS ni l'e-mail.

**Fonction publiée** : `push-send` v2 (`index.ts` + `lib.ts`, `verify_jwt` actif), relue après publication : identique au dépôt. Migration `supabase/migrations/20261018_web_push.sql` (appliquée en trois morceaux : `web_push_tables`, `web_push_cfg`, `web_push_trigger`).

- **Quand** : une ligne `TRANSFER_SENT`, `TRANSFER_RECEIVED` ou `DEPOSIT` est écrite dans `public.notifications` et la personne a au moins un appareil abonné. Le réglage « Notifications » de l'application (`preferences.notifications === false`) coupe l'envoi. Une alerte au plus par notification (`push_sent`).
- **Texte** (langue de l'application ; aucune marque, aucun nom de banque) : « Money sent — 20.000 OMR sent to +968 ••••4567 » / « Transfert envoyé — 20.000 OMR envoyés au +968 ••••4567 » / arabe (montant à 3 décimales pour le rial omanais, tel que lu dans la base). Le numéro est masqué sur l'écran verrouillé ; l'expéditeur d'un dépôt n'est jamais affiché.
- **Sécurité** : clé VAPID créée par la fonction, stockée dans `push_vapid` (jamais exposée, ne pas régénérer : tous les abonnements deviendraient invalides) ; `push_subscriptions` contient des secrets de chiffrement (aucun accès public) ; adresse de livraison acceptée seulement vers `*.push.apple.com`, `fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.notify.windows.com` (https, sans port ni identifiants) ; contact VAPID = `https://yor-wallet.netlify.app` (aucune adresse e-mail personnelle envoyée).
- **Limites** : iPhone iOS 16.4+, application ajoutée à l'écran d'accueil, autorisation demandée par un toucher. **Non exécuté : aucune livraison réelle via Apple (APNs) n'a été constatée sur un vrai iPhone.**

## 12.12.0 — Messages corrigés, aucun frais, nom d'expéditeur « FriendlyPay » (17 octobre 2026) — prime sur tout ce qui suit pour le texte, l'heure, les frais et le nom d'expéditeur

**Fonction publiée** : `send-notice` v26 (`index.ts` + `lib.ts`), relue après publication : les deux fichiers déployés sont **identiques octet pour octet** à ceux du dépôt (22 235 et 56 024 caractères). Plus aucune séquence `\u…` dans `lib.ts` (remplacées par `String.fromCharCode`), donc le texte publié est exactement celui du dépôt. `send-email` v11 et `chain-notice` v4 inchangées.

- **SMS à l'EXPÉDITEUR** (anglais ; arabe si sa langue est l'arabe) :
  `Dear Customer,` / `Your transfer of OMR 20.000 to Aisha Said (+968 9123 4567) was successful.` / `Available Balance: OMR 1,229.500` / `Reference: FRD-TX-20261012-69AAAA` / `Date & Time: 17 Oct 2026, 20:23`.
  Le bénéficiaire n'est écrit qu'**une fois** (avant : phrase d'ouverture **et** ligne « Recipient »). Les lignes `Fees (incl. VAT)` et `Total debited` n'apparaissent **que si la transaction porte réellement des frais** (total − montant > 0, valeurs lues, jamais calculées pour le message) : les transferts faits depuis le 17 octobre n'en ont pas, les anciens gardent les leurs.
- **SMS au DESTINATAIRE** : `A transfer of OMR 20.000 from +968 9123 4567 has been confirmed.` / `To: +968 …` / `Reference: TX-20261012-69AAAA` / `Date & Time: …`. L'expéditeur n'est écrit qu'une fois ; aucune marque, aucun « YOR », aucun « FRD », aucun nom de banque ; jamais « received » pour un envoi externe ; pas de solde (le destinataire externe n'a pas de compte). Transfert **interne** entre deux comptes : « You have received OMR … » + son solde (lu dans le registre).
- **Heure locale** : Oman, Émirats = UTC+4 ; Arabie saoudite, Koweït, Qatar, Bahreïn = UTC+3 (décalages fixes, pas d'heure d'été). Expéditeur → heure de son pays ; destinataire → heure du sien. Format « 17 Oct 2026, 20:23 » (anglais) / « 17/10/2026 20:23 » (arabe), **sans secondes**. Pays absent ou inconnu → l'heure reste en UTC et le SMS écrit « UTC » (rien n'est supposé).
- **Formats** : montant « OMR 20.000 » (devise d'abord, 3 décimales) ; numéro d'Oman « +968 9123 4567 » ; numéro masqué « ***1234 » inchangé.
- **Nom d'expéditeur du SMS** : **« FriendlyPay »** (11 caractères). Cause du nom « ServiceSMS » vu sur le téléphone : tant que le secret `SMS_SENDER` n'était pas défini, la fonction envoyait à Infobip le nom par défaut « ServiceSMS » (expéditeur d'essai d'Infobip). Maintenant `sender: smsSenderName(SMS_SENDER)` est envoyé dans la requête Infobip ; une valeur de secret égale à un ancien nom (`ServiceSMS`, `YORWALLET`, `YOR`, `NEX`, `NEXWALLET`) est **ignorée** et remplacée par « FriendlyPay ». Autre valeur valide (lettres/chiffres, 11 max) : utilisée telle quelle.
- **Frais** : plus aucun frais sur les transferts (migration `20261017_no_transfer_fee.sql`, appliquée en production : frais 0, TVA 0, total = montant).
- **Tests** : `tests/edge/sms-notification-lib.test.mjs` (+6 : sans frais, frais historiques affichés, pas de doublon, heure locale, format du numéro, destinataire sans marque), `tests/edge/send-notice-lib.test.mjs`, `tests/edge-sim/send-notice.test.mjs`, `tests/edge-sim/sms-templates-config.test.mjs` : `npm test` (edge 128), `npm run test:sim` (85).
- **NOT EXECUTED / à savoir** :
  - aucun SMS réel envoyé avec ces textes (ni vers l'expéditeur ni vers un destinataire) ;
  - **l'enregistrement du nom « FriendlyPay » auprès d'Infobip et des opérateurs d'Oman n'est pas vérifié** : un nom non enregistré peut être remplacé par l'opérateur ou le SMS refusé (la fonction classe ce refus en « provider_config » et garde le message en file) ;
  - le secret `SMS_SENDER` n'a pas été lu ni modifié ;
  - les fonctions bancaires et crypto de la base ne sont pas modifiées (masquées dans l'application).

## 12.9.1 — E-mails et SMS au nom de Friendly Pay (16 octobre 2026) — prime sur le reste pour les noms et références affichés

**Fonctions publiées** : `send-email` v11, `send-notice` v25, `chain-notice` v4 (contrôlées contre le code du dépôt ; seules différences : 3 séquences d'échappement `\u…` écrites en caractères littéraux dans deux regex et une constante, sens identique, et une ligne vide finale).

- **Nom** : expéditeur « Friendly Pay » ; en-tête vert `#0B7F75` « Friendly » + « Pay » ; textes « Friendly Pay est un service de Friendly. » ; libellé « Friendly ID ». Le secret `NOTICE_FROM_NAME`, s'il contient encore « YOR » / « NEX » (+ « WALLET »), est corrigé en « Friendly Pay » dans `send-notice` et `chain-notice`.
- **Références** : la base garde `YOR-XXXXXX` et `YOR-TX-…` (contrainte `profiles_yor_id_check`). Les e-mails et le SMS de confirmation à l'EXPÉDITEUR affichent `FRD-…` (`dispId` / `dispRef`, remplacement de `YOR-` en tête seulement).
- **SMS au BÉNÉFICIAIRE** : inchangé — jamais « YOR », jamais de nom de marque ; la référence s'affiche `TX-…` (`recipientRef`).
- **Jeton** : le texte « YOR Experimental USDT » / `YOR-USDT` des e-mails crypto est inchangé (nom du jeton sur la chaîne ; ce n'est pas Tether).
- **Pas modifié, à décider** : adresse d'envoi et de réponse `yordigitalefinance@gmail.com` (seul expéditeur vérifié chez Brevo ; en changer demande de créer et vérifier un expéditeur Friendly chez Brevo) ; nom d'expéditeur SMS de repli `YORWALLET` et secret `SMS_SENDER` (un nom d'expéditeur doit être enregistré chez le fournisseur, pays par pays).
- **Tests** : `npm test` (modèle, TRON, edge, web) et `npm run test:sim` ; nouveau `tests/edge-sim/send-email.test.mjs` (12 tests).
- **NOT EXECUTED** : aucun vrai e-mail ni SMS envoyé avec ce nouveau texte (test à blanc de `send-email` seulement, via la base).
- **Incident de publication** : `send-notice` v23 et v24 ont été publiés incomplets par erreur (fichier `lib.ts` tronqué) ; v25 est complète. Aucune notification n'a été mise en file pendant cette période (`recipient_notices` : 0 ligne sur les 6 heures précédentes).

## 12.5.0 — SMS structurés AR/EN, solde, suivi de livraison (12 octobre 2026) — prime sur 12.3.3 pour le texte et la langue des SMS

**Texte.** Modèle par défaut `structured` (secret `SMS_TEMPLATE`, `compact` = anciens SMS d'une ligne, retour arrière sans redéploiement). Exemple, expéditeur, anglais :

```
Dear Customer,

Your transfer of 20.000 OMR to Aisha Said (+96891234567) was successful.

Reference: YOR-TX-20261012-69AAAA
Date & Time: 12 Oct 2026 07:08 UTC
Recipient: Aisha Said (+96891234567)
Available Balance: 1,229.500 OMR
```
Équivalent arabe : « عزيزي العميل، … تم تحويل مبلغ … إلى … بنجاح. رقم المرجع / التاريخ والوقت / المستفيد / الرصيد المتاح ». Un transfert vers un service d'Afrique de l'Ouest ajoute `Service:` et `Amount to receive: approx. 14,500 FCFA` (le code XOF s'écrit FCFA ; OMR et FCFA ne sont jamais mélangés dans un même montant). Le bénéficiaire **externe** reçoit « … has been confirmed » (jamais « received », jamais de solde, référence sans `YOR-`) ; le bénéficiaire **interne** reçoit « You have received … » avec **son** solde.

**Langue.** Expéditeur : arabe seulement si la langue choisie dans l'application est l'arabe, sinon anglais (la règle « tout en anglais » de 12.3.3 ne vaut plus pour le texte structuré). Le SMS arabe est en Unicode (plus de segments), l'anglais reste en GSM-7 (≤ 2 segments).

**Solde.** Lu au registre (`ledger_entries.balance_after`, dernière écriture de la personne pour la transaction), affiché seulement sur une issue confirmée, si le montant est un nombre ≥ 0 et la devise un code à 3 lettres. Jamais calculé, jamais estimé. Les **frais** ne sont pas dans le SMS (ils sont sur le reçu).

**Issues.** Le constructeur sait écrire « réussi », « non abouti » et « en cours » ; seul « réussi » est envoyé aujourd'hui (tous les transferts de l'application sont confirmés). Une issue incompatible avec le statut réel de la transaction n'est pas envoyée.

**Livraison.** `recipient_notices.delivery_status` : `PENDING` (accepté, rapport attendu), `DELIVERED`, `UNDELIVERABLE`, `UNKNOWN` (pas de rapport après 24 h ou erreur de lecture), `UNSUPPORTED` (Brevo, ou pas d'identifiant de message). `NULL` = e-mail ou ligne antérieure à la migration `20261012c`. Le balayage de la minute (`_dispatch_sweep`) relance la lecture (≥ 90 s entre deux lectures, 24 h au plus) ; Infobip : `GET /sms/1/logs?messageId=…`, Twilio : `GET …/Messages/{sid}.json`. Le reçu lit `get_recipient_notice_status` (champ `delivery`) et `get_tx_balance_after`.

**Constat du 12 octobre 2026.** Infobip accepte l'envoi (`PENDING_ACCEPTED`) puis **rejette quelques millisecondes plus tard** : `REJECTED_NOT_ENOUGH_CREDITS`. Le transfert YOR-TX-20261012-9E1F0E (10 OMR, CONFIRMED) et un SMS de test n'ont donc **pas** été remis. Ce rejet n'apparaît pas dans la réponse d'envoi : seul le rapport de livraison le montre, d'où le suivi ci-dessus (pour les lignes envoyées par la v21 et après). Les 2 SMS de ce transfert ont été remis en file une fois (15:51 UTC) et refusés de nouveau pour la même raison. **Action externe requise : recharger le compte Infobip.**

**Vérifié en réel (12 octobre 2026, 15:53 UTC)** : le balayage a lu le journal Infobip et passé les 2 SMS refusés en `UNDELIVERABLE` avec `delivery_error = REJECTED_NOT_ENOUGH_CREDITS` ; le reçu affiche alors « Not delivered · no SMS credit on the provider account yet » (migration `20261012d`).

**NOT EXECUTED.** Aucun SMS remis à un téléphone par ce système (le cas `DELIVERED` n'a jamais été observé) ; Twilio jamais appelé ; SMS « échec » / « en cours » jamais envoyés ; pas de type-check Deno.

## 12.3.3 — ce qui prime sur le reste de ce document (10 octobre 2026)

**Envoi automatique et immédiat.** Dès qu'un transfert (externe `FIAT_EXTERNAL` ou interne `FIAT_TRANSFER`) est enregistré, la base met les messages en file puis **appelle elle-même** `send-notice` (`_dispatch_notices` → `net.http_post`, la requête part au commit). Aucun bouton, aucune validation. Authentification de cet appel : un jeton aléatoire stocké dans la table privée `notice_dispatch_cfg` (RLS sans politique, aucun droit pour `anon` / `authenticated`), envoyé dans l'en-tête `x-notice-token` et comparé à durée constante ; la plateforme exige en plus un JWT valide (clé publique `anon`). Un balayage `pg_cron` (`notice-sweep`, chaque minute) relance les messages `PENDING` / `FAILED` des **2 dernières heures** ; au-delà ils expirent à 24 h. L'application garde son appel de secours (`TransferEngine.flushNotices`, immédiat, un second essai 3 s plus tard) : un doublon est sans effet, `claim_recipient_notices` réclame chaque ligne une seule fois (`for update skip locked`).

**Les deux SMS.** Un transfert externe produit un SMS à l'**expéditeur** (`SENDER`) et un SMS au **bénéficiaire** (`EXTERNAL`) ; un transfert **interne** produit désormais aussi la confirmation de l'expéditeur, en plus du SMS au destinataire (`INTERNAL`).

**Langue et style : tous les SMS sont en anglais** (constante `SMS_LANG`), style notification bancaire (Bank Muscat). Les gabarits français et arabe restent dans le code (e-mails, retour en arrière). Les **e-mails** gardent les règles de langue et le texte « en cours de traitement » pour l'expéditeur.

| Cas | Texte (produit par le code) |
|---|---|
| Oman, expéditeur | `Debit Alert: OMR 151.050 debited from your account (transfer OMR 150.000 + fees OMR 1.050) for a transfer to +96875235685. Ref YOR-TX-20261010-4E753B. 10 Oct 2026 16:02 UTC. Status: Confirmed.` |
| Oman, destinataire | `Transfer Confirmed: OMR 150.000 from +96877986533. Ref TX-20261010-4E753B. 10 Oct 2026 16:02 UTC.` |
| Wave / Orange Money, expéditeur | `Debit Alert: OMR 151.050 debited from your account (transfer OMR 150.000 + fees OMR 1.050) for a transfer of approx. FCFA 233,100 via Wave to +2250544469457. Ref YOR-TX-… . 10 Oct 2026 16:02 UTC. Status: Confirmed.` |
| Wave / Orange Money, destinataire | `Wave Transfer Confirmed: approx. FCFA 233,100 (OMR 150.000) from +96877986533. Ref TX-… . 10 Oct 2026 16:02 UTC.` |
| Transfert interne, destinataire | `Transfer Confirmed: You received OMR 20.000 from +96877986533. Ref TX-… . 10 Oct 2026 13:50 UTC.` |

Règles : chaque SMS porte montant, devise, référence, date **et heure** (UTC) ; jamais « Test » ni « en cours / processing / pending » ; le franc CFA (code XOF) s'écrit **FCFA** ; le service n'est nommé que s'il est reconnu (Wave, Orange Money, MTN MoMo, Moov Money, Vodafone Cash, Bankak) ; le SMS au destinataire reste neutre (ni frais, ni marque, pas de « YOR » dans la référence) ; « received » n'est écrit que pour un transfert **interne** (argent réellement arrivé), jamais pour un transfert externe.

**Clé Infobip.** La fonction retire espaces, retours à la ligne et marques de direction invisibles (copier-coller depuis un téléphone) de `INFOBIP_API_KEY` / `INFOBIP_BASE_URL`. Si ce qui reste n'a pas la forme d'une clé (lettres, chiffres, `. _ : -`, 16 caractères au moins), le message **reste en file** (`PENDING`, nouvel essai dans 5 min, aucune tentative brûlée) avec l'erreur `INFOBIP_API_KEY is not a valid key`. Constat du 10 octobre 2026 : le secret contenait d'abord le texte d'un exemple `curl …`, puis un texte encore invalide.

**Non exécuté (12.3.3).** Aucun SMS n'est encore parti par la fonction avec la clé Infobip (secret invalide, voir ci-dessus). Vérifié : le déclenchement base → fonction (la fonction est appelée, réclame les lignes, incrémente `attempts`), le contenu des SMS (tests), les droits (`anon` / `authenticated` n'ont aucun accès à `notice_dispatch_cfg` ni à `_dispatch_notices`). Limites de débit inchangées (5 SMS / numéro destinataire / 24 h, 20 / expéditeur / 24 h, 10 confirmations / numéro expéditeur / 24 h) : en test intensif, un message peut passer en `SKIPPED` (`rate_limited_*`).

**Limites et pays SMS réglables (0.8.6, 11 octobre 2026).** Les limites de débit ne sont plus écrites en dur : elles vivent dans la table privée `notice_dispatch_cfg` (une ligne). Valeurs actuelles : **30** SMS par numéro destinataire / 24 h (`limit_recipient_24h`), **100** par expéditeur / 24 h (`limit_sender_24h`), **100** confirmations par numéro d'expéditeur / 24 h (`limit_confirm_24h`) ; avant : 5 / 20 / 10. Pays SMS (`sms_countries`) : OM, AE, ML, CI, BF **+ SA, GN, EG** ; les États-Unis restent exclus (enregistrement des expéditeurs exigé par les opérateurs). Pour changer : `update public.notice_dispatch_cfg set limit_recipient_24h = 50;` (valeurs de 1 à 10000) ou `set sms_countries = array['OM','AE', …];`. Le changement vaut pour les prochains transferts ; les messages déjà passés en `SKIPPED` ne repartent pas tout seuls. Une limite reste un garde-fou contre le coût et les abus, elle n'est pas supprimée. **Non vérifié** : le solde Infobip (non lisible d'ici) et l'acceptation d'un expéditeur « ServiceSMS » par les opérateurs d'Arabie saoudite, de Guinée et d'Égypte (un refus d'expéditeur garde le message en file, voir plus haut).

**Le numéro de l'expéditeur s'affiche chez le destinataire (0.8.7, 12 octobre 2026).** Dans le SMS (et la ligne « expéditeur » de l'e-mail) du destinataire, le nom « Prénom I. » est remplacé par le **numéro de téléphone de l'expéditeur**, en format international (`+968…`). Source : la ligne SMS `SENDER` du même transfert (`recipient_notices.to_phone`), c'est-à-dire le numéro réglé dans Réglages → « Numéro pour les confirmations SMS » ; à défaut, le téléphone du profil (c'est déjà la règle de la confirmation de débit). Aucun numéro exploitable (8 à 15 chiffres) : le message retombe sur le nom, il n'est jamais inventé. Le SMS de l'expéditeur ne change pas. Ce que le téléphone du destinataire affiche comme **expéditeur du SMS** reste le nom de l'expéditeur Infobip (« ServiceSMS ») : un numéro ou un nom propre exige un enregistrement auprès des opérateurs, **non fait**. Vérifié : tests (`send-notice-lib.test.mjs`, 56 cas) et code déployé identique au code local (`send-notice` v19). **Non exécuté** : aucun nouveau transfert réel n'a encore été fait avec cette version.

> Les sections suivantes décrivent les versions 12.3.0 à 12.3.2 ; là où elles parlent de SMS en français ou en arabe, de « en cours de traitement » dans un SMS, ou d'un envoi déclenché seulement par l'application, c'est la section 12.3.3 ci-dessus qui fait foi.

Un transfert externe produit **deux messages distincts** :

1. **Au bénéficiaire** : un message neutre (montant, expéditeur « Prénom I. », référence, date, statut). Pas de YOR ID, pas le nom de la marque dans le texte, **pas de frais**.
2. **À l'expéditeur** (nouveau en 12.3.2) : la **confirmation du débit** par SMS et par e-mail, avec le détail (montant débité, envoi + frais, montant estimé à verser, service, référence). Elle s'adapte au **service choisi**.

Les achats / ventes / échanges **crypto** n'envoient **aucun** message. Les **envois YOR-USDT** (testnet Nile, TronLink) envoient un **e-mail à l'expéditeur** (pas de SMS) : voir la section « E-mail des envois YOR-USDT (12.3.6) » en bas de ce document.
Ce document dit ce qui existe, comment ça marche, et surtout **ce qui n'a pas été exécuté pour de vrai**.

## Ce que dit chaque message

| Qui | Cas | Texte (exemple réel produit par le code, SMS) |
|---|---|---|
| **Expéditeur** (compte à Oman ou autre pays arabophone) | Orange Money (Mali, Côte d'Ivoire, Burkina) → **arabe** depuis le 10 octobre 2026, montant en XOF + débit en OMR | `تأكيد التحويل: تم خصم 1.105 OMR من حسابك (المبلغ 1.000 OMR + الرسوم 0.105 OMR). المبلغ التقديري للصرف: 1,980 XOF عبر Orange Money (+22370123456). المرجع TXN-REAL01. 09/10/2026 13:50 UTC. الحالة: قيد المعالجة.` (4 segments SMS ; le groupe « (+22370123456) » est isolé en gauche-à-droite par des marques invisibles U+202A/U+202C, voir plus bas) |
| **Expéditeur** (compte hors pays arabophone) | Orange Money (Mali, Côte d'Ivoire, Burkina) → **français** | `Confirmation de transfert : 1,105 OMR debites de votre compte (envoi 1,000 OMR + frais 0,105 OMR). Montant estime a verser : 1 980 XOF via Orange Money (+22370123456). Ref. TXN-REAL01. 09/10/2026 13:50 UTC. Statut : en cours de traitement.` |
| **Expéditeur** (compte à Oman) | Service d'Oman (téléphone, banque…) → **arabe**, tout en OMR | `تأكيد التحويل: تم خصم 1.105 OMR من حسابك (المبلغ 1.000 OMR + الرسوم 0.105 OMR). الخدمة: Bank Muscat (***9988). المرجع TXN-REAL01. 09/10/2026 13:50 UTC. الحالة: قيد المعالجة.` |
| **Expéditeur** | Autre pays, langue inconnue → langue de la personne (anglais par défaut) | `Transfer confirmation: 1.105 OMR debited from your account (sent 1.000 OMR + fees 0.105 OMR). Estimated amount to pay out: 1,980 XOF via Orange Money (+22370123456). Ref TXN-REAL01. 09/10/2026 13:50 UTC. Status: processing.` |
| Bénéficiaire | Transfert externe, français | `Transfert confirme : 20,000 OMR (env. 22 451 XOF) de Sajad A. Ref. TXN-REAL01. 09/10/2026 13:50 UTC.` |
| Bénéficiaire | Transfert externe, arabe | `تحويل بمبلغ 20.000 OMR (حوالي 22,451 XOF) من Sajad A. المرجع TXN-REAL01. 09/10/2026 13:50 UTC. الحالة: قيد المعالجة.` |
| Bénéficiaire | Transfert entre deux comptes de l'application | `Vous avez recu 20,000 OMR de Sajad A. Ref. TXN-REAL01. 09/10/2026 13:50 UTC.` |

- **Message au bénéficiaire d'un transfert externe : « confirmé », jamais « reçu »** (décidé le 10 octobre 2026 : quand l'argent est sorti du compte de l'expéditeur, le transfert est confirmé). Le SMS dit « Transfert confirmé : montant … de [Prénom I.]. Réf. … date. » et l'e-mail « Le transfert est confirmé : le montant a été débité du compte de l'expéditeur » (statut « Confirmé »). Il ne dit pas « vous avez reçu l'argent » : aucun circuit de paiement réel vers Orange Money (ni vers une banque, ni vers un service d'Oman) n'existe et l'application ne peut pas vérifier que la personne a le montant en main. **La confirmation envoyée à l'expéditeur garde « en cours de traitement »** (le versement n'est pas suivi). « Reçu » n'est employé que pour un transfert interne entre deux comptes de l'application.
- « Reçu » n'est utilisé que pour un transfert interne (l'argent est réellement arrivé sur le compte).
- **Confirmation à l'expéditeur** : toutes les valeurs sont lues dans la transaction (`total`, `meta.provider`, `meta.destinationAmount`, `meta.rate`). Les frais sont `total − montant` (frais + TVA) et ne s'affichent que si le total est connu et supérieur au montant : rien n'est inventé. Le nom du service est nettoyé (lettres, chiffres, espaces, apostrophes, tirets ; 24 caractères). **Numéro du bénéficiaire (décidé le 10 octobre 2026)** : pour un service par téléphone (Orange Money, Wave, services d'Oman — identifiants `MOBILE_MONEY` et `PHONE`), la confirmation à l'expéditeur affiche le **numéro international complet** (`+22370123456`), celui que l'expéditeur a lui-même saisi, déjà normalisé par la base (ligne `EXTERNAL` de la même transaction) ; à défaut la saisie si elle commence par `+`. Pour un **IBAN, un compte bancaire ou un identifiant de service**, le numéro reste **masqué** (`***9988`) : un numéro de compte ne circule pas en clair par SMS (changeable sur demande). Si rien de sûr n'est connu, le message omet le numéro. En arabe, le groupe `(+968…)` est entouré de U+202A…U+202C : sans cela le signe « + » passe de l'autre côté du numéro (vérifié au rendu Chromium ; l'affichage sur un vrai téléphone n'a **pas** été vérifié). Le nombre de segments ne change pas (4 pour Orange Money, 3 pour Oman). Le **message au bénéficiaire** est inchangé : montant, montant estimé, expéditeur, référence, date, « en cours de traitement » ; ni frais, ni total débité, ni nom de marque, ni le numéro (c'est le sien). **Sans « YOR » (décidé le 10 octobre 2026, `send-notice` v9)** : dans ce SMS, la référence `YOR-TX-20261010-F627B7` s'écrit `TX-20261010-F627B7` (fonction `recipientRef`, EXTERNAL et INTERNAL, FR/EN/AR). La confirmation envoyée à l'expéditeur et l'e-mail gardent la référence complète.
- **Conversion** : la ligne « montant estimé à verser » (XOF) n'apparaît que si la devise de destination diffère de la devise envoyée (Orange Money : OMR → XOF). Pour Oman (OMR → OMR), aucun taux ni conversion : tout est en OMR. Le taux est celui configuré dans l'application (**pas un taux bancaire**) ; l'e-mail le rappelle.
- **Langue de la confirmation à l'expéditeur** (règle du 10 octobre 2026, fonction `senderNoticeLang`) : (1) si le **pays du profil de l'expéditeur** est arabophone (OM, AE, SA, KW, QA, BH, YE, IQ, JO, LB, SY, PS, EG, SD, LY) → **arabe, quel que soit le service** (Orange Money compris) ; (2) sinon la langue du **service** choisi (pays du bénéficiaire : ML, CI, BF, GN, SN, NE, TG, BJ, CM, TD, GA, CG, CD, FR → français) ; (3) sinon la langue des préférences de la personne, à défaut l'anglais. Tous les comptes actuels sont à Oman : ils reçoivent donc l'arabe. Un SMS arabe d'Orange Money fait 4 segments (203 caractères, Unicode), un SMS arabe d'Oman 3 segments.
- **Langue du message au bénéficiaire** : celle de son compte s'il en a un, sinon celle de son pays (mêmes listes), sinon anglais.
- SMS : le français est écrit sans accents (alphabet GSM : 160 caractères par segment) ; l'arabe est en Unicode (70 caractères par segment) : la confirmation arabe fait 3 segments dans l'exemple, le message arabe détaillé jusqu'à 4. Chaque segment est facturé par le fournisseur.
- **Nom affiché chez le destinataire** : l'expéditeur technique reste `YORWALLET` pour le SMS (identifiant enregistré chez le fournisseur, inchangé) ; **pour l'e-mail il est `NEX WALLET` depuis 12.6.1** (`send-email`, `send-notice`, `chain-notice` ; une ancienne valeur « YOR WALLET » du secret `NOTICE_FROM_NAME` est corrigée en « NEX WALLET » par le code) (un SMS ou un e-mail sans expéditeur identifiable est rejeté ou classé en spam). Le **texte** du message au bénéficiaire ne contient pas la marque. On les change sans modifier le code : secrets de fonction `SMS_SENDER` (≤ 11 lettres/chiffres) et `NOTICE_FROM_NAME`.

### Où l'expéditeur reçoit sa confirmation
- **SMS** : au numéro enregistré dans **Réglages → « Numéro pour les confirmations SMS »** (stocké dans le document `preferences` de la personne, clé `confirmPhone`), à défaut `profiles.phone`. **Aucun numéro enregistré → aucun SMS** (jamais de numéro inventé) ; le reçu écrit « Ajoutez votre numéro dans les Réglages ». Le pays du profil doit faire partie des pays SMS autorisés (OM, AE, ML, CI, BF).
- **E-mail** : à l'adresse du compte (toujours Brevo), si le compte est actif.
- Pour un virement bancaire (IBAN, routage + compte), le bénéficiaire n'a pas de numéro à prévenir : seule la confirmation à l'expéditeur est créée.

## Comment ça marche

1. `fiat_send_external` / `transfer_fiat` confirment le transfert. Au commit, le déclencheur `trg_tx_email` appelle `enqueue_recipient_notices(tx)` (toute erreur est avalée : le transfert n'est **jamais** bloqué par un message).
2. `enqueue_recipient_notices` normalise les numéros (`_phone_e164`, indicatifs OM 968, AE 971, SA 966, US 1, CI 225, ML 223, BF 226, GN 224, EG 20, SD 249 ; un IBAN ou un identifiant avec lettres donne NULL), applique les limites et écrit des lignes dans `recipient_notices`, avec une **audience** :
   - `EXTERNAL` (bénéficiaire) : un SMS vers le numéro (pays autorisés : OM, AE, ML, CI, BF), et un e-mail **si ce numéro est celui d'un profil actif qui a une adresse e-mail** (indépendant de la liste des pays SMS) ;
   - `SENDER` (expéditeur, 12.3.2) : un SMS vers son numéro de confirmation (ligne `SKIPPED / no_sender_phone` s'il n'en a pas enregistré) et un e-mail vers l'adresse du compte. La colonne `country` porte le pays du service : elle fixe la langue ;
   - `INTERNAL` : pour un transfert **interne**, un SMS vers le numéro du profil du destinataire s'il en a un (l'e-mail interne existe déjà : `send-email`) ;
   - les envois crypto n'écrivent rien dans cette file (leur e-mail passe par `chain-notice`, voir 12.3.6) ;
   - limites : 5 SMS par 24 h pour un même numéro de bénéficiaire, 20 par 24 h pour un même expéditeur (SMS vers bénéficiaires), 10 SMS de confirmation par 24 h vers un même numéro d'expéditeur ; un message de plus de 24 h expire.
3. L'application appelle la fonction `send-notice` avec le jeton de l'utilisateur connecté **juste après l'envoi** (`TransferEngine.flushNotices`), puis **à l'ouverture du reçu** si un message est encore « en attente » ou « échec ». La fonction vérifie que l'appelant est l'expéditeur de la transaction, réserve les lignes (`claim_recipient_notices`), envoie par le fournisseur SMS choisi (`SMS_PROVIDER`) et, pour l'e-mail, par l'API Brevo (`smtp/email`) et note le résultat (envoyé / reporté / échec).
4. Le reçu affiche l'état **réel** lu côté serveur (`get_recipient_notice_status`), en deux groupes (« Confirmation qui vous est envoyée » puis les messages au bénéficiaire) : transmis au fournisseur, en attente, non envoyé, avec la raison. Rien n'est affiché s'il n'y a aucun message ; « envoyé » n'est jamais inventé.

### Pourquoi l'application déclenche l'envoi et non la base
Le premier plan faisait appeler la fonction par la base (`pg_net` + secret partagé lu dans `app_private` + cron toutes les 5 min). La pose de cette partie a été **annulée par l'outil de déploiement** (elle lit un secret et le poste en HTTP) ; elle n'a **pas** été contournée ni appliquée. À la place : jeton de l'utilisateur, aucun secret partagé. Conséquence : si l'appel de l'application est perdu (téléphone coupé juste après l'envoi), le message reste en attente jusqu'à la prochaine ouverture du reçu, et expire après 24 h. Il n'y a pas de relance automatique en arrière-plan.

## Sécurité
- `verify_jwt = true` ; en plus, la fonction retrouve l'utilisateur et exige `transactions.sender_id = utilisateur` (403 sinon). Vérifié : sans en-tête, avec la clé publique anonyme, avec un faux jeton → **401** dans les trois cas.
- La réponse de la fonction ne contient ni numéro, ni e-mail, ni message d'erreur du fournisseur.
- `recipient_notices` : RLS activée, aucune politique (le navigateur ne la lit pas) ; les fonctions d'aide ne sont exécutables que par le serveur ; seule `get_recipient_notice_status` est ouverte aux utilisateurs connectés et ne renvoie que les lignes de **leurs** transactions, sans numéro ni e-mail.
- Aucune clé Brevo dans le navigateur : elle reste dans le secret `BREVO_API_KEY` de la fonction.

## Ce qui n'a PAS été exécuté (NOT EXECUTED)
- **La fonction `send-notice` n'a jamais envoyé de message réel** (aucun transfert externe depuis l'application depuis la mise en place de la file). Seuls des SMS d'essai envoyés par le connecteur Infobip de Claude sont arrivés (voir plus bas). Un nom d'expéditeur alphanumérique doit souvent être déclaré par pays (Émirats, Oman…).
- Le comportement de la fonction avec un vrai jeton d'utilisateur et un vrai envoi Brevo n'a pas été exercé. Testés : la logique pure (`tests/edge/send-notice-lib.test.mjs`, 38 tests, textes comparés caractère par caractère), l'interface réelle avec un faux client (`tests/ui/transfer-simple.test.mjs`), la base (essai annulé), et le refus des appels non autorisés (401).
- Aucun profil n'a de numéro dans `profiles.phone` : l'e-mail au bénéficiaire n'atteint donc personne pour l'instant. Pour la confirmation à l'expéditeur, le numéro se saisit dans les Réglages (version 12.3.2) : tant qu'il n'est pas saisi, **aucun SMS de confirmation ne part** (l'e-mail part vers l'adresse du compte).
- Aucun versement réel sur Orange Money / banque / service d'Oman : le message au bénéficiaire dit « confirmé » (le débit est fait), jamais « reçu » ; la confirmation à l'expéditeur dit « en cours de traitement ».
- Règle d'ajout en file : **testée sur la vraie base avec des transactions fictives annulées** (aucune trace restante) : numéro malien → 1 SMS en attente ; appel répété → pas de doublon ; Égypte → SMS ignoré (`country_not_enabled`) ; IBAN → aucune ligne ; 6ᵉ SMS vers le même numéro → refusé (`rate_limited_recipient`). **Non exécutés sur des données** : la ligne e-mail (il faut un profil avec téléphone : un test qui modifiait un profil a été refusé par l'outil, et n'a pas été contourné) et le SMS d'un transfert interne ; leur code a seulement été relu.

## Fournisseurs SMS (version 2 de la fonction)
Le fournisseur se choisit par le secret `SMS_PROVIDER` (aucun redéploiement) ; l'e-mail reste toujours chez Brevo. **Sans secret `SMS_PROVIDER`, la fonction (v11, 10 octobre 2026) prend Infobip dès que `INFOBIP_API_KEY` existe, sinon Brevo.** Constat du 10 octobre 2026 : les deux premiers transferts faits depuis l'application sont partis par Brevo (identifiants de message à 16 chiffres, alors qu'Infobip en donne 23) avec l'expéditeur `YORWALLET`, non enregistré à Oman : acceptés par le fournisseur, jamais arrivés sur le téléphone.

| `SMS_PROVIDER` | Secrets à définir | Expéditeur |
|---|---|---|
| `brevo` (défaut) | `BREVO_API_KEY` (déjà là) | `SMS_SENDER`, sinon `YORWALLET` ; **à enregistrer pour chaque pays destinataire** (Brevo : Settings → Campaigns → SMS Sender ID) |
| `infobip` | `INFOBIP_API_KEY`, `INFOBIP_BASE_URL` (`https://xxxxx.api.infobip.com`, propre au compte ; refusé s'il n'est pas en https sur `*.infobip.com`) | `SMS_SENDER`, sinon `FriendlyPay` (12.12.0 ; avant : `ServiceSMS`, expéditeur d'essai Infobip) |
| `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (numéro `+…` ou nom ≤ 11 caractères) | `TWILIO_FROM` |

- « **Transmis au fournisseur** » (statut `SENT` en base) = *accepté par le fournisseur* (réponse 2xx). **La remise sur le téléphone n'est pas suivie** : le 9 octobre 2026, un essai réel Infobip a été accepté (`PENDING_ACCEPTED`) puis rejeté en quelques millisecondes (`REJECTED_ROUTE_NOT_AVAILABLE` / `EC_ACCOUNT_NOT_PROVISIONED_FOR_CHANNEL`). Le reçu l'indique (12.3.1). Suivre la remise demanderait de lire le rapport de livraison du fournisseur (non fait).
- Réponses classées sans toucher au réseau (tests) : accepté / crédit manquant (reporté 30 min) / problème de compte ou d'expéditeur (reporté 30 min) / clé refusée (reporté 10 min) / numéro refusé (définitif) / erreur temporaire (relance).
- **Essai réel (9 octobre 2026)** : 2 SMS Infobip vers +968 77986533 par le connecteur Claude (pas par la fonction) ; acceptés puis rejetés, compte non activé pour le canal SMS. Aucun SMS reçu.
- **NON EXÉCUTÉ** : les adaptateurs Infobip et Twilio n'ont jamais parlé à leurs vrais serveurs (aucune clé disponible). Format de requête repris de la documentation Infobip (`POST /sms/3/messages`, `Authorization: App …`) et de l'API Twilio (`Messages.json`, Basic) ; le SMS arabe via Infobip/Twilio n'est pas vérifié.

## Ce qui empêche d'envoyer « tout de suite » à de vrais clients
- **Brevo** : le compte n'a **aucun crédit SMS** (plan gratuit, seulement 297 envois d'e-mail). Les crédits SMS se prennent en prépaïd, sans abonnement, même sur le plan gratuit (compte → *My plan* → *SMS: Prepaid credits* → *Buy credits*, à partir de 100 crédits). Brevo exige en plus un nom d'expéditeur **enregistré pour chaque pays** ; les délais varient selon le pays.
- **Oman, Émirats** : les opérateurs exigent un nom d'expéditeur préenregistré (selon la documentation d'un revendeur SMS : Oman environ 1 à 2 semaines, Émirats jusqu'à un mois ; sans cela les messages sont filtrés).
- **Essais gratuits** (Infobip, Twilio) : envoi **uniquement vers le numéro vérifié à l'inscription**, avec un expéditeur d'essai. Ils servent à prouver le circuit de bout en bout, pas à servir des clients.

## Pour que le SMS parte vraiment
1. Prouver le circuit : compte d'essai (Infobip ou Twilio), secrets ci-dessus, `SMS_PROVIDER` ; envoyer un transfert vers **son propre numéro** vérifié.
2. En production : acheter du crédit, enregistrer l'expéditeur de chaque pays (Mali, Côte d'Ivoire, Burkina, Oman, Émirats), puis noter le résultat d'un envoi réel.


## Essais réels du 2026-10-09 (via le connecteur Infobip de Claude, pas via la fonction)
- Le canal SMS du compte Infobip est devenu actif dans la journée : 3 SMS vers +968 77986533 sont arrivés (`DELIVERED_TO_HANDSET`), dont le texte arabe détaillé ci-dessus (4 segments) avec la référence d'exemple `TX-EXEMPLE-0001`.
- **NOT EXECUTED** : la fonction `send-notice` n'a pas encore envoyé de message avec une vraie clé Infobip. Aucune ligne n'existe dans `recipient_notices` : aucun transfert externe n'a été fait depuis l'application depuis la mise en place de la file. Les trois secrets (`INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `SMS_PROVIDER=infobip`) ont été saisis par le propriétaire, mais je n'ai aucun moyen de lire leur présence.
- Avec le compte d'essai Infobip, seul le numéro vérifié à l'inscription reçoit les SMS.

## Confirmation à l'expéditeur : ce qui a été vérifié (12.3.2)
- **Logique des textes** : `tests/edge/send-notice-lib.test.mjs`, 38 tests (français Orange Money, arabe Oman, anglais ; frais = total − montant ; pas de total → pas de frais ; message au bénéficiaire inchangé et sans frais ; nettoyage du service et du numéro ; e-mail expéditeur).
- **Base réelle (transactions et utilisateurs fictifs, tout annulé, 0 reste vérifié)** : S1 Orange Mali sans numéro d'expéditeur → SMS bénéficiaire en attente, e-mail expéditeur en attente, SMS expéditeur `SKIPPED / no_sender_phone`, pays ML ; S2 Oman avec numéro → SMS expéditeur en attente vers 96877986533 ; S3 IBAN → seulement les lignes expéditeur ; S4 crypto → 0 ligne.
- **Fonction `send-notice` v6** déployée, `verify_jwt` actif ; refus sans jeton vérifié (401 `unauthorized`).
- **Interface** : `tests/ui/sender-confirmation.test.mjs` (7 tests) : champ « numéro pour les confirmations » (validation, enregistrement, vide = supprimé), reçu Orange Money Côte d'Ivoire (groupe expéditeur en premier, « ≈ … XOF », taux, total débité), reçu Oman (tout en OMR : ni taux ni XOF), reçu en français, crypto (aucun panneau, aucun appel à la fonction).
- **NOT EXECUTED** : l'envoi réel par la fonction avec la clé Infobip (la présence des trois secrets n'est pas vérifiable par moi : seul un premier vrai transfert le prouvera) ; la remise sur le téléphone n'est pas suivie ; aucun versement réel au bénéficiaire.

## Mise à jour du 10 octobre 2026 : confirmation toujours en arabe pour un compte d'Oman
- Décidé avec le propriétaire : « à chaque transaction, un message à moi-même, selon le service utilisé, avec les détails en arabe ». Fonction `send-notice` **v7** déployée (`verify_jwt` actif ; appel sans en-tête d'autorisation → **401** vérifié, requête `pg_net` 1707).
- Tests : `tests/edge/send-notice-lib.test.mjs`, 40 tests (dont la règle de langue et le texte arabe exact pour Orange Money).
- **NOT EXECUTED** : aucun envoi réel par la fonction avec la clé Infobip (le compte est encore en essai : seul le numéro vérifié reçoit les SMS) ; aucun profil n'a encore enregistré de numéro de confirmation dans les Réglages (contrôle en base le 10 octobre : 0). Sans ce numéro, le SMS de confirmation est ignoré (`no_sender_phone`) ; l'e-mail part vers l'adresse du compte.

## E-mail des envois YOR-USDT (12.3.6, 12 octobre 2026)
- **Décidé avec le propriétaire** : « le mail doit confirmer que oui c'est parti », sans attendre la chaîne. Fonction `chain-notice` (v2, `verify_jwt` actif) + table `chain_notices` (migration `20261012_chain_notices.sql`, appliquée : RLS sans politique, aucun droit pour `anon` / `authenticated`, vérifié).
- **« sent » (« c'est parti »)** : l'application l'envoie dès l'état `broadcasted` (transaction signée dans TronLink et acceptée par le réseau). Le serveur **n'attend pas la chaîne** : il interroge le nœud Nile avec un délai de 3 s ; si le nœud ne connaît pas encore la transaction ou ne répond pas, il utilise les détails annoncés par l'application (adresses TRON à somme de contrôle valide, montant entier > 0, tout le reste refusé en 400). Si le nœud connaît déjà la transaction, **ses valeurs font foi**, et une transaction qui n'est pas un `transfer` du jeton YOR est refusée (422). L'e-mail dit « **PAS encore confirmé** ».
- **« confirmed »** : preuve on-chain **obligatoire**, relue par le serveur (nœud solidity : bloc > 0, reçu `SUCCESS`, événement `Transfer` exact). Sinon 409 `not_confirmed` et **aucun e-mail**. Une transaction échouée ou non confirmée n'est donc jamais annoncée comme réussie.
- **Garde-fous** : destinataire de l'e-mail = adresse du **compte connecté** (jamais une adresse fournie) ; un e-mail par (personne, transaction, événement) ; 30 e-mails crypto par personne et par 24 h ; testnet Nile seulement (URL du nœud fixe) ; aucune clé privée ni signature n'est demandée.
- **Côté application** (`js/features/chain-notice.js`) : abonné aux changements d'état du moteur ; « sent » pour un envoi de moins de 30 min, « confirmed » pour un envoi confirmé de moins de 24 h dont le départ a été annoncé (ou tout récent) ; 3 essais au plus par e-mail ; jamais bloquant pour le transfert.
- **Limites** : il faut être connecté à un compte YOR avec une adresse e-mail ; le secret `BREVO_API_KEY` doit être présent (sinon 503, ligne `FAILED`, nouvel essai possible) ; « confirmed » part quand l'application est ouverte et suit la transaction (pas de relance serveur en arrière-plan) ; la livraison réelle de l'e-mail par Brevo n'est **pas** prouvée par les tests.
- **Tests** : `tests/edge/chain-notice-lib.test.mjs` (9), `tests/edge-sim/chain-notice.test.mjs` (16, exécute `index.ts` tel quel contre un faux Supabase / nœud / Brevo), `tests/ui/chain-notice.test.mjs` (6, app réelle dans Chromium).
- **NOT EXECUTED** : aucun envoi réel d'e-mail par la fonction déployée avec un vrai compte et une vraie transaction signée par TronLink (le shell n'atteint pas le projet Supabase ; seul un appel avec la clé publique a été fait depuis la base : 401 `unauthorized`, ce qui prouve que la fonction démarre).

## SMS arabe au destinataire (12.3.7, 12 octobre 2026)
- **Décidé avec le propriétaire** : modèle arabe pour le message envoyé au destinataire (`عزيزي العميل،` / montant / `رقم المرجع` / `التاريخ والوقت` / `من الحساب` / `إلى الحساب` / avertissement « حوالة دولية »). Code : `send-notice/lib.ts` (`buildRecipientSmsAr`, `buildNoticeSms`, `recipientSmsLang`, `isInternational`, `fmtDateTimeUtc`) ; fonction `send-notice` **v20** (`verify_jwt` actif, identique au code local, vérifié fichier par fichier).
- **Langue** : arabe pour un destinataire EXTERNE dans un pays arabophone (OM, AE, SA, EG…) et pour un destinataire INTERNE dont le compte est réglé en arabe ; anglais sinon (ex. Côte d'Ivoire, Orange Money : texte anglais inchangé). L'expéditeur garde l'alerte de débit en anglais. Pays du bénéficiaire inconnu : anglais, aucune supposition.
- **Champs** : `إلى الحساب` = compte du bénéficiaire (jamais vide ; ligne omise si illisible). `من الحساب` = numéro de l'expéditeur (décision 12.3.4), sinon son nom abrégé. Date et heure en UTC, suffixe `UTC`. Chiffres et références isolés en LTR (U+202A…U+202C) dans le texte arabe.
- **Avertissement international** : ajouté UNIQUEMENT si le pays de l'expéditeur (profil) et celui du bénéficiaire (pays du service) sont connus (2 lettres) et différents.
- **Écarts voulus par rapport au modèle** : ni `BMCT…` ni nom de banque (pas d'imitation d'une banque tierce) ; transfert externe = `تم تأكيد تحويل مبلغ` (l'application ne peut pas vérifier la réception), `تم استلام مبلغ … بنجاح` réservé aux transferts internes YOR.
- **Coût** : texte Unicode = 70 caractères par SMS (67 si plusieurs parties). Un transfert national se compose de ~3 parties, un transfert international ~5.
- **Vérifié en réel** (12 octobre 2026, 02:46 heure d'Oman) : un transfert d'Oman à Oman a produit un SMS arabe au bénéficiaire, accepté puis **livré au téléphone** selon le rapport de livraison d'Infobip (`DELIVERED_TO_HANDSET`, 3 parties). Le texte reçu n'a pas été relu à l'écran du téléphone par l'équipe.
- **À savoir** : le statut `SENT` de `recipient_notices` signifie « accepté par Infobip », **pas** « livré ». L'application ne lit pas encore les rapports de livraison. Exemple observé le même jour : le SMS de débit de l'expéditeur est resté `SENT` alors qu'Infobip l'a rejeté (`REJECTED_NOT_ENOUGH_CREDITS`, crédit du compte épuisé) ; un SMS vers un téléphone éteint est `SENT` puis `EXPIRED`. Solution à prévoir si besoin : lire les rapports de livraison et marquer l'échec réel.
- **Tests** : `tests/edge/send-notice-lib.test.mjs` (68), `tests/edge-sim/send-notice.test.mjs` (10, exécute `index.ts` tel quel contre un faux Supabase et un faux Infobip).

## Envoi crypto externe : confirmation immédiate et adresse dans l'e-mail (0.9.2, 12 octobre 2026)
- **Décision du propriétaire** : un envoi crypto vers une adresse externe est **CONFIRMÉ à la création**, sans étape d'attente. Migration `20261012b_crypto_send_external_instant_confirm.sql` (appliquée sur le projet `gebjmguoauvutiqvoswl`) : patch de `_crypto_send_external_impl` — statut `CONFIRMED` (ligne `transactions` et réponse JSON), message « sent » au lieu de « is being sent », et `meta.ledger_only = true` + `meta.settlement = 'instant'`. Chaque remplacement est contrôlé : exactement 1 occurrence, sinon la migration échoue. Aucune mise à jour de l'application n'est nécessaire.
- **Vérité des données** : `meta.ledger_only = true` signifie « écriture du registre YOR, **sans diffusion sur une blockchain** ». Seul l'envoi YOR-USDT par TronLink (écran administrateur, testnet Nile) est réellement diffusé, et celui-là ne passe en « Confirmed » qu'avec la preuve de la chaîne (règle inchangée).
- **E-mail de transaction** (`send-email` **v9**, `verify_jwt` désactivé comme en v8 ; source locale : `supabase/functions/send-email/index.ts`) : pour les types `CRYPTO_SEND` et `CRYPTO_TRANSFER`, l'e-mail de l'**expéditeur** affiche maintenant l'adresse de destination COMPLÈTE (`meta.address`), le réseau (`transactions.network`, nom lisible, sinon tel quel) et le mémo s'il existe, en fr/en/ar. Les valeurs de plus de 28 caractères passent à la ligne (`word-break:break-all`) pour ne pas déborder sur téléphone. Aucune adresse n'est inventée : si `meta.address` est vide, les lignes sont omises.
- **Non-régression vérifiée en réel** (aperçu `dry_run`, sans envoi) : pour 6 e-mails existants (5 expéditeur, 1 destinataire ; fr et ar), le HTML de la v9 est identique à l'octet près à celui de la v8 (empreintes MD5 comparées). Le e-mail crypto de la transaction concernée contient désormais l'adresse et le réseau « TRON ».
- **Renvoi** : l'e-mail corrigé de cette transaction a été remis en file avec une clé d'idempotence distincte (`…:sender:v2`) et accepté par Brevo. « Accepté » ne prouve pas la réception dans la boîte du destinataire.
- **NOT EXECUTED** : aucun test automatisé dans le dépôt pour `send-email` (la vérification ci-dessus est un contrôle en production, pas un test rejouable) ; la lecture du mail sur le téléphone du propriétaire n'est pas confirmée.

## Refonte design premium (application 12.4.0 / yor-core 0.9.3, 12 octobre 2026)
- **Périmètre** : application seulement (HTML/CSS/JS). Aucune migration Supabase, aucune Edge Function, aucune règle métier de transfert modifiée.
- **Identité** : NEX WALLET (ex‑YOR WALLET). Aucun logo, nom ou écran tiers copié ; le test `tests/ui/redesign.test.mjs` échoue si « Visa », « Mastercard », « Binance », « Revolut » ou « BMCT » apparaît dans le code de l'application.
- **Cartes** : ce sont des aperçus. Aucune carte n'est émise par un partenaire ; l'application n'affiche donc ni réseau, ni CVV, ni date d'expiration, ni « Active ». Un logo de réseau ne pourra apparaître que lorsque les données d'une carte contiendront un vrai réseau ET un vrai émetteur.
- **Statut** : `txState(status)` → `success` (SUCCESS / CONFIRMED / COMPLETED), `failed` (FAILED / REJECTED / DECLINED / CANCELLED / EXPIRED / ERROR), sinon `pending` (y compris inconnu ou absent). Écran du reçu, liste, historique, PNG, PDF et impression en dépendent ; un reçu en cours ou échoué n'est jamais présenté comme réussi.
- **Tests exécutés** : `npm test` (251 + 49 réussis) ; `npm run test:ui` (84 réussis, 0 échec).
- **NOT EXECUTED** : vrai iPhone / Android ; impression sur papier ; déploiement Netlify réel ; émission réelle d'une carte. Le PDF est une image.
