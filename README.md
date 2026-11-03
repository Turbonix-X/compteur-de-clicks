# Compteur de Clicks

Un test de vitesse de clicks dans le navigateur : tu choisis la durée, tu lances, et tu cliques le plus vite possible.

**Jouer en ligne : https://turbonix-x.github.io/compteur-de-clicks/**

Ça marche sur ordi, tablette et téléphone, et il n'y a rien à installer.

## Ce qu'on peut faire

### Le test

- Choisir la **durée exacte** du test, de **0,1 s à 5 h** (heures, minutes et secondes, avec les dixièmes), ou avec les boutons rapides (1 s, 5 s, 10 s, 15 s, 30 s, 1 min, 2 min, 5 min, 10 min, 30 min, 1 h, 5 h). Un 🎲 tire une durée au hasard.
- Deux façons de démarrer :
  - **Au premier click** (par défaut) : le chrono part au premier click, qui compte déjà. On peut aussi cliquer directement dans la zone pour lancer.
  - **Compte à rebours** : 3, 2, 1, puis le chrono part tout seul.
- Pendant le test : le nombre de clicks en grand, le temps restant, la vitesse en direct (clicks pendant la dernière seconde) et une barre de progression.
- **Échap** ou le bouton « Arrêter » abandonne le test (il ne compte pas dans les stats).
- Option pour que **les touches du clavier comptent aussi** (rester appuyé ne compte qu'une fois).
- Sur téléphone, **chaque doigt compte** : on peut taper avec plusieurs doigts en même temps.
- Pendant un test, l'écran ne se met pas en veille (sur les navigateurs qui le permettent).

### Encaisser le plus de clicks possible

- Les clicks sont comptés dès que le bouton ou le doigt touche l'écran (`pointerdown`), sans attendre qu'on relâche.
- Un click ne fait qu'ajouter 1 à quelques nombres : l'affichage, lui, est mis à jour une fois par image. Le site encaisse ainsi des dizaines de milliers de clicks par seconde (environ 3 microsecondes par click mesurées).
- Les effets (ondes, petits sons, vibrations) sont limités pour ne jamais ralentir le comptage, et on peut les couper.
- Un click arrivé après la fin du chrono n'est pas compté, même si le navigateur est occupé.

### Statistiques

- Nombre de tests, meilleure vitesse, vitesse moyenne et clicks au total.
- Un graphique de **ta vitesse pendant le dernier test**, avec ton pic en jaune.
- Un **record pour chaque durée** ; cliquer sur une ligne remet cette durée.
- Les **10 derniers tests** et l'historique des 60 derniers.
- Un titre selon ta vitesse : 🐢 Tortue, 🐇 Lapin, 🐆 Guépard, ⚡ Éclair, 🚀 Fusée, 🤖 Turbo-robot.
- Nouveau record : gros message « NOUVEAU RECORD ! », feu d'artifice et fanfare.

### Le reste

- Mode clair et mode sombre.
- Sons et vibrations (sur téléphone), qu'on peut couper en haut de la page.
- Tout est sauvegardé automatiquement dans le navigateur. Un bouton permet de tout effacer (il demande confirmation avant).
- On peut télécharger sa sauvegarde dans un fichier et la recharger plus tard.
- **Lien de partage** : le bouton 🔗 crée un lien avec la durée et les réglages, et peut lancer un **défi** avec ton record. Ton ami voit « Défi : bats 87 clicks » et a droit à « DÉFI RÉUSSI ! » s'il y arrive.

## Utiliser le site chez soi

Télécharger le dossier et ouvrir `index.html` dans un navigateur, c'est tout.

## Comment c'est fait

Du HTML, du CSS et du JavaScript, sans framework.

| Fichier | Contenu |
|---|---|
| `index.html` | La page |
| `style.css` | Le style propre au compteur |
| `js/app.js` | Le test, les stats, la sauvegarde, le partage |
| `js/sound.js` | Les sons et les vibrations |
| `logo.svg` | Le logo Turbonix |
| `turbonix.css` | Le style commun des sites Turbonix |
| `STYLE-TURBONIX.md` | Le guide de style Turbonix |

---

Turbonix Entertainment
