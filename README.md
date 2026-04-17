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
| `POST` | `/api/auth/login` | Connexion (JWT) |
| `POST` | `/api/auth/refresh` | Renouveler le token |
| `POST` | `/api/auth/logout` | Déconnexion |

## Lancement

### Modo Automático (Recomendado)
Para iniciar todos os serviços de uma vez (Auth, API e Frontend):
```bash
./run_phare.sh
```
O script abrirá automaticamente o navegador em `http://localhost:5000/login.html`.

### Modo Manual
Se preferir rodar cada componente separadamente:

#### Backend Java (port 8080)
```bash
cd backend
mvn spring-boot:run
```

### Backend Node Auth (port 3000)
```bash
cd backend-node
npm install
node server.js
```

### Frontend
Servir le dossier `frontend/` avec un serveur HTTP :
```bash
cd frontend
npx serve .
```

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

Le frontend fonctionne en mode offline grâce à :
- **localStorage** comme fallback pour les cas et les entretiens
- **Service Worker** pour le cache des assets
- Indicateur visuel `🟢 API connectée` / `🔴 Mode hors-ligne`

## Licence

© 2026 Projet pHARe — Éducation Nationale
