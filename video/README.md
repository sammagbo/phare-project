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
  - **Les contrôles des rôles,** avant chaque capture, mesurent ce qui est à l'écran :
    - le contraste, de 4,5:1 ou plus, des badges « Requis » et « Optionnel » du formulaire, des étiquettes de rôle de
      l'historique et de celles des lignes de la réunion ;
    - dans les lignes de la réunion : l'étiquette finit avant le nom, le nom tient sur une ligne, et le champ de date
      laisse 28 px ou plus à son icône (sa largeur intérieure moins celle de la date affichée, ou de « jj/mm/aaaa ») ;
    - dans le planning : chaque date et heure tient sur une ligne ;
    - après l'enregistrement du cas par l'écran, le formulaire est vide et l'indication des rôles (`#role-hint`) doit
      être cachée : aucun badge ne reste allumé.

    Une ligne du journal par capture, et un résumé à la fin (le plus petit contraste par rôle à chaque endroit, le plus
    petit écart entre l'étiquette et le nom, la plus petite marge de la date, le plus grand nombre de lignes).
- **Trois variables :**
  - `PHARE_ROLE_CHECKS` : `enforce` (par défaut : un contrôle raté arrête la capture, comme la garde des noms) ou
    `report` (il est seulement noté, pour mesurer une version sans la correction) ;
  - `PHARE_COLOR_SCHEME` : `light` (par défaut) ou `dark`, le thème du navigateur ;
  - `PHARE_CAPTURE_OUT` : le dossier des captures, `video/public/phare/` par défaut. Tout autre dossier doit être dans
    `/tmp`, car la capture le vide d'abord. `PHARE_CAPTURE_LOG` choisit le journal.

  Par exemple, en mode sombre, hors du dossier de la vidéo :
  `PHARE_COLOR_SCHEME=dark PHARE_CAPTURE_OUT=/tmp/phare-sombre PHARE_CAPTURE_LOG=$HOME/phare-sombre.log node capture.mjs`.
  `demo-instance.sh` n'accepte qu'un `PHARE_DEMO_DIR` dans `/tmp`, car le `down` le supprime.
- **Les sorties** vont dans `video/public/phare/` : les captures à 2x, `manifest.json` (les cadres, en px CSS, où la
  vidéo zoome) et `text.json` (les lignes de texte visibles, pour vérifier les bords). Le journal, avec l'heure de
  l'horloge de démo, va dans `~/phare-captura.log`. Les captures et les vidéos restent hors de git.

## La vidéo

```bash
cd video && npm ci
npx remotion compositions src/index.ts     # PhareDemo, 1600x1000, 30 fps
npm run render:demo                        # out/phare-demo.mp4, .webm et -poster.webp
```

La composition `PhareDemo` (`src/PhareDemo.tsx`) reprend le moteur de la vidéo du MeetingManager
(`MeetingManagerDemo.tsx`, commit `05d4963` de `sammagbo/Controle-de-tempo-e-Assistencia`) : la bande noire de 140 px
avec le sous-titre en français à gauche et la pastille de l'heure à droite, la caméra qui zoome dans les captures, et
la boucle (la dernière image est la première). Elle lit `public/phare/manifest.json` et `public/phare/text.json`, et
`dayPlan()` arrête le rendu si une vue sort des règles :

- le texte dont parle le sous-titre à 30 px ou plus dans l'image, les étiquettes à 24 px ou plus ;
- chaque vue immobile 2,5 s ou plus, des panoramiques de 60 px CSS par seconde au plus, des transitions de 15 à 24
  images ;
- des sous-titres de 42 caractères au plus, sans toucher la pastille, et aucun nom des données de démo dans un
  sous-titre ni dans une pastille ;
- des bords nets : aucun texte coupé par le haut ou par la bande, ni à moins de 8 px d'eux, et aucun mot coupé sur
  les côtés (les formes peuvent l'être) ;
- entre 40 et 60 s, et la dernière image identique à la première.

Sept scènes, en 42,5 s : la connexion, le cas du 13/10 et ses trois élèves, l'historique, la recherche, l'équipe, un
entretien planifié à l'écran et le planning. L'affiche est l'image 1161, le milieu du planning. Les vidéos restent dans
`out/`, hors de git.
