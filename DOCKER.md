# Weavenote Docker Deployment Guide

This guide explains how to deploy Weavenote using Docker with a robust PostgreSQL database backend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      Nginx (Port 8080)                       ││
│  │  ┌─────────────────────┐  ┌────────────────────────────────┐││
│  │  │   Static Files      │  │   API Proxy (/api/*)           │││
│  │  │   (React/Vite)      │  │   → api:3001                   │││
│  │  └─────────────────────┘  └────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│  ┌───────────────────────────▼─────────────────────────────────┐│
│  │              Backend API (Node.js/Express)                   ││
│  │                      Port 3001                                ││
│  │  • REST API for notes, folders, users                        ││
│  │  • JWT Authentication                                        ││
│  │  • Prisma ORM                                                ││
│  └───────────────────────────┬─────────────────────────────────┘│
│                              │                                   │
│  ┌───────────────────────────▼─────────────────────────────────┐│
│  │                  PostgreSQL 16                               ││
│  │                      Port 5432                                ││
│  │  • Robust SQL Database                                       ││
│  │  • Persistent Volume Storage                                 ││
│  │  • Full ACID Compliance                                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/141stfighterwing-collab/Weavenote.git
cd Weavenote

# Copy environment template
cp .env.example .env

# Edit the .env file with your settings
nano .env
```

### 2. Required Environment Variables

```bash
# Database (IMPORTANT: Change these in production!)
POSTGRES_USER=weavenote
POSTGRES_PASSWORD=your-secure-password-here
POSTGRES_DB=weavenote

# Security
JWT_SECRET=your-super-secret-jwt-key

# AI Features (Get from Google AI Studio)
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Build and Run

```bash
# Build and start all services
docker-compose up -d --build

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Initialize Database

The database schema is automatically created on first startup. To manually run migrations:

```bash
# Enter the API container
docker-compose exec api sh

# Run Prisma migrations
npx prisma migrate deploy
```

### 5. Access the Application

- **Frontend**: http://localhost:8080
- **API Health Check**: http://localhost:8080/api/health
- **Database Admin** (optional): `docker-compose --profile admin up -d` then http://localhost:5050

## Service Configuration

### PostgreSQL Database

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | weavenote | Database username |
| `POSTGRES_PASSWORD` | weavenote_secure_password | Database password |
| `POSTGRES_DB` | weavenote | Database name |
| `POSTGRES_PORT` | 5432 | Host port mapping |

### Backend API

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | 3001 | Host port mapping |
| `JWT_SECRET` | - | Secret for JWT signing |
| `JWT_EXPIRES_IN` | 7d | Token expiration time |
| `GEMINI_API_KEY` | - | Google Gemini API key |
| `CORS_ORIGINS` | localhost:8080 | Allowed CORS origins |
| `RATE_LIMIT_MAX` | 100 | Requests per 15 minutes |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_PORT` | 8080 | Host port mapping |
| `VITE_API_URL` | /api | API endpoint URL |

## Production Deployment

### 1. Security Checklist

- [ ] Change all default passwords
- [ ] Generate a strong JWT_SECRET (32+ random characters)
- [ ] Configure HTTPS/TLS certificates
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Configure backup strategy

### 2. Docker Compose Production Override

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 1G
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  api:
    deploy:
      resources:
        limits:
          memory: 1G
      replicas: 2
    environment:
      NODE_ENV: production

  frontend:
    deploy:
      resources:
        limits:
          memory: 256M
```

Run with:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3. Database Backups

```bash
# Create backup
docker-compose exec postgres pg_dump -U weavenote weavenote > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20240101.sql | docker-compose exec -T postgres psql -U weavenote weavenote
```

### 4. SSL/TLS with Reverse Proxy

For production, use a reverse proxy like Caddy or Traefik:

```bash
# Example with Caddy
caddy reverse-proxy --from yourdomain.com --to localhost:8080
```

## Database Schema

The PostgreSQL database uses the following main tables:

### Users & Authentication
- `users` - User accounts and profiles
- `sessions` - Active login sessions
- `audit_logs` - Security audit trail

### Content
- `notes` - Main note content
- `note_tags` - Tag associations
- `folders` - Note organization
- `templates` - User templates

### Projects
- `project_data` - Project-specific data
- `project_objectives` - Project objectives
- `project_milestones` - Project milestones
- `workflow_nodes` / `workflow_edges` - Workflow graphs

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/validate` - Validate token

### Notes
- `GET /api/notes` - List all notes
- `GET /api/notes/:id` - Get single note
- `POST /api/notes` - Create note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `POST /api/notes/:id/restore` - Restore deleted note
- `POST /api/notes/sync` - Batch sync notes

### Folders
- `GET /api/folders` - List folders
- `POST /api/folders` - Create folder
- `PUT /api/folders/:id` - Update folder
- `DELETE /api/folders/:id` - Delete folder

### Export
- `GET /api/export/notes/json` - Export as JSON
- `GET /api/export/notes/csv` - Export as CSV
- `GET /api/export/notes/sql` - Export as SQL

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if postgres is healthy
   docker-compose ps postgres
   
   # Check postgres logs
   docker-compose logs postgres
   ```

2. **API Not Starting**
   ```bash
   # Check API logs
   docker-compose logs api
   
   # Verify database URL
   docker-compose exec api env | grep DATABASE_URL
   ```

3. **Frontend Shows Errors**
   ```bash
   # Check if API is accessible
   curl http://localhost:8080/api/health
   
   # Check frontend logs
   docker-compose logs frontend
   ```

### Reset Everything

```bash
# Stop and remove all containers, volumes, and networks
docker-compose down -v

# Rebuild from scratch
docker-compose up -d --build
```

## Development

### Local Development Mode

For development without Docker:

```bash
# Start database only
docker-compose up postgres -d

# Backend
cd backend
npm install
npm run db:push
npm run dev

# Frontend (in another terminal)
npm install
npm run dev
```

### Database Migrations

```bash
# Create a new migration
cd backend
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy
```

### View Database

```bash
# Start Prisma Studio
cd backend
npx prisma studio
```

## Migration from Firebase

The application supports a hybrid mode where you can use both Firebase and the new PostgreSQL backend:

1. Keep Firebase config in environment variables
2. Use the `apiDatabaseService.ts` adapter
3. The `isApiMode()` function detects which backend to use
4. Gradually migrate data using the export/import features

## Support

For issues and feature requests, please open an issue on GitHub.
