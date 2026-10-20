# Tests et limites

## Ce qui est vérifié automatiquement
| Suite | Commande | Résultat |
|---|---|---|
| SQL (PostgreSQL 16 local + bouchon Supabase) | `bash supabase/tests/run.sh` (en tant qu'utilisateur non-root) | 47 assertions passées ; migration appliquée deux fois |
| Unitaires (Vitest) | `cd web && npm test` | 20 tests : calcul = fonction SQL sur 315 cas réels, analyses du simulateur (coût, ±1 mois, solde restant), dictionnaires ar/fr/en identiques, chaque erreur et notification du serveur traduite, chaque appel RPC du site existe avec les bons paramètres |
| Navigateur (Chromium, site compilé, Supabase simulé au niveau réseau) | `cd web && npm run build:e2e && npm run test:e2e` | 27 tests : déconnexion avec écran d'au revoir puis retour à l'application, icône iOS et 10 écrans de lancement déclarés et servis, application mobile (lancement, présentation, onglets, feuille « Plus »), graphiques et analyses (valeurs exactes, infobulle, tableau), tableau de bord client (part remboursée, échéancier, date de fin), personnages, film animé (lecture, pause, mouvement réduit), connexion admin → /admin/ (régression), arabe RTL par défaut, changement de langue, simulateur, largeur téléphone 375 px sur 14 pages × 2 langues, coupure réseau = « incertain » + même clé à la reprise, motif et référence obligatoires côté admin, rôles |
| Types | `cd web && npm run typecheck` | sans erreur |

## Vérification connectée (à lancer après la migration)
`npm run check:connected` contre le vrai projet : lecture seule, avec la clé publique.

## Ce qui n'a PAS été vérifié
- La migration est appliquée au projet réel `sulfa` et vérifiée (voir ETAT-DEPLOIEMENT.md), mais le parcours complet (documents, approbation, décaissement, remboursement, retrait) n'a été exécuté que sur PostgreSQL local, pas sur le projet réel, pour ne pas y créer de fausses opérations.
- Les tests navigateur simulent Supabase : ils prouvent le comportement de l'interface, pas celui du réseau réel ni d'Auth (e-mails de confirmation, liens de réinitialisation).
- Aucun test sur un **vrai iPhone** (Safari iOS, installation sur l'écran d'accueil) : seulement Chromium à 375 px.
- Les textes juridiques (confidentialité, conditions) sont des modèles à faire valider par un juriste ; aucune licence n'est affirmée.
- Aucun fournisseur d'e-mail ni opérateur de paiement n'est connecté (par conception).
- Les illustrations 3D sont des images rendues (pas de 3D temps réel) : vérifiées visuellement et par la présence des 12 fichiers dans `out/3d`, pas par un test automatique de rendu. Les portraits restent illustratifs, ce ne sont pas des photos de personnes réelles.
- Les écrans de lancement et l'icône iOS sont vérifiés par leurs balises et leurs fichiers, pas sur un vrai iPhone : à confirmer en ajoutant l'application à l'écran d'accueil depuis Safari.
