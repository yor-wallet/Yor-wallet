# Expiration des jetons YOR-USDT

Principe : **rien n'expire sans lot ni date enregistrés on-chain.** Il n'y a pas de « durée de vie » globale, pas de
minuterie cachée, pas de décrément automatique de solde.

## Lots
Un solde est un ensemble de lots (`TokenLot`) :
`{ id, owner, amount, createdAt, expiresAt, remainingAmount }`. `expiresAt = 0` signifie « sans échéance ».

- **Consommation FIFO** par ordre d'arrivée dans le portefeuille.
- **Un lot échu n'est plus dépensable** : il est sauté lors d'un transfert ou d'un burn.
- **Un transfert crée chez le destinataire un lot qui hérite de l'échéance d'origine.** Si le dernier lot du destinataire
  a la même échéance et un reste positif, les montants sont fusionnés (moins de lots, moins de gaz).
- **Boucles bornées** : une opération visite au plus `MAX_LOTS_PER_OP = 50` lots (lots vides et échus sautés compris).
  Au-delà : revert `YORUSDT: too many lots`. Le détenteur fractionne alors son opération en plusieurs transferts.
- **Lectures** : `balanceOf` est brut ; `availableBalanceOf` et `expiredBalanceOf` refusent (`too many lots, use lotsSummary`)
  au-delà de 500 lots derrière la tête ; `lotsSummary(owner, start, count)` permet de paginer.

## Purge
`expireLots(owner, maxLots)` et `expireLotsFrom(owner, start, maxLots)` sont **accessibles à tous** (n'importe quel
compte, ou un robot) mais ne brûlent que des montants **réellement échus**. Chaque purge émet `Expiration` et
`Transfer(owner, 0, montant)`, et réduit `totalSupply`.

## Exemple vérifié sur le modèle (pas sur la chaîne)
A détient 1 870 000 YOR-USDT (TEST BALANCE). A envoie 50 à B :
A = 1 869 950, B = 50, `totalSupply` inchangé. Le lot de B hérite de l'échéance du lot consommé chez A.

## Interface (règle d'affichage)
Afficher séparément : **Disponible** (`availableBalanceOf`), **Échu à purger** (`expiredBalanceOf`) et la date
d'échéance du prochain lot. Ne jamais afficher un solde « disponible » calculé côté navigateur sans lecture on-chain.
