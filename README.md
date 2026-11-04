# Compteur de Clicks

Un site pour tester ta vitesse de clicks directement dans le navigateur, avec 5 modes de jeu, des rangs et des succès.

**Jouer en ligne : https://turbonix-x.github.io/compteur-de-clicks/**

Ça marche sur ordi, tablette et téléphone, et il n'y a rien à installer.

## Les modes de jeu

- ⏱️ **Chrono** : le plus de clicks possible avant la fin du temps. La durée se règle exactement, de **0,1 s à 5 h**.
- 🏁 **Objectif** : fais le nombre de clicks que tu as choisi (par exemple 100) le plus vite possible.
- 🎯 **Cibles** : touche les cibles qui bougent. Tu choisis le **niveau de difficulté (1 à 100)**, le temps, la **taille** des cibles et **combien s'affichent en même temps**. Plus le niveau monte, plus elles vont vite, changent de direction et s'échappent tôt. À la fin : les cibles touchées, ta précision et celles qui se sont échappées.
- 🎹 **Alternance** : appuie chacun leur tour sur **2 à 8 touches de ton choix** sur le clavier, ou **2 à 8 boutons** sur le site. La prochaine est en jaune. Une erreur ne compte pas et casse ta série.
- 🔋 **Endurance** : tiens la vitesse de ton choix le plus longtemps possible. Tu as 2 secondes pour prendre ton rythme, puis on regarde sans arrêt tes 2 dernières secondes. Si tu descends en dessous, c'est fini.

Le chrono part au premier click (qui compte déjà), ou après un compte à rebours 3, 2, 1. **Espace** lance et **Échap** arrête (un test arrêté ne compte pas dans les statistiques).

## Rangs et succès

Tout ça reste sur ton appareil : rien n'est envoyé en ligne.

- **10 rangs**, de l'escargot à Turbo : 🐌 Escargot, 🐢 Tortue (3 CPS), 🐭 Souris (5), 🐇 Lapin (7), 🦊 Renard (9), 🐎 Cheval (11), 🐆 Guépard (13), 🦅 Faucon (16), ⚡ Éclair (20) et 🚀 **Turbo (50 CPS, presque impossible à la main)**.
- **4 succès** : 10, 100, 500 et 1 000 CPS.
- Le rang et les succès se basent sur ta **meilleure pointe** : le plus de clicks réussis pendant une seule seconde, dans n'importe quel mode. Un test très court ne fausse donc pas le calcul.
- Un **compteur de clicks depuis le début**. La 🗑 du header le remet à zéro, seul ou avec tout le reste (elle demande confirmation avant).

## Les effets

- Une **petite onde à chaque click**, qu'on peut couper.
- Le **gros bouton tremble** de plus en plus fort à partir de 7 CPS (on peut aussi le couper).
- Un petit son à chaque click, qu'on peut couper aussi.
- Feu d'artifice pour un nouveau record, un nouveau rang ou un succès.

## Encaisser le plus de clicks possible

- Les clicks sont comptés dès que le bouton ou le doigt touche l'écran (`pointerdown`), sans attendre qu'on relâche. Sur téléphone, **chaque doigt compte**.
- Un click ne fait qu'ajouter 1 à quelques nombres : l'affichage, lui, est mis à jour une fois par image. 1 200 clicks d'un coup sont traités en environ 4 millisecondes.
- Les effets sont limités pour ne jamais ralentir le comptage.
- Un click arrivé après la fin du chrono n'est pas compté, même si le navigateur est occupé.

## Statistiques

Pour chaque mode : nombre de tests, meilleure vitesse, vitesse moyenne, un graphique de ta vitesse pendant le dernier test, un **record pour chaque réglage** et l'historique des 60 derniers tests. Les **10 derniers tests** tous modes confondus sont juste sous le bouton.

## Le reste

- Mode clair et mode sombre.
- Sons et vibrations (sur téléphone), qu'on peut couper en haut de la page.
- Tout est sauvegardé automatiquement dans le navigateur, même pendant un long test.
- On peut télécharger sa sauvegarde dans un fichier et la recharger plus tard.
- **Lien de partage** : le bouton 🔗 crée un lien avec ton mode et tes réglages, et peut lancer un **défi** avec ton record.

## Utiliser le site chez soi

Télécharger le dossier et ouvrir `index.html` dans un navigateur, c'est tout.

## Comment c'est fait

Du HTML, du CSS et du JavaScript, sans framework.

| Fichier | Contenu |
|---|---|
| `index.html` | La page |
| `style.css` | Le style propre au compteur |
| `js/app.js` | Les modes, le comptage, les rangs, les stats, la sauvegarde, le partage |
| `js/targets.js` | Les cibles qui bougent |
| `js/sound.js` | Les sons et les vibrations |
| `logo.svg` | Le logo Turbonix |
| `turbonix.css` | Le style commun des sites Turbonix |
| `STYLE-TURBONIX.md` | Le guide de style Turbonix |

---

Turbonix Entertainment
