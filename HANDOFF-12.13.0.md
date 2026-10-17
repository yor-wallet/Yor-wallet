# Friendly Pay — sauvegarde du 18 octobre 2026 (00:30, Oman) — état 12.13.0

## Contenu
- `app-12.13.0/` : l'application (PWA) 12.13.0, racine à déposer sur Netlify (site https://yor-wallet.netlify.app).
- `yor-core/` : dépôt serveur + tests + docs (`supabase/functions`, `supabase/migrations`, `tests/`, `docs/`, `package.json`). Sans `node_modules`.
- Aucun secret dans cette sauvegarde (voir « Secrets » plus bas).

## Ce qui est FAIT
1. 12.12.0 (déjà livré) : crypto masquée (`FEATURES.crypto=false`), transfert par numéro d'Oman seul, aucun frais, nouvelle animation, SMS corrigés, expéditeur SMS « FriendlyPay » (`send-notice` v26).
2. 12.13.0 (cette étape) : **alertes sur le téléphone = notifications Web Push** (iPhone iOS 16.4+ via écran d'accueil, Android, ordinateur).
   - Application : `js/features/push.js`, `sw.js` (événements `push`, `notificationclick`, `pushsubscriptionchange`), ligne « Alertes sur ce téléphone » dans Réglages (EN/FR/AR), pastille sur l'icône, désinscription à la déconnexion. Clé publique VAPID dans `js/data/reference-data.js` (`CONFIG.PUSH.vapidPublicKey`).
   - Serveur (Supabase projet `gebjmguoauvutiqvoswl`, **déjà en production**) : fonction `push-send` **v2** (`verify_jwt` actif ; fichiers déployés = ceux de `yor-core/supabase/functions/push-send/`, relus après publication) ; tables privées `push_subscriptions`, `push_vapid`, `push_sent` ; colonne `notice_dispatch_cfg.push_fn_url` ; déclencheur `notifications_push` → `_push_on_notification()`.
   - Vérifié en ligne (pg_net) : `init` rend la clé publique (identique à celle de l'app) ; notification inconnue → `skipped: not_found` ; UUID invalide → 400 ; mauvais jeton → 401 ; `subscribe` sans connexion → 401.
   - Docs mises à jour : `app-12.13.0/CHANGELOG.md`, `app-12.13.0/ARCHITECTURE.md`, `yor-core/docs/NOTICES.md` (section 12.13.0).
   - Tests : `npm test` = 304 réussis (model, tron, edge, web) + `npm run test:sim` 85 réussis, 0 échec. Les 2 tests de version (`tests/ui/app-boot.test.mjs`, `tests/ui/transfer-only.test.mjs`) attendent maintenant `12.13.0`. `tests/ui/push-app.test.mjs` : 24 réussis.

## Ce qui RESTE (pour Claude Code)
1. **Finir le test navigateur complet** : `cd yor-core && YOR_WEB=<chemin>/app-12.13.0 npm run test:ui > log 2>&1` (≈14 min, à lancer en arrière-plan). Au moment de la sauvegarde il était **en cours et non terminé** : 110 `ok`, 0 `not ok` au dernier relevé, pas de ligne finale.
2. Construire le zip Netlify : zipper le CONTENU de `app-12.13.0/` (pas le dossier) en `friendly-pay-12.13.0-netlify.zip`, puis le déposer sur Netlify (l'utilisateur déploie lui-même).
3. Test réel sur iPhone : ajouter l'app à l'écran d'accueil → Réglages → « Alertes sur ce téléphone » → Activer → Envoyer un test.
4. Rapport final court en français.

## NON EXÉCUTÉ (à dire honnêtement)
- Aucune alerte réelle livrée via Apple (APNs) sur un vrai iPhone ; pas de test Android / Firefox réel.
- Le test navigateur complet n'est pas terminé (voir ci-dessus).
- Pas de déploiement Netlify de 12.13.0.
- L'enregistrement du nom d'expéditeur SMS « FriendlyPay » chez Infobip / opérateurs d'Oman n'est pas vérifié.
- Aucun SMS ni alerte réels envoyés pour vérifier les textes.

## Limites iPhone (à répéter à l'utilisateur)
Une application web iOS ne s'exécute pas elle-même en arrière-plan : c'est Apple (APNs) qui livre l'alerte application fermée. Il faut iOS 16.4+, l'app ajoutée à l'écran d'accueil et ouverte depuis l'icône, et un toucher sur « Activer » (l'autorisation ne peut pas être demandée automatiquement).

## Pièges connus de l'environnement
- L'outil Supabase `apply_migration` est annulé tout seul si le SQL contient `delete from` ou `drop …` : ne pas contourner par `execute_sql` ; c'est pourquoi l'abonnement / désabonnement est dans la fonction `push-send` (pas en SQL) et que la migration utilise un bloc `do $$ … create trigger … $$` gardé.
- `tests/web/*` pointent vers un ancien dossier (`/home/claude/yor/p15/yor-wallet`, 12.6.1) : ne pas les modifier. Le registre npm est injoignable dans l'espace de travail. Ne pas utiliser `pkill -f "node --test"`.
- `tests/ui/*` servent l'app indiquée par `YOR_WEB`.

## Secrets (NON inclus, restent dans Supabase)
- Clé privée VAPID : table privée `push_vapid` (créée par la fonction ; **ne jamais régénérer**, tous les abonnements deviendraient invalides ; ne jamais l'exposer).
- Jeton interne `x-notice-token` : table privée `notice_dispatch_cfg`. Secrets Infobip / Brevo : secrets de fonctions Supabase.
- Seule la clé anon (publique par conception) apparaît dans la migration `20261010_notice_auto_dispatch.sql`.

## Règles permanentes de l'utilisateur
- Il est sur téléphone, dicte en français / arabe mal écrit : exécution directe, peu de commentaires, code complet.
- N'agir que sur ce qui est demandé explicitement (règle stockée, en arabe).
- Jamais : copier ou imiter une vraie banque (Bank Muscat, Sohar International…), noms de banque dans les SMS, jeton nommé TETHER/USDT, envoi de crypto depuis ici, logos Visa / Mastercard, marque Orange Money / Max it.
- SMS du destinataire : aucune marque ni « YOR », référence `TX-…` ; SMS de l'expéditeur : `FRD-TX-…`.
- Ne pas envoyer l'adresse e-mail de l'utilisateur à des services externes (contact VAPID = `https://yor-wallet.netlify.app`).
- Priorité : RÉEL > SÉCURISÉ > TESTABLE > MAINTENABLE > ÉVOLUTIF > ESTHÉTIQUE ; pas de régression ; jamais de mainnet en développement ; jamais « Confirmé » avant preuve on-chain.
