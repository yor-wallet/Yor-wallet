# Opérateurs de paiement futurs

État actuel : **aucun opérateur**. La table `sulfa_operators` est vide, `enabled = false` par défaut ; les champs
opérateur des retraits et des transactions restent vides (vérifié par les tests SQL).

## Ce qui est déjà prêt
- `sulfa_operators` : identifiant, nom, pays, devises, types d'opérations (`DEPOSIT`, `DISBURSEMENT`, `REPAYMENT`, `WITHDRAWAL`), configuration **non secrète**.
- `sulfa_payment_attempts` : journal requête / réponse / tentative, unique par (opérateur, clé d'idempotence, tentative).
- Champs `operator_id`, `operator_operation_id`, `external_reference`, `submitted_at`, `confirmed_at`, `provider_response` sur les retraits ; `operator_id` et `external_reference` sur les transactions.

## Règles à respecter pour brancher un opérateur
1. **Secrets côté serveur uniquement** : une Edge Function Supabase (ou un serveur) détient la clé de l'opérateur. Jamais dans le site ni dans `NEXT_PUBLIC_*`.
2. **Idempotence** : chaque appel sortant porte une clé dérivée de l'opération (ex. `wd:<id>`), enregistrée dans `sulfa_payment_attempts` **avant** l'appel.
3. **Confirmation par preuve** : une opération n'est marquée payée / confirmée qu'après une réponse positive de l'opérateur ou un webhook dont la signature est vérifiée.
4. **Incertitude** : en cas de délai dépassé ou de réponse illisible, l'opération reste « En traitement » ; on interroge l'opérateur sur le statut avant toute nouvelle tentative. Jamais de relance automatique d'une opération incertaine.
5. **Écritures comptables** : continuer à passer par `sulfa__post` (écritures équilibrées, immuables) ; ajouter un compte de transit par opérateur si les fonds transitent.
6. **Garde humaine** : l'activation d'un opérateur (`enabled = true`) doit être une fonction SUPER_ADMIN auditée, à créer à ce moment-là.
7. **Tests** : rejouer `supabase/tests/run.sh` et ajouter des cas : réponse dupliquée, webhook rejoué, délai dépassé, montant différent.

Tant que ces éléments ne sont pas en place, le fonctionnement reste manuel et local : c'est l'administrateur qui confirme.
