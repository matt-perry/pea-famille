# PEA Famille

Application personnelle pour suivre nos deux PEA investis en ETF : valeur, performance, historique, objectif et projection à 25 ans.
C'est une app web installée sur l'écran d'accueil de l'iPhone, hébergée et automatisée par GitHub. Ni Mac, ni Xcode, ni compte Apple développeur.

> « J'ouvre l'app et je sais immédiatement combien vaut notre portefeuille et où on en est. »

## Ce que fait la version 1.0

- Deux PEA (« PEA 1 », « PEA 2 ») et une vue **Famille** qui les additionne.
- Saisie manuelle des achats et ventes ; les versements sont déduits automatiquement (saisie possible, ainsi que retraits, dividendes, frais et divisions).
- Calcul automatique : quantité, PRU frais inclus, valeur, liquidités, plus-values latentes et réalisées, gain total.
- Performance par période (séance, semaine, mois, année, depuis le début) avec une méthode qui neutralise les versements, rendement annualisé personnel, bilan année par année.
- Cours de clôture récupérés chaque soir de séance par un robot GitHub chez EODHD, chiffrés, puis lus par l'app.
- Historique de valeur reconstruit à partir des mouvements et des cours stockés sur l'iPhone.
- Objectif de patrimoine avec anneau de progression.
- Projection à 25 ans : trois scénarios (4, 6, 8 %), plafond PEA de 150 000 € versés, inflation en option, tableau année par année.
- Sauvegarde : export JSON réimportable et export CSV des mouvements.
- Mode clair et sombre, tailles de texte de l'iPhone, fonctionnement hors ligne.

**Prochaine version** : verrouillage Face ID et notification du soir.

## Règles du projet

- **Aucune donnée inventée.** Un cours manquant n'est jamais remplacé : l'app affiche « Dernier cours connu » avec sa date, ou « Valeur incomplète ».
- **Réel, projection, hypothèse** sont toujours distingués à l'écran.
- **Confidentialité** : les mouvements et montants ne quittent jamais l'iPhone. GitHub ne voit que le code, des cours chiffrés et la clé EODHD (dans ses secrets). L'app ne demande jamais d'identifiant bancaire ou de courtier.
- **Simplicité** : pas de trading, de crypto, d'actualités, de recommandations ni d'indicateurs techniques.

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Mise en route pas à pas, jusqu'à l'icône sur l'iPhone |
| [docs/DONNEES_MARCHE.md](docs/DONNEES_MARCHE.md) | Source des cours, robot du soir, ajout d'un ETF, dépannage |
| [docs/CALCULS.md](docs/CALCULS.md) | Toutes les formules expliquées simplement |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Organisation du code et circulation des données |

## Secrets

Aucune clé n'est écrite dans le code. Deux secrets sont à créer dans **GitHub › Settings › Secrets and variables › Actions** :

| Secret | Rôle |
| --- | --- |
| `EODHD_API_KEY` | Clé gratuite eodhd.com, utilisée uniquement par le robot |
| `DATA_KEY` | Clé de chiffrement des cours, générée par l'app (Réglages › Données de marché) |

## Pour les développeurs

```bash
npm install
npm test          # tests du moteur de calcul (Vitest)
npm run dev       # app en local
npm run build     # vérification des types + construction dans dist/
```

Le robot se lance localement avec `EODHD_API_KEY=… DATA_KEY=… FORCE=1 npm run robot`.

Messages de commit : `feat:`, `fix:`, `test:`, `docs:`, `data:` (robot).
