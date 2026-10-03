# Données de marché

## Source : Yahoo Finance (sans compte)

Les cours de clôture d'Euronext Paris viennent de Yahoo Finance, interrogé chaque soir par le robot :

- aucun compte, aucune clé ;
- Yahoo refuse souvent les appels directs venant des serveurs GitHub (« 429 ») : le robot passe donc d'abord par la bibliothèque Python [yfinance](https://github.com/ranaroussi/yfinance), qui se présente comme un navigateur, puis tente l'appel direct si yfinance échoue ;
- un appel par ETF, quelle que soit la période demandée ;
- clôture disponible peu après la fin de séance (17 h 30), donc dès le premier passage du robot à 19 h 40.

À savoir : Yahoo n'offre pas d'API officielle ni de garantie. Il peut refuser ponctuellement (« 429 », trop de demandes) ou changer son format. Le robot réessaie au passage suivant, et l'app continue avec le dernier cours connu, affiché en orange avec sa date. Aucun cours n'est jamais inventé.

Les cours sont arrondis à 4 décimales pour retirer le bruit de calcul de Yahoo (ex. 6,308000087 → 6,308) ; une cotation Euronext n'a jamais plus de décimales.

Les conditions d'utilisation de Yahoo réservent ces données à un usage personnel : les cours publiés dans ce dépôt public sont donc **chiffrés**.

### Secours facultatif : EODHD

Si un secret `EODHD_API_KEY` existe, le robot interroge [EODHD](https://eodhd.com) quand Yahoo échoue (offre gratuite : 20 appels par jour, un an d'historique). Sans ce secret, seul Yahoo est utilisé.

## Le robot du soir

Fichier `.github/workflows/soir.yml`, scripts `robot/fetch-prices.ts` et `robot/yahoo.py` (yfinance, version fixée dans `robot/requirements.txt`).

1. GitHub le lance toutes les 15 minutes du lundi au vendredi, en soirée.
2. Il ne travaille qu'entre 19 h 40 et 23 h (heure de Paris), les jours de séance Euronext.
3. Tant que la clôture du jour n'est pas publiée, il n'interroge que le premier symbole (« témoin »).
4. Il écrit `data/prices/<symbole>.json` (chiffré AES-256-GCM avec `DATA_KEY`) et `data/status.json` (sans aucun cours).
5. Il enregistre ces fichiers dans le dépôt (commit `data: cours du AAAA-MM-JJ`).

L'app lit ces fichiers sur `raw.githubusercontent.com` à chaque ouverture (au plus toutes les 15 minutes) et garde tout l'historique dans sa base locale. Si GitHub ou Yahoo Finance sont indisponibles, l'app continue avec les derniers cours connus et l'indique en orange.

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
- Le symbole d'un ETF de Paris est `TICKER.PA`, identique chez Yahoo et EODHD (ex. `DCAM.PA` pour Amundi PEA Monde). Pour vérifier un symbole, cherche-le sur finance.yahoo.com.
