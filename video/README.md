# Vidéo du portfolio : les vrais écrans, avec des données fictives

La vidéo de démonstration de pHARe pour sa carte sur sammagbo.com, sous-titrée en français. Elle montre les vrais
écrans de l'application, dans une instance locale de démo : la connexion, un nouveau cas avec trois élèves,
l'historique et sa recherche, l'équipe, puis la planification des entretiens de la réunion pHARe. Aucune donnée réelle,
aucune production.

## Ce qu'il faut

- Docker, Node 22 ou plus, Python 3 et Chrome (`CHROME=/chemin` s'il n'est pas dans `/usr/bin/google-chrome`).
- Les ports 55432 et 8080 libres, et les ports 3000 et 8000 libres sur `127.0.0.2`. Les scripts n'arrêtent aucun
  processus.

## Les captures

```bash
cd video/capture && npm ci
./demo-instance.sh up             # bases neuves, API, service de connexion et frontend sur 127.0.0.2, compte de démo
node seed.mjs                     # l'équipe et les cas fictifs, par l'API
node capture.mjs                  # les écrans, dans video/public/phare/
node contact-sheet.mjs ../public/phare
./demo-instance.sh down           # arrête et supprime les conteneurs, le volume et les fichiers de la démo
```

- **L'instance** (`demo-instance.sh`) : tout écoute sur `127.0.0.2`, car le frontend appelle les ports 3000 et 8080
  de son propre hôte.
  - PostgreSQL dans le conteneur `phare-demo-db`, avec le volume `phare-demo-pgdata`, supprimés à chaque `up` et `down`.
  - L'API (`phare-demo-api`) part d'une copie de `backend/` dans `/tmp/phare-demo`, avec `DATABASE_URL` vers cette
    base et aucune autre.
  - Le service de connexion part d'une copie de `backend-node/` (sans son `.env` ni son `database.sqlite`), avec un
    SQLite dans `/tmp/phare-demo`.
  - Un `JWT_SECRET` neuf à chaque fois.
- **Le compte** `demo@example.com` naît de `backend-node/scripts/create-user.js`. Son mot de passe, tiré à chaque
  `up`, reste dans `/tmp/phare-demo/demo-password` (0600) et n'est jamais affiché.
- **Les données** sont dans `backend/src/test/resources/demo/phare-demo.json`. Tous les noms sont inventés, avec le
  nom de famille Exemple, Démo, Fictif ou Fictive.
  - Une équipe de cinq membres et sept cas, du 10/09 au 09/10/2026, que `seed.mjs` enregistre par l'API. Il refuse
    d'écrire si la base a déjà un cas ou un membre.
  - Le cas du 13/10, que la capture remplit et enregistre par l'écran.
  - Les entretiens du 14 au 16/10.
- **La capture** (`capture.mjs`) se déroule le mardi 13/10/2026, à Paris, en `fr-FR`.
  - L'horloge du navigateur est celle de la démo : arrêtée, puis avancée pas à pas, et les animations GSAP vont
    jusqu'au bout avant chaque capture.
  - Seules passent les requêtes vers `127.0.0.2`, les polices de Google et cdnjs (GSAP) ; le reste est bloqué et noté.
    Le service worker est bloqué.
  - Avant chaque capture, la garde lit les noms à l'écran et s'arrête si l'un d'eux n'est pas dans les données.
  - Les écrans longs sont capturés dans une fenêtre aussi haute que la page, pour que les éléments fixes (le toast
    caché, la barre d'actions de la réunion) restent à leur place.
- **Les sorties** vont dans `video/public/phare/` : les captures à 2x, `manifest.json` (les cadres, en px CSS, où la
  vidéo zoome) et `text.json` (les lignes de texte visibles, pour vérifier les bords). Le journal, avec l'heure de
  l'horloge de démo, va dans `~/phare-captura.log`. Les captures et les vidéos restent hors de git.
