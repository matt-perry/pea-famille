# Données de marché

Ce dossier est écrit automatiquement par le robot du soir (`.github/workflows/soir.yml`).

- `prices/<symbole>.json` : cours de clôture **chiffrés** (AES-256-GCM, clé `DATA_KEY`).
  Seule l'app PEA Famille, qui connaît la clé, peut les lire.
- `status.json` : état du robot (dernière séance récupérée par symbole), sans aucun cours.

Ne modifie pas ces fichiers à la main.
