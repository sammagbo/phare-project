# 🏫 pHARe — Gestion du harcèlement scolaire

Application de gestion des cas de harcèlement scolaire dans le cadre du programme **pHARe**.  
Outil d'attribution des entretiens entre les membres pHARe et les élèves impliqués.

## Structure du projet

```
phare-project/
├── frontend/
│   ├── phare-reunion.html             ← Interface réunion (tableau d'attribution)
│   └── phare-gestion-harcelement.html ← Interface gestion de cas (historique)
├── backend/
│   ├── pom.xml                        ← Dépendances Maven
│   └── src/main/java/com/phare/
│       ├── PhareApplication.java
│       ├── WebConfig.java             ← CORS
│       ├── controller/
│       │   └── CasController.java     ← API REST
│       ├── model/
│       │   ├── Cas.java               ← Entité JPA
│       │   ├── Eleve.java             ← Entité JPA
│       │   └── TypeEleve.java         ← Enum
│       ├── repository/
│       │   ├── CasRepository.java
│       │   └── EleveRepository.java
│       └── service/
│           └── CasService.java
├── .gitignore
└── README.md
```

## Prérequis

- Java 17+
- Maven 3.8+
- PostgreSQL 14+

## Installation

### 1. Base de données

```sql
CREATE DATABASE phare_db;
CREATE USER phare_user WITH PASSWORD 'phare_password';
GRANT ALL PRIVILEGES ON DATABASE phare_db TO phare_user;
\c phare_db
GRANT ALL ON SCHEMA public TO phare_user;
```

### 2. Backend

```bash
cd backend
mvn spring-boot:run
```

### 3. Frontend

Ouvrir `frontend/phare-reunion.html` dans le navigateur.

## API REST

| Méthode  | Endpoint             | Description              |
|----------|----------------------|--------------------------|
| `GET`    | `/api/cas`           | Lister tous les cas      |
| `GET`    | `/api/cas/{id}`      | Obtenir un cas           |
| `GET`    | `/api/cas?search=x`  | Rechercher par élève     |
| `POST`   | `/api/cas`           | Créer un cas             |
| `PUT`    | `/api/cas/{id}`      | Modifier un cas          |
| `DELETE` | `/api/cas/{id}`      | Supprimer un cas         |

## Auteur

**Sammy K. Magbo** — Vie Scolaire, Lycée Molière
