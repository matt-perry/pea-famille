# Architecture

## Vue d'ensemble

```
iPhone (app installée)                        GitHub (dépôt public)
┌──────────────────────────────┐              ┌────────────────────────────────┐
│ Écrans React (views/)        │   app +      │ Pages : héberge l'app          │
│   ↓                          │ ◄──────────  │                                │
│ ViewModels (viewmodels/)     │   cours      │ Actions : robot du soir        │
│   ↓                          │   chiffrés   │   ← EODHD (cours de clôture)   │
│ Repositories + Services      │              │   → data/prices/*.json chiffrés │
│   ↓                          │              │ Secrets : EODHD_API_KEY,       │
│ core/ : moteur de calcul     │              │           DATA_KEY             │
│                              │              └────────────────────────────────┘
│ IndexedDB : tes données      │
└──────────────────────────────┘
```

Les mouvements et montants ne quittent jamais l'iPhone.

## Couches

| Dossier | Rôle | Règle |
| --- | --- | --- |
| `src/core/` | Moteur de calcul : dates, calendrier Euronext, PRU, valorisation, historique, TWR, TRI, projection, chiffrement, formats | Aucune dépendance au navigateur ni à la base ; testé dans `tests/` |
| `src/models/` | Schéma de la base locale (IndexedDB via Dexie) | Chaque évolution = une nouvelle version avec migration |
| `src/repositories/` | Lecture et écriture des données | Les écrans n'écrivent jamais directement dans la base |
| `src/services/` | Synchronisation des cours, sauvegarde | Pas de calcul financier |
| `src/viewmodels/` | Assemblent les résultats du moteur pour chaque écran | N'inventent aucun chiffre |
| `src/views/`, `src/components/` | Écrans et briques d'interface | Aucun calcul financier |
| `robot/` | Script du robot du soir (Node, exécuté par GitHub Actions) | Réutilise `core/` (calendrier, chiffrement) |
| `.github/workflows/` | `publier.yml` (tests → construction → GitHub Pages), `soir.yml` (robot) | Un test en échec bloque la publication |

## Modèle de données

| Table | Contenu |
| --- | --- |
| `accounts` | Les deux PEA : nom, titulaire, date d'ouverture, courtier |
| `etfs` | Fonds suivis : nom, ticker, place, symbole EODHD, ISIN, devise, type, émetteur |
| `movements` | Versements, achats, ventes, retraits, dividendes, frais, divisions (montants en texte décimal exact) |
| `prices` | Cours de clôture par symbole et par jour (clé `[symbol+date]`) |
| `kv` | Réglages : périmètre affiché, objectif, paramètres de projection, clé de lecture des cours, état de synchronisation |

Rien d'autre n'est stocké : quantités, PRU, valeurs, performances et historique sont recalculés à chaque affichage, donc toujours justes après la correction d'un mouvement ancien.

## Hors ligne

`public/sw.js` met l'app en cache : elle s'ouvre sans réseau, avec les derniers cours enregistrés. La page principale est toujours redemandée au réseau d'abord, pour recevoir les mises à jour.

## Sécurité

- Politique de sécurité du navigateur : l'app ne peut contacter que son propre site et `raw.githubusercontent.com`.
- Aucune clé dans le code. La clé EODHD n'existe que dans les secrets GitHub.
- Montants masqués quand l'app passe en arrière-plan.
