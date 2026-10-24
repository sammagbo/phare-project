# pHARe — Système de Gestion du Harcèlement Scolaire

Application web pour la gestion et le suivi des cas de harcèlement scolaire, le planning des entretiens, et la coordination de l'équipe pHARe.

## Architecture

```
phare-project/
├── backend/            # API REST — Spring Boot 3 + PostgreSQL
├── backend-node/       # Service d'authentification — Express + JWT + SQLite
└── frontend/           # PWA — HTML/CSS/JS vanilla + GSAP
```

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| **API principale** | Java 17, Spring Boot 3.2, JPA/Hibernate, PostgreSQL |
| **Auth service** | Node.js, Express 5, JWT, bcrypt, SQLite |
| **Frontend** | HTML5, CSS3 (vanilla), ES Modules, GSAP |
| **PWA** | Service Worker, Web App Manifest |

## Endpoints API

### Cas (`/api/cas`)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/cas` | Lister tous les cas |
| `GET` | `/api/cas?search=nom` | Rechercher par nom d'élève |
| `GET` | `/api/cas/{id}` | Obtenir un cas par ID |
| `POST` | `/api/cas` | Créer un nouveau cas |
| `PUT` | `/api/cas/{id}` | Modifier un cas |
| `DELETE` | `/api/cas/{id}` | Supprimer un cas |

### Entretiens (`/api/entretiens`)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/entretiens` | Entretiens planifiés |
| `GET` | `/api/entretiens/pending` | Élèves en attente |
| `PUT` | `/api/entretiens/{eleveId}` | Planifier un entretien |
| `DELETE` | `/api/entretiens/{eleveId}` | Annuler un entretien |

### Membres (`/api/membres`)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/membres` | Lister l'équipe |
| `POST` | `/api/membres` | Ajouter un membre |
| `DELETE` | `/api/membres/{id}` | Retirer un membre |

### Auth (`/api/auth`)
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/auth/login` | Connexion : le token d'accès dans la réponse, la session dans le cookie `phare_refresh` |
| `POST` | `/api/auth/refresh` | Un nouveau token d'accès, avec le cookie (corps JSON) |
| `POST` | `/api/auth/logout` | Déconnexion, avec le cookie (corps JSON) : `204` |
| `GET` | `/api/auth/me` | Le compte du token d'accès |

## Lancement

### Mode automatique (recommandé)
Pour lancer les trois services d'un coup (authentification, API et frontend) :
```bash
./run_phare.sh
```
Le script génère le secret partagé s'il n'est pas défini, puis ouvre le navigateur sur `http://localhost:8000/login.html`.
À la première utilisation, créez un compte (voir « Les comptes », dans « Sécurité ») : il n'y a pas d'inscription par le
site, et personne ne se connecte sans compte.

### Mode manuel
Les deux services ont besoin du même `JWT_SECRET` (voir « Sécurité ») :
```bash
export JWT_SECRET="$(openssl rand -base64 48)"
```

#### Service d'authentification (port 3000)
```bash
cd backend-node
npm ci
node server.js
```

#### API Java (port 8080)
```bash
cd backend
mvn spring-boot:run
```

#### Frontend (port 8000)
```bash
cd frontend
python3 -m http.server 8000
```

Puis créez le premier compte (voir « Les comptes »).

## Sécurité

Seules les personnes qui ont un compte, créé par l'administrateur, lisent ou modifient les données.

### Le token d'accès
Le service d'authentification (`backend-node`) signe un token d'accès à la connexion et à chaque renouvellement.
L'API (`backend`) l'exige sur tous ses endpoints et répond `401` sans token valide. Les deux suivent le même contrat :
- **la signature :** HS256, avec pour clé les octets UTF-8 de `JWT_SECRET`, que les deux services partagent ;
- **les claims :** `iss` = `phare-auth`, `aud` = `phare-api`, `sub` = l'id de l'utilisateur, `email`, `iat`, et
  `exp` = `iat` + 15 min ;
- **les vérifications :** l'API contrôle la signature (HS256 seulement), la validité (`exp` et `nbf`, avec une marge de
  60 s), l'émetteur et le public ; le `requireAuth` du service d'authentification contrôle les mêmes.

Sans token, la réponse est `401` avec `WWW-Authenticate: Bearer` ; avec un token invalide ou expiré, `401` avec
`WWW-Authenticate: Bearer error="invalid_token"` (RFC 6750). Le frontend garde le token d'accès **en mémoire
seulement**, jamais dans le `localStorage`, et ne le renouvelle que sur un `401`, une seule fois.

### La session
- **Le cookie.** La session tient dans le cookie `phare_refresh` : `HttpOnly` (aucun script ne le lit), `SameSite=Strict`,
  `Path=/api/auth`, valable 7 jours. Il n'est `Secure` que si la requête arrive en HTTPS : en http, sur `localhost` et
  sur le réseau local de l'établissement, le navigateur refuserait un cookie `Secure`, et personne ne resterait
  connecté. Servi directement en HTTPS, il devient `Secure` de lui-même ; derrière un proxy HTTPS, il faut d'abord
  régler le `trust proxy` d'Express, sans quoi le service ne voit pas que la requête est arrivée en HTTPS.
- **À l'ouverture d'une page,** le frontend demande un token d'accès au service, avec le cookie. Sans session valide,
  il efface les données pHARe du navigateur et revient à la connexion ; si le service d'authentification ne répond
  pas, il revient à la connexion avec « Serveur de connexion injoignable. Réessayez plus tard. », sans afficher les
  données gardées. Il n'y a pas de connexion de démonstration.
- **La rotation.** Chaque renouvellement remplace le refresh token : l'ancien meurt, le nouveau part dans le cookie. La
  base ne garde que son empreinte SHA-256, jamais le token. Un token déjà remplacé qui revient met fin à toute la
  session (chaque connexion ouvre une session à part). Pendant les 30 s qui suivent le remplacement, l'ancien token
  sert encore une fois, pour un token d'accès seulement : c'est le cas de deux onglets qui se renouvellent ensemble.
- **La déconnexion** prévient toujours le service, qui met fin à la session et efface le cookie, puis le frontend
  efface du `localStorage` les cas, les membres, les réunions et les anciennes clés de tokens.
- **Le CSRF.** Le renouvellement et la déconnexion n'acceptent qu'un corps `application/json` (`415` sinon). Avec
  `SameSite=Strict` et la liste des origines, un formulaire d'un autre site ne peut pas les déclencher.
- **Les limites, par adresse IP :** 10 connexions échouées en 15 minutes, puis `429` pour toute connexion depuis
  cette adresse, bon mot de passe compris, jusqu'à la fin des 15 minutes (une connexion réussie ne compte pas) ;
  60 renouvellements en 15 minutes ; 100 requêtes en 15 minutes en tout, sur le service d'authentification.
- **La mise à jour.** Les versions précédentes gardaient le refresh token en clair, dans le `localStorage` et dans la
  base. Au premier démarrage de cette version, l'ancienne table est supprimée : les sessions ouvertes se terminent, et
  chacun se reconnecte une fois.

### Le secret
`JWT_SECRET` doit faire 32 octets ou plus. Sans lui, ou plus court, **aucun des deux services ne démarre**, avec un
message clair : il n'existe de secret de secours nulle part. `./run_phare.sh` en génère un pour la session s'il n'est
pas défini ; pour garder les sessions d'un lancement à l'autre, définissez-le vous-même, dans l'environnement des deux
services (pour le service d'authentification, le fichier `backend-node/.env` convient : voir
`backend-node/.env.example`).

### Le CORS
Les deux services n'acceptent que les origines du frontend, listées dans `PHARE_ALLOWED_ORIGINS`, séparées par des
virgules. Par défaut : `http://localhost:8000,http://127.0.0.1:8000`. Pour les tablettes du réseau local, ajoutez
l'adresse du PC :
```bash
export PHARE_ALLOWED_ORIGINS="http://localhost:8000,http://127.0.0.1:8000,http://<IP du PC>:8000"
```

### Les comptes
Il n'y a pas d'inscription : les comptes se créent sur le serveur, dans le terminal, avec un script. Le mot de passe
est lu sans écho, pour qu'il n'apparaisse ni à l'écran ni dans l'historique :
```bash
cd backend-node
read -rs PHARE_PASSWORD && export PHARE_PASSWORD
node scripts/create-user.js prenom.nom@example.com
unset PHARE_PASSWORD
```
Le mot de passe fait 8 caractères ou plus, avec une majuscule, une minuscule, un chiffre et un symbole, et l'adresse ne
doit pas déjà avoir de compte. Le script utilise la base du service (`PHARE_DB_PATH`, ou `backend-node/database.sqlite`)
et crée ses tables si elle est neuve.

## Modèle de Données

```
Cas (1) ──── (*) Eleve
                  ├── nom, classe, type (VICTIME|TEMOIN|INTIMIDATEUR)
                  ├── membre, lie_a
                  └── dateEntretien, heureEntretien, membreEntretien

Membre
  └── id, nom (unique)
```

## Mode Hors-Ligne

Le mode hors-ligne ne vaut qu'avec une **session valide** et l'API Java injoignable : la page s'ouvre, le service
d'authentification confirme la session, et c'est seulement l'API qui ne répond pas. Sans session, ou sans service
d'authentification, la page revient à la connexion et n'affiche rien de ce qui est gardé.

Dans ce cas, le frontend fonctionne grâce à :
- **localStorage** comme fallback pour les cas et les entretiens
- **Service Worker** pour le cache des assets
- Indicateur visuel `🟢 API connectée` / `🔴 Mode hors-ligne`

## Licence

© 2026 Sammy K. Magbo. pHARe est le programme de lutte contre le harcèlement du ministère de l'Éducation nationale ; cet outil est un projet indépendant, sans lien officiel avec le ministère.
