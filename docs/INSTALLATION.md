# Installation pas à pas

Durée : 20 à 30 minutes, une seule fois. Il faut un compte GitHub, un iPhone sous iOS 16.4 ou plus, et un ordinateur pour l'envoi des fichiers.

Aucun compte chez un fournisseur de cours n'est nécessaire : le robot lit les clôtures chez Yahoo Finance.

## 1. (Facultatif) Clé EODHD de secours

Si un jour Yahoo Finance ne répond plus, le robot peut utiliser EODHD à la place. Crée alors un compte gratuit sur [eodhd.com](https://eodhd.com), copie ton **API key** et ajoute-la en secret `EODHD_API_KEY` (étape 6). Sans cette clé, tout fonctionne avec Yahoo seul.

## 2. Créer le dépôt GitHub

1. Va sur [github.com/new](https://github.com/new).
2. Nom : `pea-famille`. Visibilité : **Public** (obligatoire pour GitHub Pages gratuit ; le dépôt ne contient aucune donnée personnelle).
3. Ne coche rien d'autre, puis **Create repository**.

## 3. Envoyer les fichiers

### Option A — depuis le navigateur (le plus simple)

1. Décompresse l'archive `pea-famille.zip`.
2. Sur le Mac, ouvre le dossier `pea-famille` dans le Finder et appuie sur **Cmd + Maj + .** pour afficher les fichiers cachés : le dossier `.github` et le fichier `.gitignore` doivent apparaître.
3. Sur la page du dépôt vide, clique sur **uploading an existing file**.
4. Sélectionne **tout le contenu** du dossier `pea-famille` (pas le dossier lui-même) et glisse-le dans la page.
5. Clique sur **Commit changes**.
6. Vérifie que le dépôt affiche bien les dossiers `.github`, `config`, `src`, etc.

### Option B — avec GitHub Desktop (recommandé pour les mises à jour)

1. Installe [GitHub Desktop](https://desktop.github.com) et connecte ton compte.
2. **File › Clone repository** › `pea-famille`, dans un dossier de ton choix.
3. Copie le contenu de l'archive dans ce dossier, puis **Commit to main** et **Push origin**.

Pour les évolutions suivantes, tu pourras connecter ce dossier à Claude : les fichiers seront écrits directement dedans, il te restera à cliquer sur Commit puis Push.

## 4. Activer la publication et le robot

1. Dans le dépôt : **Settings › Pages** › Source : **GitHub Actions**.
2. **Settings › Actions › General** › Workflow permissions : **Read and write permissions** › Save.
3. Onglet **Actions** › **Publier l'app** › **Run workflow** (si la première publication a échoué parce que Pages n'était pas encore activé).
4. Attends la coche verte (1 à 2 minutes). L'adresse de l'app est `https://<ton-compte>.github.io/pea-famille/`.

## 5. Installer l'app sur l'iPhone

1. Ouvre l'adresse dans **Safari**.
2. Bouton **Partager** › **Sur l'écran d'accueil** › Ajouter.
3. Lance **PEA Famille** depuis l'icône, puis **Commencer**.

## 6. Brancher les cours

1. Dans l'app : **Réglages** (roue dentée) › **Données de marché** › **Générer une clé** › **Copier la clé**.
2. Sur GitHub : **Settings › Secrets and variables › Actions › New repository secret**
   - Nom `DATA_KEY`, valeur : la clé copiée depuis l'app.
   - Facultatif : nom `EODHD_API_KEY`, valeur : ta clé EODHD (secours).
3. Onglet **Actions** › **Robot du soir** › **Run workflow**. Attends la coche verte.
4. Dans l'app : **Données de marché** › **Actualiser maintenant**. La date du dernier cours de DCAM.PA apparaît.

Astuce : copier sur l'iPhone et coller sur le Mac fonctionne directement si les deux appareils utilisent le même compte Apple.

## 7. Saisir l'historique

1. Onglet **Mouvements** › **+**.
2. Saisis tes **achats** (et ventes) depuis début septembre : compte, date, quantité, prix, frais.
3. Pas besoin de saisir les versements : chaque achat non couvert par les liquidités est compté comme un versement du même jour.
4. Le récapitulatif en bas du formulaire montre le PRU après chaque achat : compare-le avec Trade Republic.

## 8. Sauvegarder

**Réglages › Sauvegarde › Exporter une sauvegarde complète** › Enregistrer dans Fichiers (iCloud Drive). À refaire une fois par mois ; l'app te le rappelle.

## En cas de problème

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| La page GitHub Pages affiche 404 | Pages pas encore activé | Étape 4, puis relancer « Publier l'app » |
| Robot du soir en rouge : « Secret DATA_KEY manquant » | Secret absent ou mal nommé | Étape 6.2, nom exact en majuscules |
| État du robot : « Yahoo Finance a répondu 429 » | Trop de demandes chez Yahoo | Rien à faire : nouvel essai au passage suivant (15 min) |
| État du robot : « Yahoo Finance a répondu 404 » ou « No data found » | Symbole inconnu chez Yahoo | Vérifier le symbole dans `config/symbols.json` (ex. `DCAM.PA`) |
| « EODHD a répondu 401 » | Clé EODHD de secours erronée | Recopier la clé dans le secret `EODHD_API_KEY`, ou supprimer ce secret |
| Robot en rouge à l'étape « Enregistrer dans le dépôt » | Droits d'écriture manquants | Étape 4.2 |
| L'app indique « impossible de déchiffrer » | La clé de l'app diffère du secret | Recopier la clé de l'app dans `DATA_KEY`, relancer le robot |
| « Dernier cours connu » en orange depuis plusieurs jours | Robot en panne ou en veille | Onglet Actions : vérifier « Robot du soir », le réactiver si GitHub l'a mis en pause |
