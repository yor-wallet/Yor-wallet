# Mise en ligne YOR WALLET 12.1.0 sur Vercel

Ce dossier (`yor-wallet/`) est prêt à être déployé tel quel : site statique, aucune étape de build.
Le projet Vercel `yor-wallet` existe déjà sur votre compte (il ne contient pour l'instant qu'une page de test).

## Ce qui est configuré (`vercel.json`)
- HTTPS forcé (HSTS).
- Content-Security-Policy limitée à : votre projet Supabase (`gebjmguoauvutiqvoswl`) et jsDelivr (Supabase JS). Aucune autre source externe n'est autorisée.
- Anti-clickjacking (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), `nosniff`, `Referrer-Policy`, `Permissions-Policy` (caméra, micro, localisation et paiement désactivés).
- `sw.js` jamais mis en cache par le navigateur : une mise à jour du service worker est prise en compte immédiatement.
- `manifest.webmanifest` servi avec le bon type, pour l'installation sur téléphone.
- `index.html` sans cache, `assets/` avec cache long.

## Déploiement

Option A, sans ligne de commande :
1. Sur vercel.com : **Add New → Project**, puis glissez le dossier `yor-wallet/` (ou importez-le depuis GitHub).
2. Framework preset « Other ». Build command vide. Output directory vide (racine).
3. **Deploy**.

Option B, ligne de commande :
```bash
cd yor-wallet
npx vercel login
npx vercel --prod
```

## Après le déploiement
1. **Domaine** : Settings → Domains, puis ajoutez votre domaine.
2. **Supabase** : Authentication → URL Configuration. Site URL et Redirect URLs = votre domaine Vercel (indispensable pour la réinitialisation du mot de passe).
3. **Test PWA** : ouvrez le site sur mobile, vérifiez l'installation (« Ajouter à l'écran d'accueil »).
4. **Sécurité** : vérifiez les en-têtes sur https://securityheaders.com. Vérifiez que la RLS est active sur toutes les tables Supabase.
5. **Console** : si une ressource est bloquée, le message `Refused to load ...` indique le domaine à ajouter dans la CSP de `vercel.json`.

## Limites à connaître
- La CSP autorise `'unsafe-inline'` pour les styles et scripts en ligne du fichier unique. Pour la durcir, il faudrait externaliser le JavaScript.
- Les e-mails (bienvenue, transactions) passent par Brevo depuis Supabase, jamais depuis le navigateur : cette partie n'est pas encore branchée dans cette version.
- Le changelog 11.3.0 indique que la partie crypto n'a pas été testée contre Supabase : faites les tests sur un compte de test avant d'ouvrir l'app au public.

## Netlify (12.11.0)
- Le dossier se dépose tel quel (glisser-déposer du zip décompressé, ou « Deploy manually ») : `_headers` porte la CSP et le cache (`sw.js` et `index.html` jamais mis en cache) ; `404.html` est servi par Netlify pour les liens inconnus.
- Après la mise en ligne : ouvrir le site, attendre le premier chargement complet (le service worker garde alors une copie hors-ligne de l'application), puis couper le réseau et rouvrir l'application : l'écran « hors ligne » ou l'application doit s'afficher, jamais une page blanche.
- Reown / WalletConnect : ajouter `https://yor-wallet.netlify.app` aux domaines autorisés du projet Reown (dashboard). Réseau **Nile (test)** uniquement. Sur iPhone, ouvrir le site depuis le navigateur intégré de TronLink.
- iPhone : « Ajouter à l'écran d'accueil » depuis Safari ; les écrans de démarrage (`assets/splash/`) ne s'affichent qu'après une réinstallation de l'icône.
- 12.11.1 : si le téléphone était resté sur la 12.11.0 (« Connexion impossible »), la première ouverture après la mise en ligne se répare toute seule (une seule fois) ; sinon, fermer l'application complètement et la rouvrir.
