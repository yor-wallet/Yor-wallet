# Friendly Pay 12.14.0 — déployer puis installer sur iPhone (sans App Store)

Friendly Pay est une **application web installable (PWA)**. Ce n'est pas une application native de l'App Store : elle s'installe depuis son adresse HTTPS avec Safari, s'ouvre en plein écran depuis sa propre icône, et n'utilise que ce que Safari autorise.

## 1. Déployer la nouvelle version (Netlify, comme les versions précédentes)
1. Télécharger `friendly-pay-12.14.0-netlify.zip` (le zip contient directement `index.html`, `sw.js`, `manifest.webmanifest`, `_headers`, `css/`, `js/`, `assets/`).
2. Ouvrir https://app.netlify.com → le site **yor-wallet** → onglet **Deploys**.
3. Glisser-déposer le zip dans la zone « Drag and drop your project folder here ».
4. Attendre « Published ». L'ancienne version reste dans la liste des déploiements : en cas de problème, **« Publish deploy »** sur la 12.13.0 la remet en ligne en un clic (rien n'est supprimé).
5. Vérifier sur ordinateur : https://yor-wallet.netlify.app → Réglages → Informations → version **12.14.0**.

Rien n'est à faire côté Supabase : cette version ne change ni la base, ni les fonctions, ni les règles de sécurité.

## 2. Installer sur l'iPhone
1. Ouvrir **Safari** (pas Chrome ni l'application Google : sur iPhone, seul Safari sait ajouter une application web à l'écran d'accueil de façon fiable).
2. Aller sur **https://yor-wallet.netlify.app**.
3. Toucher le bouton **Partager** (carré avec une flèche vers le haut, en bas de l'écran).
4. Faire défiler et toucher **« Sur l'écran d'accueil »** (« Add to Home Screen »), puis **Ajouter**.
5. Ouvrir Friendly Pay **depuis la nouvelle icône** (pas depuis Safari).

L'application affiche elle-même ces étapes (carte « Installer Friendly Pay sur ce téléphone » sur l'accueil et ligne « Installer l'application » dans Réglages › Apparence) tant qu'elle n'est pas installée.

### Mise à jour d'une app déjà installée
Ouvrir l'app depuis son icône avec Internet : le service worker télécharge la 12.14.0. Si l'ancien affichage reste, fermer l'app (balayer vers le haut) et la rouvrir.

### Alertes sur le téléphone (après installation)
Réglages › Notifications › « Alertes sur ce téléphone » → **Activer** → Autoriser → **Envoyer un test**. Exige iOS 16.4 ou plus et l'app ouverte depuis son icône.

## 3. Ce qui a été vérifié — et ce qui ne l'a pas été
- Vérifié automatiquement dans Chromium (sans tête) : voir la section Tests du rapport (manifeste, service worker réel, écrans, 320 px, clair/sombre, arabe).
- **Non vérifié** : l'installation et l'affichage sur un vrai iPhone, la réception réelle d'une alerte push via Apple. À faire par vous avec les étapes ci-dessus.
