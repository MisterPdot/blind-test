# Blind Test 🎵

Un jeu de blind test pour iPhone : on écoute un extrait de 30 s et on devine le **titre**, l'**artiste**
ou le **film**, en solo ou entre amis.

C'est une **application web installable**. Une fois ajoutée à l'écran d'accueil, elle s'ouvre en plein écran
avec son icône, comme une app de l'App Store, sans Mac, sans App Store et gratuitement.

## Contenu

- **26 catégories** :
  - **Genres** : Pop, Rock, Rap FR, Rap US, Électro, Chanson française, Pop française, R&B, Jazz, Reggae, Métal, Disco, Classique, K-pop.
  - **Époques** : des années 60 aux années 2020.
  - **Thèmes** : Mix surprise, Disney, Musiques de films, Comédies musicales, Tubes de l'été.
- **Solo** : 10, 15 ou 20 morceaux, avec un bonus de rapidité, un bonus de série (3 bonnes réponses d'affilée) et un record par catégorie.
- **Entre amis, sur un seul téléphone** :
  - *Chacun son tour* : on se passe le téléphone (2 à 6 joueurs).
  - *Soirée* : un animateur tient le téléphone, tout le monde écoute, et le premier qui crie la bonne réponse marque le point.
- **Réponses** : 4 propositions, ou réponse tapée. La réponse tapée tolère les fautes, les accents oubliés et les « The / Le / La ».
- **Récapitulatif** en fin de partie : on peut réécouter chaque extrait ou l'ouvrir dans Apple Music.

## Les extraits musicaux

Les extraits viennent de l'**API publique d'Apple (iTunes Search)**. Ce sont les extraits officiels de 30 s, gratuits,
sans compte et sans clé. Le catalogue utilisé est le catalogue **français**.

- **Internet est nécessaire pendant le jeu.**
- Apple limite à environ 20 recherches par minute. Une partie en utilise environ 6, et les résultats sont gardés 3 jours sur le
  téléphone. Si on lance beaucoup de parties d'affilée, le jeu demande poliment d'attendre une minute.
- Pour chaque artiste, les morceaux sont tirés parmi les plus populaires selon Apple. De temps en temps, un titre moins connu
  peut quand même sortir.

## Installer sur l'iPhone

L'app doit être servie par une adresse **https**. Deux possibilités :

1. **Hébergement gratuit (recommandé)** : GitHub Pages, Netlify ou Cloudflare Pages. On y dépose ce dossier tel quel :
   pas de compilation, ce sont de simples fichiers.
2. **Essai rapide sur le Wi-Fi de la maison** : sur le PC, lancez `python -m http.server 8080` dans ce dossier, puis
   ouvrez `http://<adresse-IP-du-PC>:8080` dans Safari sur l'iPhone. Le jeu marche tant que le PC est allumé.

Ensuite, dans **Safari**, touchez **Partager ⬆︎**, puis **« Sur l'écran d'accueil »**. Le jeu affiche lui-même ce conseil.

## Pour les développeurs

- Le code est en JavaScript « pur » (modules ES), sans framework ni compilation.
  - `js/categories.js` : les catégories. Pour **ajouter un thème**, il suffit d'ajouter une entrée avec une liste d'artistes.
  - `js/music.js` : la recherche des extraits, le nettoyage des titres et la construction de la playlist.
  - `js/game.js` : les règles, les propositions, la correction des réponses tapées et les points.
  - `js/app.js` : l'interface.
  - `js/audio.js` : le son, avec le déblocage audio d'iOS.
  - `js/storage.js` : les réglages et les records.
- **Tests** : `.venv\Scripts\python -m pytest tests`. Ils comprennent 30 tests de logique et 12 parties complètes jouées
  automatiquement dans un iPhone simulé, avec des extraits factices.
- **Vérification réelle du catalogue Apple** : `python tests/live_check.py`. Elle prend environ 15 minutes à cause de la limite d'Apple.
