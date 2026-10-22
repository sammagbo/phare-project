# pHARe API v2 — Spring Boot + PostgreSQL

API REST pour la gestion des cas de harcèlement scolaire, avec persistance PostgreSQL.

## Prérequis

- **Java 17+** → `java -version`
- **Maven 3.8+** → `mvn -version`
- **PostgreSQL 14+** → `psql --version`

## 1. Configurer PostgreSQL

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Créer la base de données et l'utilisateur
CREATE DATABASE phare_db;
CREATE USER phare_user WITH PASSWORD 'phare_password';
GRANT ALL PRIVILEGES ON DATABASE phare_db TO phare_user;

# Autoriser la création de tables
\c phare_db
GRANT ALL ON SCHEMA public TO phare_user;

\q
```

## 2. Lancer l'API

L'API exige, sur tous ses endpoints, le token d'accès signé par le service d'authentification (`backend-node`). Les
deux partagent le secret `JWT_SECRET`, de 32 octets ou plus : sans lui, ou avec un secret plus court, l'API refuse de
démarrer (voir « Sécurité » dans le [README principal](../README.md)).

```bash
cd backend
export JWT_SECRET="<le secret du service d'authentification>"
mvn spring-boot:run
```

Le serveur démarre sur **http://localhost:8080**.
Les tables `cas`, `eleves` et `membres` sont créées automatiquement (ddl-auto=update).

`./run_phare.sh`, à la racine du projet, lance d'un coup l'API, le service d'authentification et le frontend, avec le
même secret.

## 3. Vérifier

Sans token, l'API répond `401` :

```bash
curl -i http://localhost:8080/api/cas
```

Avec le service d'authentification lancé sur le port 3000 et un compte (voir « Les comptes » dans le README
principal), demandez un token d'accès, valable 15 minutes. Le mot de passe est lu sans écho :

```bash
read -rs PHARE_PASSWORD && export PHARE_PASSWORD
TOKEN=$(node -e '
  fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.argv[1], password: process.env.PHARE_PASSWORD }),
  }).then((r) => r.json()).then((j) => (j.token ? console.log(j.token) : console.error(j.error)));
' prenom.nom@example.com)
unset PHARE_PASSWORD
```

Chaque requête porte ensuite le token dans l'en-tête `Authorization` :

```bash
# Créer un cas
curl -X POST http://localhost:8080/api/cas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-04-10",
    "heure": "10:30",
    "eleves": [
      { "nom": "Jean Dupont", "type": "VICTIME", "membre": "Membre A" },
      { "nom": "Marie Martin", "type": "TEMOIN", "membre": "Membre B" }
    ]
  }'

# Lister
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/cas

# Rechercher par nom d'élève
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/cas?search=jean"

# Modifier
curl -X PUT http://localhost:8080/api/cas/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-04-10","heure":"14:00","eleves":[{"nom":"Jean Dupont","type":"VICTIME","membre":"Membre A"}]}'

# Supprimer
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/cas/1
```

## 4. Tester

```bash
cd backend
mvn test
```

Les tests (`ApiSecurityTest`) tournent sur une base H2 en mémoire, sans PostgreSQL, avec un secret réservé aux tests.
Ils vérifient :
- le `401` sans token sur `/api/cas`, `/api/entretiens` et `/api/membres`, et le `200` avec un token valide ;
- le `401` pour un token signé avec un autre secret, expiré, d'un autre émetteur ou destiné à un autre public ;
- le CORS : l'origine du frontend acceptée, une autre refusée ;
- le refus d'un secret vide, absent ou de moins de 32 octets.

## Structure du projet

```
backend/
├── pom.xml
├── README.md
└── src/
    ├── main/
    │   ├── java/com/phare/
    │   │   ├── PhareApplication.java         ← Point d'entrée
    │   │   ├── controller/
    │   │   │   ├── CasController.java        ← /api/cas
    │   │   │   ├── EntretienController.java  ← /api/entretiens
    │   │   │   └── MembreController.java     ← /api/membres
    │   │   ├── model/
    │   │   │   ├── Cas.java                  ← Entité JPA (@OneToMany)
    │   │   │   ├── Eleve.java                ← Entité JPA (@ManyToOne)
    │   │   │   ├── Membre.java               ← Entité JPA
    │   │   │   └── TypeEleve.java            ← Enum
    │   │   ├── repository/
    │   │   │   ├── CasRepository.java        ← JpaRepository<Cas, Long>
    │   │   │   ├── EleveRepository.java      ← JpaRepository<Eleve, Long>
    │   │   │   └── MembreRepository.java     ← JpaRepository<Membre, Long>
    │   │   ├── security/
    │   │   │   └── SecurityConfig.java       ← Token d'accès obligatoire + CORS
    │   │   └── service/
    │   │       ├── CasService.java           ← Logique métier + transactions
    │   │       └── MembreService.java        ← L'équipe (noms uniques)
    │   └── resources/
    │       └── application.properties        ← PostgreSQL, JPA, secret et CORS
    └── test/
        ├── java/com/phare/security/
        │   └── ApiSecurityTest.java          ← Token et CORS (MockMvc + H2)
        └── resources/
            └── application.properties        ← H2 et secret de test
```

## Schéma de la base de données

```
┌──────────────────┐       ┌───────────────────────────────┐
│       cas        │       │             eleves            │
├──────────────────┤       ├───────────────────────────────┤
│ id       BIGINT  │◄──────│ cas_id            BIGINT (FK) │
│ date     VARCHAR │       │ id                BIGINT      │
│ heure    VARCHAR │       │ nom               VARCHAR     │
└──────────────────┘       │ classe            VARCHAR     │
                           │ type              VARCHAR     │
                           │ membre            VARCHAR     │
                           │ lie_a             VARCHAR     │
                           │ date_entretien    VARCHAR     │
                           │ heure_entretien   VARCHAR     │
                           │ membre_entretien  VARCHAR     │
                           └───────────────────────────────┘
          1 ─────────────────── N

┌───────────────────────────┐
│          membres          │
├───────────────────────────┤
│ id       BIGINT           │
│ nom      VARCHAR (unique) │
└───────────────────────────┘
```

## Points clés

- **Token d'accès** : chaque requête porte `Authorization: Bearer <token>` ; sans token valide, l'API répond `401`
- **CascadeType.ALL** : créer/modifier/supprimer un cas gère automatiquement ses élèves
- **orphanRemoval=true** : un élève retiré de la liste est supprimé de la BDD
- **@JsonIgnore** sur `Eleve.cas` : évite la boucle infinie dans le JSON
- **Même API** : les endpoints sont identiques à la v1, le frontend existant fonctionne sans modification
- **Recherche** : `GET /api/cas?search=nom` filtre par nom d'élève

## Personnalisation

Les identifiants PostgreSQL se règlent par des variables d'environnement, sans modifier `application.properties` :

```bash
export DATABASE_URL="jdbc:postgresql://localhost:5432/VOTRE_BASE"
export PGUSER="VOTRE_USER"
export PGPASSWORD="VOTRE_MDP"
```

Sans elles, l'API utilise la base `phare_db` sur `localhost:5432`, avec l'utilisateur créé à l'étape 1. Les origines
autorisées par le CORS se règlent de même, avec `PHARE_ALLOWED_ORIGINS` (voir « Le CORS » dans le README principal).
