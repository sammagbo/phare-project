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

```bash
cd phare-api-pg
mvn spring-boot:run
```

Le serveur démarre sur **http://localhost:8080**.
Les tables `cas` et `eleves` sont créées automatiquement (ddl-auto=update).

## 3. Vérifier

```bash
# Créer un cas
curl -X POST http://localhost:8080/api/cas \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-04-10",
    "heure": "10:30",
    "eleves": [
      { "nom": "Jean Dupont", "type": "VICTIME", "membre": "Sammy K. Magbo" },
      { "nom": "Marie Martin", "type": "TEMOIN", "membre": "Anne-Marie L." }
    ]
  }'

# Lister
curl http://localhost:8080/api/cas

# Rechercher par nom d'élève
curl "http://localhost:8080/api/cas?search=jean"

# Modifier
curl -X PUT http://localhost:8080/api/cas/1 \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-04-10","heure":"14:00","eleves":[{"nom":"Jean Dupont","type":"VICTIME","membre":"Sammy K. Magbo"}]}'

# Supprimer
curl -X DELETE http://localhost:8080/api/cas/1
```

## Structure du projet

```
phare-api-pg/
├── pom.xml
├── README.md
└── src/main/
    ├── java/com/phare/
    │   ├── PhareApplication.java        ← Point d'entrée
    │   ├── WebConfig.java               ← CORS
    │   ├── controller/
    │   │   └── CasController.java       ← Endpoints REST (inchangés)
    │   ├── model/
    │   │   ├── Cas.java                 ← Entité JPA (@OneToMany)
    │   │   ├── Eleve.java               ← Entité JPA (@ManyToOne)
    │   │   └── TypeEleve.java           ← Enum
    │   ├── repository/
    │   │   ├── CasRepository.java       ← JpaRepository<Cas, Long>
    │   │   └── EleveRepository.java     ← JpaRepository<Eleve, Long>
    │   └── service/
    │       └── CasService.java          ← Logique métier + transactions
    └── resources/
        └── application.properties       ← Config PostgreSQL + JPA
```

## Schéma de la base de données

```
┌──────────────────┐       ┌────────────────────────┐
│       cas        │       │        eleves          │
├──────────────────┤       ├────────────────────────┤
│ id       BIGINT  │◄──────│ cas_id    BIGINT (FK)  │
│ date     VARCHAR │       │ id        BIGINT       │
│ heure    VARCHAR │       │ nom       VARCHAR       │
└──────────────────┘       │ type      VARCHAR       │
                           │ membre    VARCHAR       │
                           └────────────────────────┘
          1 ─────────────────── N
```

## Points clés

- **CascadeType.ALL** : créer/modifier/supprimer un cas gère automatiquement ses élèves
- **orphanRemoval=true** : un élève retiré de la liste est supprimé de la BDD
- **@JsonIgnore** sur `Eleve.cas` : évite la boucle infinie dans le JSON
- **Même API** : les endpoints sont identiques à la v1, le frontend existant fonctionne sans modification
- **Recherche** : `GET /api/cas?search=nom` filtre par nom d'élève

## Personnalisation

Pour changer les identifiants PostgreSQL, éditez `application.properties` :

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/VOTRE_BASE
spring.datasource.username=VOTRE_USER
spring.datasource.password=VOTRE_MDP
```
