# Guide administrateur

Chaque action ci-dessous passe par une fonction serveur qui vérifie votre rôle, applique le changement en une seule
transaction, notifie le client et écrit une ligne d'audit (auteur, date, motif, détails). Rien n'est validé automatiquement.

## Vue d'ensemble
- **Capital de référence (configuré)** : valeur d'affichage (1 000 000,000 OMR par défaut). Elle ne crée aucun fonds.
- **Fonds réellement enregistrés** : trésorerie issue du registre. « Disponibles pour décaisser » = trésorerie − soldes dus aux clients.
- **Envoyer les rappels** : crée une notification « échéance à venir » pour chaque échéance impayée dans N jours (une seule fois par échéance).

## Documents d'identité
*Documents* → filtre « À examiner ». **Voir** ouvre un lien privé valable 2 minutes.
Décisions : *Mettre en examen*, *Vérifier*, *Demander un nouvel envoi* (motif obligatoire), *Refuser* (motif obligatoire).
L'identité du client passe à « Vérifiée » seulement quand le recto **et** le verso sont vérifiés.

## Demandes de financement
*Demandes* → ouvrir une demande.
1. *Mettre en examen* (facultatif).
2. *Demander des documents* (motif obligatoire) — le client voit le motif.
3. *Approuver* : impossible tant que l'identité n'est pas vérifiée. Vous pouvez ajuster montant et durée ; **Recalculer (serveur)** affiche le calcul officiel avec les paramètres actuels.
4. *Refuser* : motif obligatoire.

## Décaissement (deux étapes)
1. **Préparer le décaissement** : aucun mouvement d'argent.
2. Effectuez le virement **hors plateforme**, puis **Confirmer le décaissement** avec la référence du virement.
   Le serveur refuse si les fonds enregistrés sont insuffisants. À la confirmation : solde client crédité du montant approuvé,
   encours = total à rembourser, frais et coût constatés, échéancier créé. Une confirmation répétée ne crée rien de plus.

## Remboursements
Quand un paiement est **réellement reçu** : ouvrir la demande → **Enregistrer un remboursement** (montant + référence).
Imputation sur les échéances les plus anciennes ; reçu émis ; la demande passe à « Soldée » quand tout est payé.
Un montant supérieur au reste dû est refusé.

## Retraits
Parcours : Reçue → En vérification → En traitement → Confirmée → **Payée** (référence du virement obligatoire). Refuser / Marquer
échoué exigent un motif. « Payée » débite le solde du client ; le serveur vérifie son solde et la trésorerie.

## Registre comptable
- **Enregistrer des fonds reçus** (SUPER_ADMIN) : apport de capital réellement reçu, avec référence. C'est la seule façon d'alimenter la trésorerie.
- **Contre-passer** (SUPER_ADMIN, apports et retraits) : crée une écriture inverse, l'original reste visible et marqué « annulé ». Les décaissements et remboursements ne se contre-passent pas (ils sont liés à l'échéancier).
- Cliquez sur une référence pour voir les écritures débit / crédit.

## Clients
Recherche, fiche (solde, identité, demandes, retraits), *Suspendre* / *Clôturer* / *Réactiver* avec motif notifié.

## Paramètres (SUPER_ADMIN)
Capital de référence, montants min/max, durées min/max, frais fixes, frais en %, taux mensuel, langue par défaut,
nombre maximal de demandes ouvertes, notifications. Chaque modification est auditée avec les valeurs avant / après.
Administrateurs : ajouter par e-mail (le compte doit exister), changer le rôle, désactiver (pas soi-même).

## Notifications et e-mails
Les notifications s'affichent dans l'espace client. Aucun fournisseur d'e-mail n'est connecté : le journal indique
« Aucun fournisseur » et rien n'est présenté comme envoyé. Les modèles d'e-mail (ar/fr/en) sont prêts pour le jour où un fournisseur sera branché côté serveur.

## Journal d'audit
Toutes les actions, filtrables par objet, avec recherche. Le journal ne peut être ni modifié ni supprimé.
