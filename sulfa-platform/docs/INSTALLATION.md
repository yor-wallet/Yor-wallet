# Installation et déploiement

## 0. Prérequis
- Un projet Supabase (Auth, Postgres, Storage). Node.js 20 ou 22.
- Accès à l'éditeur SQL du projet (rôle propriétaire).

## 1. Sauvegarder avant toute migration
1. Supabase → *Database* → *Backups* : vérifier qu'une sauvegarde récente existe (ou en déclencher une sur les offres qui le permettent).
2. Exporter en plus le schéma et les données : `supabase db dump -f avant-sulfa.sql` puis `supabase db dump --data-only -f avant-sulfa-donnees.sql`.
3. Noter la liste des tables existantes (`select tablename from pg_tables where schemaname='public' order by 1;`).

La migration est **additive** : elle crée uniquement des objets préfixés `sulfa_` et le bucket `sulfa-identity`. Elle ne
modifie ni ne supprime aucune table, fonction ou donnée existante, et peut être rejouée sans effet de bord (testé : appliquée deux fois).

## 2. Appliquer la migration
Éditeur SQL → coller `supabase/migrations/20261020_01_sulfa_core.sql` → *Run*. Puis vérifier :
```sql
select count(*) from pg_tables where tablename like 'sulfa\_%';          -- 18
select code from public.sulfa_accounts order by 1;                          -- 4 comptes plateforme
select reference_capital, min_amount, max_amount from public.sulfa_settings; -- 1000000.000 | 500.000 | 10000.000
```

## 3. Configurer l'authentification
Supabase → *Authentication* :
- *URL Configuration* → **Site URL** = l'adresse du site (ex. `https://sulfa.example.com`) ; **Redirect URLs** : ajouter `https://sulfa.example.com/login/` et `https://sulfa.example.com/reset-password/`.
- *Providers → Email* : laisser **Confirm email** activé (recommandé).
- Pour des e-mails d'authentification fiables en production, configurer un SMTP personnalisé (*Auth → SMTP Settings*). Les e-mails métier SULFA, eux, ne sont envoyés par aucun fournisseur tant qu'aucun n'est branché (statut `NO_PROVIDER` dans le journal).

## 4. Créer le premier administrateur
1. S'inscrire sur le site (ou créer l'utilisateur dans *Authentication → Users*) et confirmer l'e-mail.
2. Dans l'éditeur SQL (jamais depuis le navigateur) :
```sql
select public.sulfa_bootstrap_admin('adresse.admin@exemple.com');
```
3. Se reconnecter : le lien « Administration » apparaît. Les autres administrateurs se gèrent ensuite dans *Administration → Paramètres*.

Rôles : **SUPER_ADMIN** (paramètres, apports de capital, contre-passations, modèles, administrateurs), **ADMIN** (décisions, décaissements, remboursements, retraits, statuts de compte), **REVIEWER** (examen des documents, lecture).

## 5. Variables publiques et build
```bash
cd web
cp .env.example .env.local      # renseigner l'URL du projet et la clé publique (anon / publishable)
npm ci
npm run typecheck && npm test    # vérifications locales
npm run build                    # produit web/out/ (site statique)
```
La clé `service_role` ne doit **jamais** figurer dans `.env.local` : tout ce qui commence par `NEXT_PUBLIC_` est visible dans le navigateur.

## 6. Déployer
**Netlify** : relier le dépôt, *Base directory* = `sulfa-platform/web` (le fichier `netlify.toml` fixe `npm run build` et `out/`, ainsi que les en-têtes de sécurité et la CSP), définir `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans *Site settings → Environment variables*.
Tout hébergeur de fichiers statiques HTTPS convient aussi : publier le contenu de `web/out/`.

## 7. Vérifier après déploiement
```bash
cd web
NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run check:connected
```
Vérifications en lecture seule : paramètres publics, calcul du serveur, refus hors limites, aucune ligne lisible par un visiteur, écriture directe refusée, fonctions administrateur refusées.
Puis, manuellement : inscription → documents → demande ; côté admin : vérification des documents → approbation → enregistrement d'un apport de capital réellement reçu → préparation et confirmation du décaissement → remboursement → retrait.

## 8. Installer sur iPhone / Android (sans store)
Ouvrir le site dans Safari → *Partager* → *Sur l'écran d'accueil*. Le manifeste et le service worker sont fournis ; le service worker ne met jamais en cache les données Supabase (soldes et statuts toujours lus en direct).

## Revenir en arrière
Le site précédent est conservé dans `legacy/sulfa-static/`. Les objets `sulfa_*` peuvent être retirés depuis la sauvegarde de l'étape 1 ; ne supprimez jamais les tables du registre d'un environnement qui a servi : elles constituent la piste d'audit.
