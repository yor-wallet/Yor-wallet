# SULFA — سلفه (conversion non destructive)

## Ce qui a été conservé
- L'ancien écran Friendly Pay est conservé dans `friendly-pay-legacy.html`.
- Les anciens fichiers CSS/JS, assets, identifiants de stockage local et la configuration Supabase d'origine restent dans l'archive.
- Aucun script ne supprime ni ne migre les données existantes.
- Les nouvelles tables utilisent le préfixe `sulfa_` et sont ajoutées séparément.

## Installation
1. Décompresser l'archive dans un dossier de travail.
2. Faire une sauvegarde de la base Supabase existante.
3. Ouvrir Supabase SQL Editor et exécuter `sulfa/migration.sql`.
4. Vérifier l'URL et la clé publique Supabase dans `js/core/supabase-client.js` (ne jamais y placer la clé service_role).
5. Créer le compte administrateur via Supabase Auth, confirmer son e-mail, puis utiliser l'INSERT commenté à la fin de `sulfa/migration.sql` en remplaçant `ADMIN_EMAIL_HERE` par l'adresse de l'administrateur. Ne jamais mettre le mot de passe dans le code.
6. Déployer le dossier sur un hébergement HTTPS compatible avec les fichiers statiques.

## Notes
- L'application conserve l'ancien projet à titre de repli via `friendly-pay-legacy.html`.
- Les demandes de financement et documents sont stockés dans de nouvelles tables `sulfa_*`.
- Les documents sont privés dans le bucket `sulfa-identity`.
- Aucun solde artificiel n'est ajouté au registre. Le solde réel doit être calculé à partir d'opérations effectivement enregistrées et vérifiées.
- Les e-mails automatiques nécessitent un fournisseur transactionnel et une fonction serveur sécurisée; cette archive ne prétend pas que les e-mails transactionnels sont déjà configurés.
- Avant la mise en production financière, faire auditer les règles RLS et confirmer les exigences réglementaires applicables.
