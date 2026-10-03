# Les calculs, expliqués simplement

Tous les calculs sont dans `src/core/`, sans aucun lien avec l'affichage, et vérifiés par les tests de `tests/`.
Les montants sont calculés en décimal exact (bibliothèque big.js) : pas d'erreur d'arrondi sur les centimes.

## Position sur un ETF

- **Montant d'un achat** = quantité × prix. **Total** = montant + frais.
- **PRU** (prix de revient unitaire), frais inclus, méthode du prix moyen pondéré :
  `PRU après achat = (parts avant × PRU avant + quantité × prix + frais) ÷ (parts avant + quantité)`.
- **Vente** : le PRU ne change pas. Plus-value réalisée = quantité × prix − frais − quantité × PRU.
- **Position vendue entièrement** : le PRU repart de zéro au prochain achat.
- **Division de parts** (ex. 1 → 10) : parts × 10, PRU ÷ 10, valeur inchangée.
- **Valeur** = parts × dernier cours de clôture. **Plus-value latente** = valeur − parts × PRU.

Chaque PEA a son propre calcul : une vente sur le PEA 1 utilise le PRU du PEA 1. La vue Famille additionne les deux.

## Compte

- **Versements déduits** : un PEA ne peut pas avoir de liquidités négatives. Si un achat (ou des frais) dépasse les liquidités connues, la différence est comptée comme un versement à la date de l'achat. Il suffit donc de saisir ses achats et ventes ; les versements saisis, s'il y en a, sont utilisés en priorité.
- **Versé net** = versements (saisis ou déduits) − retraits.
- **Liquidités** = versé net − achats (frais inclus) + ventes (nettes de frais) + dividendes − frais divers.
- **Investi** = coût d'achat des parts encore détenues.
- **Valeur totale** = valeur des ETF + liquidités.
- **Gain total** = valeur totale − versé net. Il est toujours égal à : plus-values latentes + réalisées + dividendes − frais divers (vérifié par les tests).
- **% du versé** = gain total ÷ versé net.

## Performance d'une période (semaine, mois, année…)

Quand on verse 500 € par mois, « valeur de fin ÷ valeur de début » mélange l'argent versé et le gain. L'app utilise donc la méthode du **rendement pondéré par le temps** (TWR) :

1. on découpe la période en séances ;
2. chaque jour, variation = (valeur du jour − versement du jour) ÷ valeur de la veille ;
3. on enchaîne les variations : (1 + v1) × (1 + v2) × … − 1.

Un versement n'est donc jamais compté comme un gain. Ce pourcentage est comparable à la performance de l'ETF lui-même.

Le gain en euros d'une période = valeur de fin − valeur de début − versements de la période.

## Rendement annualisé personnel

Le **TRI** (taux de rendement interne, « XIRR ») est le taux annuel *r* tel que chaque versement, placé à ce taux depuis sa date, donnerait exactement la valeur actuelle. Il tient compte du moment où chaque euro a été versé. Il n'est affiché qu'après 12 mois d'historique, car annualiser quelques semaines donne des chiffres trompeurs. C'est le chiffre à comparer aux hypothèses de la projection.

## Séance

Variation de la dernière séance = (valeur à la clôture − versements du jour) − valeur à la clôture précédente.

## Fraîcheur des cours

- **Réel** : cours de la dernière séance dont la clôture devrait être publiée (calendrier Euronext intégré, publication attendue avant 22 h 45).
- **Dernier cours connu** : cours plus ancien, affiché avec sa date, en orange.
- **Valeur incomplète** : un ETF détenu n'a aucun cours ; il n'est jamais valorisé à son PRU.

## Projection

Chaque mois : le versement s'ajoute, puis le capital croît du taux mensuel équivalent `(1 + taux annuel)^(1/12) − 1`, de sorte que « 6 % par an » donne exactement +6 % sur douze mois sans versement.

- Plafond : les versements d'un PEA s'arrêtent quand son versé net atteint 150 000 €.
- Inflation (option) : valeur en euros d'aujourd'hui = valeur projetée ÷ (1 + inflation)^années.
- Montants affichés arrondis au millier, bruts de prélèvements sociaux.

**Ce sont des hypothèses mathématiques, jamais des prévisions.**
