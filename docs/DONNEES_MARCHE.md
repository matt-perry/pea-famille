# Données de marché

## Source : EODHD

Cours de clôture d'Euronext Paris fournis par [EODHD](https://eodhd.com), offre gratuite :

- 20 appels par jour, un an d'historique, usage personnel ;
- un appel par ETF, quelle que soit la période demandée ;
- mise à jour des places européennes 2 à 3 h après la clôture (17 h 30), donc vers 19 h 30–20 h 30.

Si vos PEA ont plus d'un an d'historique un jour à reconstituer, un mois d'abonnement « EOD Historical Data — All World » (19,99 $) suffit pour tout récupérer une fois.

L'offre gratuite étant réservée à l'usage personnel, les cours publiés dans ce dépôt public sont **chiffrés**.

## Le robot du soir

Fichier `.github/workflows/soir.yml`, script `robot/fetch-prices.ts`.

1. GitHub le lance toutes les 15 minutes du lundi au vendredi, en soirée.
2. Il ne travaille qu'entre 19 h 40 et 23 h (heure de Paris), les jours de séance Euronext.
3. Tant que la clôture du jour n'est pas publiée, il n'interroge que le premier symbole (« témoin »).
4. Il écrit `data/prices/<symbole>.json` (chiffré AES-256-GCM avec `DATA_KEY`) et `data/status.json` (sans aucun cours).
5. Il enregistre ces fichiers dans le dépôt (commit `data: cours du AAAA-MM-JJ`).

L'app lit ces fichiers sur `raw.githubusercontent.com` à chaque ouverture (au plus toutes les 15 minutes) et garde tout l'historique dans sa base locale. Si GitHub ou EODHD sont indisponibles, l'app continue avec les derniers cours connus et l'indique en orange.

Lancement manuel : onglet **Actions › Robot du soir › Run workflow**. Il récupère alors tout l'historique manquant, quelle que soit l'heure.

## Ajouter un ETF

1. Dans l'app : **Réglages › ETF suivis › Ajouter un ETF** (nom, ticker, place `PA`, ISIN).
2. Sur GitHub, modifie `config/symbols.json` (l'app affiche un lien direct) :

```json
[
  { "symbol": "DCAM.PA", "since": "2026-08-01" },
  { "symbol": "NOUVEAU.PA", "since": "2026-10-01" }
]
```

3. Lance le robot à la main une fois.

## Bon à savoir

- GitHub met en pause les tâches planifiées d'un dépôt public sans activité depuis 60 jours. Les enregistrements quotidiens du robot entretiennent cette activité ; si GitHub envoie un e-mail de mise en pause, réactive le robot dans l'onglet Actions.
- GitHub peut retarder un passage de quelques minutes aux heures chargées : c'est pourquoi le robot passe à 7, 22, 37 et 52 minutes.
- Le symbole EODHD d'un ETF de Paris est `TICKER.PA` (ex. `DCAM.PA` pour Amundi PEA Monde, ISIN FR001400U5Q4).
