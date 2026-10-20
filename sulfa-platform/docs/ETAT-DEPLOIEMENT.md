# État du déploiement (20 octobre 2026)

| Élément | Valeur |
|---|---|
| Site public | **https://sulfa-oman.vercel.app** (Vercel, projet `sulfa-oman`, équipe yordigitalefinance, relié à GitHub) — ancienne adresse Netlify https://sulfa-oman.netlify.app figée en 1.2.0 |
| Base de données | Supabase, projet séparé `sulfa` (`pkcjyksbiogdouqxzjcd`, région ap-south-1). Le projet Friendly Pay n'a pas été touché. |
| Clé utilisée par le site | clé publique `sb_publishable_…` uniquement (aucune clé secrète dans le site) |
| Administrateur | `dydamys8@gmail.com`, rôle SUPER_ADMIN (création auditée : `ADMIN_BOOTSTRAPPED`) |
| Fonds enregistrés | 0,000 OMR — capital de référence configuré : 1 000 000,000 OMR (valeur d'affichage) |

## Vérifié sur le projet réel
- Schéma identique au code testé : empreintes identiques pour les colonnes, contraintes, 23 déclencheurs, 20 politiques RLS, 18 tables sous RLS et droits d'exécution des 44 fonctions. Le corps des fonctions est identique, à une ligne de commentaire près dans `sulfa_admin_disbursement`.
- `npm run check:connected` : 14/14 (visiteur : aucune ligne lisible, écritures et fonctions administrateur refusées).
- Connexion réelle du compte administrateur sur le site en ligne → redirection vers `/admin/`, vue d'ensemble 1 000 000,000 / 0,000 OMR, paramètres modifiables.

## Note d'application
L'outil de migration a refusé les blocs SQL dynamiques (`DO … execute format(…)`). Les mêmes instructions ont été appliquées
écrites une à une (déclencheurs, RLS, droits), d'où la vérification par empreintes ci-dessus.

## Tableau de bord Supabase — URL configurées (fait par le propriétaire le 20 octobre 2026)
*Authentication → URL Configuration* : **Site URL** = `https://sulfa-oman.vercel.app` ; **Redirect URLs** : `https://sulfa-oman.vercel.app/login/` et `https://sulfa-oman.vercel.app/reset-password/`.
Fait par le propriétaire du projet (non vérifiable depuis l'outil : aucun accès à la configuration Auth). Sans cela, les liens des e-mails de confirmation et de réinitialisation pointent vers l'adresse par défaut.
Pour la production, configurer aussi un SMTP (*Auth → SMTP Settings*) : l'envoi par défaut de Supabase est limité à quelques e-mails par heure.

## Remarque Netlify
Sur l'offre gratuite, Netlify injecte un commentaire et un script dans les pages servies. React le signale dans la console (erreur #418) puis redessine la page : aucun effet fonctionnel (testé), et les mêmes fichiers servis ailleurs n'ont pas ce message.

## Version 1.2.0 (personnages et visualisation de données)
- Personnages illustrés (Aisha, Salim, Maryam) : vectoriels, animés (clignement, respiration, gestes), réagissant à chaque scène du film. Indiqués comme illustratifs.
- Graphiques : composition du coût, solde restant après chaque mensualité (infobulle + tableau), part remboursée et échéancier réel du client, fonds enregistrés et demandes par étape côté administration.
- Palette des graphiques vérifiée avec un validateur (daltonisme, contraste) en mode clair et sombre.
- Les frais et le taux sont à 0 tant qu'un super-administrateur ne les a pas configurés dans *Administration → Paramètres* : le simulateur affiche alors un coût nul, ce qui est exact.
- Netlify (offre gratuite) ajoute un badge « Powered by Netlify » sur le site.

## Version 1.3.0 (application mobile)
- Entrée de l'application `/app/` (ouverte par l'icône installée) : écran de lancement animé, 3 écrans de présentation à glisser, puis connexion ; un utilisateur connecté va directement dans son espace.
- Sur téléphone : barre d'onglets en bas (libellés courts, pastille des notifications non lues), grands titres, feuille « Plus » qui monte du bas, fenêtres de confirmation en feuille, prise en compte de l'encoche et de la barre d'accueil iPhone.
- Icônes vectorielles dessinées pour l'application ; portraits illustratifs en buste (remplacent les personnages en pied).
- Correction : l'animation d'ouverture des pages utilisait `transform`, ce qui empêchait l'affichage des éléments fixes (barre d'onglets, feuilles) dans Chrome ; elle n'utilise plus que l'opacité.
- **Non déployée** : Netlify a refusé le déploiement (« Skipped due to account credit usage exceeded »). La version 1.2.0 reste en ligne.

## Version 1.4.0 (illustrations 3D HD, typographie arabe, menus)
- Six illustrations 3D rendues en haute définition (1536 px, WebP + PNG de secours) : carte SULFA, pièces, bouclier, carte d'identité, calendrier, cloche. Utilisées dans l'accueil, les étapes, les écrans de présentation, les états vides et les documents ; légère lévitation et parallaxe au pointeur, coupées si « réduire les animations » est activé.
- Générées par `tools/render3d` (three.js, éclairage d'environnement, ombres douces) : `cd tools/render3d && npm ci && node render.mjs 1536` réécrit `web/public/3d`. Aucune marque ni logo de carte bancaire.
- Typographie : Readex Pro (titres) et IBM Plex Sans Arabic (texte) dans les trois langues, chiffres en Inter ; polices embarquées, aucun appel externe.
- Menus : tuiles en relief pour la barre d'onglets, la feuille « Plus », les actions rapides, la barre latérale et le menu mobile du site public ; boutons principaux brillants.
- Cache hors ligne renommé `sulfa-shell-v1.4.0` (l'ancien cache est supprimé à l'activation).
- Netlify ayant refusé (« Skipped due to account credit usage exceeded »), la 1.4.0 est publiée sur **Vercel** : https://sulfa-oman.vercel.app. Compilation sur Vercel depuis la branche GitHub (`sulfa-platform/web`), variables publiques Supabase dans le projet Vercel, en-têtes de sécurité dans `web/vercel.json`. Protection Vercel limitée aux aperçus : la production est publique.
- Vérifié en ligne : pages, images 3D, en-têtes (CSP, HSTS, X-Frame-Options), cache `sulfa-shell-v1.4.0`, connexion réelle de l'administrateur → `/admin/`, 1 000 000,000 / 0,000 OMR, paramètres modifiables, aucune erreur de page (plus d'injection Netlify, donc plus d'erreur #418).
