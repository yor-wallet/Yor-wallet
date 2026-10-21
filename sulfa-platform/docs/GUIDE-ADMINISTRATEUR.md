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

## Version 1.6 : selfie, e-mail de validation en arabe, liste des banques

### Selfie obligatoire
L'identité d'un client ne passe à « vérifiée » qu'après validation de **trois** documents : le recto de la carte, le verso de la carte et le **selfie**.
Le client prend son selfie avec la caméra frontale, dans un cadre ovale. Si la caméra n'est pas disponible, il prend une photo avec son téléphone.
Dans *Administration → Documents*, ouvrez le selfie (lien privé valable 2 minutes) et comparez-le à la photo de la carte avant de cliquer sur « Vérifier ».
Les clients déjà vérifiés avant la version 1.6 gardent leur statut.

### E-mail de validation (en arabe)
Quand les trois documents sont vérifiés, le client reçoit une notification dans l'application. Un e-mail en arabe est aussi mis en file d'attente.
Juste après votre validation, l'application demande l'envoi et affiche le résultat réel :
- « envoyé » avec le nombre d'e-mails partis ;
- « échec » ;
- « non envoyé : aucun service d'envoi configuré ».

Pour activer l'envoi, utilisez Brevo (offre gratuite : environ 300 e-mails par jour) :
1. Dans Brevo, rubrique *SMTP & API → API keys*, créez une clé. Validez aussi une adresse d'expéditeur dans *Senders*.
2. Dans Supabase, rubrique *Edge Functions → Secrets*, ajoutez deux secrets :
   - `BREVO_API_KEY` : la clé Brevo ;
   - `SULFA_MAIL_FROM` : l'adresse d'expéditeur validée.
3. Optionnel : `SULFA_SITE_URL`, par défaut `https://sulfa-oman.vercel.app`.

La clé ne doit jamais être collée dans le site, dans un fichier ou dans une conversation.
Le texte de l'e-mail se trouve dans la table `sulfa_message_templates`, sous la clé `IDENTITY_VERIFIED` en langue `ar`. Le journal `sulfa_email_log` garde pour chaque envoi son statut et l'identifiant Brevo.

### Liste des banques (retraits)
Le client choisit sa banque dans une liste groupée en quatre catégories : banques omanaises, islamiques, spécialisées et étrangères en Oman. Il peut aussi choisir « Autre banque » et taper le nom.
La liste de départ compte 17 banques. Vérifiez-la auprès de la Banque centrale d'Oman : https://cbo.gov.om/pages/licensedbanks.aspx.
Pour ajouter, renommer ou désactiver une banque, un SUPER_ADMIN exécute la fonction suivante (l'action est enregistrée dans le journal d'audit) :
`select public.sulfa_admin_upsert_bank('CODE', 'الاسم بالعربية', 'English name', 'LOCAL', true, 10);`
- 4ᵉ valeur, catégorie : `LOCAL`, `ISLAMIC`, `SPECIALIZED` ou `FOREIGN`.
- 5ᵉ valeur : `true` pour active, `false` pour masquée.
- 6ᵉ valeur : l'ordre d'affichage.
