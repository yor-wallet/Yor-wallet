# Environnements

| `YOR_ENV` | Réseaux TRON permis | Remarques |
|---|---|---|
| `development` | Shasta, Nile | défaut ; TEST BALANCE permis ; mainnet **refusé** |
| `testnet` | Shasta, Nile | TEST BALANCE permis ; mainnet **refusé** |
| `production` | Shasta, Nile (préproduction) ; mainnet nécessite `YOR_ALLOW_MAINNET=true` | le jeton expérimental est refusé sur mainnet ; TEST BALANCE refusé |

Aucun déploiement automatique vers le mainnet. Le passage au mainnet exige : audit indépendant du contrat, validation
manuelle du propriétaire, et un jeton qui n'est plus « expérimental » (non implémenté ici).

## Variables
Voir `.env.example`. La configuration est chargée par `loadConfig(env)` (fonction pure, `src/services/blockchain/config.mjs`) :

| Variable | Défaut | Règle |
|---|---|---|
| `YOR_ENV` | `development` | `development`, `testnet` ou `production` |
| `TRON_NETWORK` | `shasta` | `shasta`, `nile` ou `mainnet` |
| `YOR_EXPERIMENTAL_TOKEN` | `true` | seule valeur acceptée : `true` |
| `YOR_TOKEN_CONTRACT_ADDRESS` | vide ⇒ `null` | somme de contrôle base58 vérifiée |
| `TRON_FULLNODE_URL` | URL du réseau | https obligatoire ; une URL mainnet est refusée pour un testnet |
| `TRONGRID_API_KEY` | absente | jamais journalisée ni sérialisée |
| `YOR_FEE_LIMIT_SUN` | absent | entier positif ; aucune valeur par défaut |
| `YOR_ALLOW_MAINNET` | absent | doit valoir `true` pour toute tentative de mainnet |

## Secrets
Clés API, clé de déploiement testnet (si Option A) et tout fournisseur de signature : **uniquement** dans les secrets
Supabase / Netlify, saisis par le propriétaire, jamais dans le dépôt, dans le HTML/JS public ou dans une table publique,
jamais dans une conversation.
