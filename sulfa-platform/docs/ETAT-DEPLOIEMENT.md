# État du déploiement (20 octobre 2026)

| Élément | Valeur |
|---|---|
| Site public | https://sulfa-oman.netlify.app (Netlify, projet `sulfa-oman`) |
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

## À faire dans le tableau de bord Supabase (non accessible depuis cet outil)
*Authentication → URL Configuration* : **Site URL** = `https://sulfa-oman.netlify.app` ; **Redirect URLs** : `https://sulfa-oman.netlify.app/login/` et `https://sulfa-oman.netlify.app/reset-password/`.
Sans cela, les liens des e-mails de confirmation et de réinitialisation pointent vers l'adresse par défaut.
Pour la production, configurer aussi un SMTP (*Auth → SMTP Settings*) : l'envoi par défaut de Supabase est limité à quelques e-mails par heure.

## Remarque Netlify
Sur l'offre gratuite, Netlify injecte un commentaire et un script dans les pages servies. React le signale dans la console (erreur #418) puis redessine la page : aucun effet fonctionnel (testé), et les mêmes fichiers servis ailleurs n'ont pas ce message.
