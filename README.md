<div align="center">


<h1 align="center">🧶 WeaveNote</h1>

<p align="center">
  <strong>AI-Powered Note Workspace for Capture, Synthesis, Project Planning & Knowledge Organization</strong>
</p>

<p align="center">
  <em>A modern, self-hosted note-taking application with PostgreSQL backend, Docker deployment, and Google Gemini AI integration</em>
</p>

<p align="center">
  <a href="#-quick-start">🚀 Quick Start</a> •
  <a href="#-screenshots">📸 Screenshots</a> •
  <a href="#-requirements">💻 Requirements</a> •
  <a href="#-installation">🛠️ Installation</a> •
  <a href="#-faq">❓ FAQ</a>
</p>

<p align="center">
  <a href="https://github.com/141stfighterwing-collab/Weavenote/stargazers">
    <img src="https://img.shields.io/github/stars/141stfighterwing-collab/Weavenote?style=social" alt="GitHub Stars">
  </a>
  <a href="https://github.com/141stfighterwing-collab/Weavenote/forks">
    <img src="https://img.shields.io/github/forks/141stfighterwing-collab/Weavenote?style=social" alt="GitHub Forks">
  </a>
  <a href="https://github.com/141stfighterwing-collab/Weavenote/issues">
    <img src="https://img.shields.io/github/issues/141stfighterwing-collab/Weavenote" alt="GitHub Issues">
  </a>
  <img src="https://img.shields.io/github/license/141stfighterwing-collab/Weavenote" alt="License">
  <img src="https://img.shields.io/github/v/release/141stfighterwing-collab/Weavenote" alt="Version">
</p>

<!-- SEO Keywords: note-taking app, AI notes, PostgreSQL notes, Docker notes, self-hosted notes, knowledge management, project planning, Google Gemini AI, React notes app, TypeScript notes -->

</div>

---

## 🏷️ Tags & Topics

<div align="center">

| Category | Tags |
|----------|------|
| **Application** | `note-taking` `knowledge-management` `productivity` `project-planning` `note-workspace` |
| **Technology** | `react` `typescript` `vite` `nodejs` `express` `postgresql` `prisma` |
| **Deployment** | `docker` `docker-compose` `self-hosted` `containerization` `nginx` |
| **AI** | `google-gemini` `ai-notes` `ai-assistant` `gemini-api` `artificial-intelligence` |
| **Features** | `markdown` `themes` `export` `backup` `version-control` `rest-api` |

**Hashtags:** #WeaveNote #NoteTaking #AI #PostgreSQL #Docker #SelfHosted #React #TypeScript #OpenSource #Productivity #KnowledgeManagement #GoogleGemini

</div>

---

## 📋 Table of Contents

- [About WeaveNote](#-about-weavenote)
- [Quick Start](#-quick-start)
- [Screenshots](#-screenshots)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Docker Deployment](#-docker-deployment)
- [Backup & Migration](#-backup--migration)
- [API Reference](#-api-reference)
- [Database Architecture](#-database-architecture)
- [Security](#-security)
- [Versioning & Patching](#-versioning--patching)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-faq)
- [Development](#-development)
- [Credits](#-credits)
- [Support & License](#-support--license)

---

## 🎯 About WeaveNote

WeaveNote is a modern, AI-powered note-taking application designed for professionals, developers, and teams who need more than just basic note storage. Built with a robust PostgreSQL backend and containerized with Docker, WeaveNote offers enterprise-grade reliability with consumer-friendly simplicity.

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Integration** | Powered by Google Gemini for intelligent note synthesis, summarization, and content generation |
| 🗄️ **PostgreSQL Backend** | Enterprise-grade database with full ACID compliance for reliable data storage |
| 🐳 **Docker Ready** | One-click deployment with Docker Compose for development and production |
| 🔐 **Secure by Design** | AES-256-GCM encryption for sensitive data, JWT authentication, and secure password handling |
| 📊 **Multiple Views** | Grid and Mindmap views for flexible note organization |
| 🎨 **15+ Themes** | Customizable appearance with dark/light mode support |
| 📦 **Export Options** | JSON, CSV, and SQL export for data portability |
| 🔄 **Version Control** | Built-in versioning system with patch tracking and rollback capability |
| ⚙️ **Admin Dashboard** | Web-based settings management for environment variables and system configuration |
| ☁️ **Cloud Ready** | Optional Firebase integration for hybrid cloud/on-premise deployment |

### 🎯 Use Cases

- **📋 Personal Knowledge Base** - Organize thoughts, research, and ideas
- **💼 Project Management** - Track tasks, milestones, and project documentation
- **📚 Research Notes** - AI-powered synthesis of complex information
- **💻 Code Documentation** - Store and organize code snippets with AI explanations
- **📝 Meeting Notes** - Capture and summarize meeting discussions
- **📖 Learning Journal** - Track learning progress with AI-generated summaries

---

## 🚀 Quick Start

### ⚡ ONE-CLICK INSTALL (Recommended)

**Windows:**
```
Double-click install.bat
```

**Linux/Mac:**
```bash
chmod +x install-smart.sh && ./install-smart.sh
```

The **Smart Installer** automatically:
- ✅ Checks and installs dependencies
- ✅ Shows real-time progress with percentage
- ✅ Auto-fixes common errors (missing files, port conflicts, etc.)
- ✅ Runs health checks
- ✅ Opens the app when ready

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│     📁 Weavenote                                                           │
│     ├── 📄 install.bat             ◀── Double-click (Windows)              │
│     ├── 📄 install-smart.sh        ◀── Run (Linux/Mac)                     │
│     ├── 📄 install-smart.ps1       ◀── PowerShell (advanced)               │
│     └── ...                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Installer Features

| Feature | Description |
|---------|-------------|
| 📊 **Progress Display** | Real-time percentage and status updates |
| 🔧 **Auto-Fix** | Automatically resolves common errors |
| 📝 **Logging** | Full error logging to `weavenote-install.log` |
| 🏥 **Health Checks** | Verifies services are running correctly |
| 🔄 **Retry Logic** | Retries failed operations up to 3 times |

### Auto-Fix Capabilities

The installer automatically detects and fixes:
- Missing `package-lock.json`
- Docker not running
- Port conflicts
- Disk space issues
- Network errors
- Prisma generation failures

### Quick Docker Start (Manual)

**Windows (PowerShell):**
```powershell
# Clone and start
git clone https://github.com/141stfighterwing-collab/Weavenote.git
cd Weavenote
docker-compose up -d --build

# Access the app
start http://localhost:8080
```

**Linux/Mac:**
```bash
# Clone and start
git clone https://github.com/141stfighterwing-collab/Weavenote.git
cd Weavenote
docker-compose up -d --build

# Access the app
open http://localhost:8080
```

### Update to Latest Version

**Windows (PowerShell):**
```powershell
cd Weavenote
git pull
docker-compose down
docker-compose up -d --build
```

**Linux/Mac:**
```bash
cd Weavenote
git pull
docker-compose down
docker-compose up -d --build
```

---

## 📸 Screenshots

### Main Application Interface

<img src="./screenshots/01-homepage.png" alt="WeaveNote Main Interface" width="800">

*The main WeaveNote interface showing the grid view with notes organized in folders and tags.*

### Settings Panel

<img src="./screenshots/03-settings-panel.png" alt="Settings Panel" width="800">

*Access settings by clicking the ⚙️ gear icon in the top-right corner.*

### Theme Selection

<img src="./screenshots/07-theme-selector.png" alt="Theme Selector" width="400">

*Choose from 15+ beautiful themes including Dark Mode, Ocean, Forest, Sunset, and more.*

### Note Types - Different Tabs

<table>
  <tr>
    <td><img src="./screenshots/13-tab-quick.png" alt="Quick Notes" width="400"></td>
    <td><img src="./screenshots/13-tab-project.png" alt="Project Notes" width="400"></td>
  </tr>
  <tr>
    <td><em>Quick Notes Tab</em></td>
    <td><em>Project Notes Tab</em></td>
  </tr>
</table>

### Security Settings

<img src="./screenshots/05-settings-my-security.png" alt="Security Settings" width="800">

*Manage your security settings including password changes and account preferences.*

### AI Engine Configuration

<img src="./screenshots/05-settings-ai-engine.png" alt="AI Engine Settings" width="800">

*Configure AI usage quotas and monitor your daily Gemini API usage.*

### Diagnostics

<img src="./screenshots/05-settings-diagnostics.png" alt="Diagnostics Panel" width="800">

*System health checks and diagnostic information for troubleshooting.*

### Settings Entry Point

<img src="./screenshots/14-settings-entry-point.png" alt="Settings Entry Point" width="800">

*The highlighted settings panel showing where to access all configuration options.*

---

## 💻 Requirements

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | Windows 10, macOS 10.15, Ubuntu 18.04 | Windows 11, macOS 13+, Ubuntu 22.04 |
| **RAM** | 4 GB | 8 GB+ |
| **Disk** | 2 GB free | 10 GB+ (for database growth) |
| **CPU** | 2 cores | 4+ cores |

### Software Requirements

| Software | Required | Version | Notes |
|----------|----------|---------|-------|
| **Docker Desktop** | ✅ Yes | 4.0+ | Must be running during installation and use |
| **PowerShell** | Windows Only | 5.1+ | Built into Windows 10/11 |
| **Git** | Optional | Any | For cloning repository |
| **Node.js** | Dev Only | 18+ | Only needed for local development |

### Network Requirements

| Port | Service | Required |
|------|---------|----------|
| 8080 | Frontend (Nginx) | Must be available |
| 3001 | Backend API | Must be available |
| 5432 | PostgreSQL | Must be available |

### AI Requirements

| Requirement | Details |
|-------------|---------|
| **Gemini API Key** | Required for AI features. Get one free at [Google AI Studio](https://makersuite.google.com/app/apikey) |
| **Daily Quota** | 800 requests/day default (configurable) |

---

## 🛠️ Installation

### Method 1: One-Click Windows Installer (Recommended)

**Best for:** Windows users who want the fastest setup

#### Step-by-Step Instructions

1. **Download WeaveNote**
   ```
   Option A: Clone with Git
   git clone https://github.com/141stfighterwing-collab/Weavenote.git

   Option B: Download ZIP
   https://github.com/141stfighterwing-collab/Weavenote/archive/refs/heads/main.zip
   ```

2. **Ensure Docker Desktop is Running**
   - Open Docker Desktop
   - Wait for the whale icon in system tray to stop animating
   - Verify Docker is running: `docker --version`

3. **Run the Installer**
   - Navigate to the Weavenote folder
   - Double-click `install-weavenote.bat`
   - If prompted, click "Run anyway" or allow execution

4. **Follow the Prompts**

   The installer will display progress:

   ```
   ╔═══════════════════════════════════════════════════════════════════════════╗
   ║   🧶 WEAVERNOTE DOCKER INSTALLER v1.0.0                                   ║
   ╚═══════════════════════════════════════════════════════════════════════════╝

   ┌─────────────────────────────────────────────────────────────┐
   │ Step 1/8 - Checking Prerequisites        Progress: 12%      │
   └─────────────────────────────────────────────────────────────┘

   [✓] Docker Desktop is installed (Version: 24.0.6)
   [✓] Docker Compose is installed
   [✓] Port 8080 is available
   [✓] Port 3001 is available
   [✓] Port 5432 is available
   ```

5. **Configure Environment Variables**

   The installer will prompt for:
   - **Gemini API Key** (optional, can be added later in Settings)
   - **Custom ports** (optional, defaults provided)

6. **Complete Installation**

   ```
   ┌─────────────────────────────────────────────────────────────┐
   │ Step 8/8 - Running Health Checks         Progress: 100%     │
   └─────────────────────────────────────────────────────────────┘

   [✓] Frontend is healthy
   [✓] API is healthy
   [✓] Database is ready

   🎉 WEAVERNOTE IS NOW RUNNING! 🎉

   📱 Frontend:  http://localhost:8080
   🔌 API:       http://localhost:3001/api
   ```

### Method 2: Docker Compose (All Platforms)

**Best for:** Linux/macOS users, or Windows users who prefer command line

```bash
# 1. Clone the repository
git clone https://github.com/141stfighterwing-collab/Weavenote.git
cd Weavenote

# 2. Create environment file
cp .env.example .env

# 3. Edit environment variables
nano .env  # Or use your preferred editor

# 4. Start all services
docker-compose up -d --build

# 5. Check status
docker-compose ps

# 6. View logs (optional)
docker-compose logs -f
```

### Method 3: Development Mode

**Best for:** Developers who want to modify the code

```bash
# Frontend
npm install
npm run dev

# Backend (in another terminal)
cd backend
npm install
npm run dev

# Database (requires local PostgreSQL)
cd backend
npx prisma migrate dev
npx prisma studio  # Opens database GUI
```

---

## ⚙️ Configuration

### Environment Variables

WeaveNote uses environment variables for all configuration. These can be managed through:

1. **`.env` file** - Direct file editing (recommended for initial setup)
2. **Settings UI** - Admin panel for runtime changes (Admin → ENV Settings)

#### Required Variables

```bash
# PostgreSQL Database
POSTGRES_USER=weavenote              # Database username
POSTGRES_PASSWORD=your_secure_pass   # Database password (CHANGE THIS!)
POSTGRES_DB=weavenote                # Database name

# Security
JWT_SECRET=your_jwt_secret_min_32_chars  # JWT signing key (CHANGE THIS!)

# AI Integration
GEMINI_API_KEY=your_gemini_api_key   # Get from Google AI Studio
```

#### Optional Variables

```bash
# Backend API
API_PORT=3001                        # API server port
JWT_EXPIRES_IN=7d                    # Token expiration
CORS_ORIGINS=http://localhost:8080   # Allowed origins
RATE_LIMIT_WINDOW_MS=900000          # Rate limit window (15 min)
RATE_LIMIT_MAX=100                   # Max requests per window

# Firebase (optional cloud features)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_DATABASE_URL=          # Optional Firebase Realtime Database URL

# pgAdmin (optional database admin UI)
PGADMIN_EMAIL=admin@weavenote.local
PGADMIN_PASSWORD=admin
```

### Managing Settings Through UI

1. **Open Settings**: Click the ⚙️ gear icon in the top-right corner
2. **Navigate to ENV Settings**: Requires admin privileges
3. **Add/Edit Variables**: Use the form or quick-add buttons
4. **Import/Export**: Bulk manage settings via .env files


### On-Prem Spinoff (100% Self-Hosted)

Use the included override profile to run without Firebase/Gemini dependencies:

```bash
docker compose -f docker-compose.yml -f docker-compose.onprem.yml up -d --build
```

See `SPINOFF_ONPREM.md` for the Firebase project mapping and on-prem profile details.

### Default Credentials

After installation, use these default credentials:

| Service | Username | Password |
|---------|----------|----------|
| **Web App** | Register new account | N/A |
| **PostgreSQL** | weavenote | (auto-generated, check .env) |
| **pgAdmin** | admin@weavenote.local | admin |

⚠️ **Security Warning**: Change all default passwords before production use!

---

## 🐳 Docker Deployment

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                                                                  │
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

### Common Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# View logs
docker-compose logs -f            # All services
docker-compose logs -f api        # API only
docker-compose logs -f postgres   # Database only

# Execute commands in containers
docker-compose exec api sh        # API container
docker-compose exec postgres psql -U weavenote -d weavenote  # Database

# Database backup
docker-compose exec postgres pg_dump -U weavenote weavenote > backup.sql

# Database restore
cat backup.sql | docker-compose exec -T postgres psql -U weavenote weavenote

# Complete reset (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d --build
```

### Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:8080 | Main web application |
| API Health | http://localhost:8080/api/health | Backend health check |
| API Docs | http://localhost:8080/api | API endpoints |
| PostgreSQL | localhost:5432 | Direct database access |
| pgAdmin | http://localhost:5050 | Database admin UI (if enabled) |

### Network Architecture & Port Exposure

Understanding which ports need to be exposed and which services communicate internally:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DOCKER NETWORK (weavenote_default)                     │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        INTERNAL COMMUNICATION                           │    │
│  │                                                                          │    │
│  │   Frontend (nginx) ──► API (api:3001) ──► PostgreSQL (postgres:5432)   │    │
│  │         │                    │                      │                   │    │
│  │         │                    │                      │                   │    │
│  │    No external           No external           No external              │    │
│  │    access needed         access needed         access needed            │    │
│  │    (proxied via          (only via             (only internal)          │    │
│  │     port 8080)            frontend)                                     │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
│  EXTERNAL ACCESS (Ports to expose):                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                          │    │
│  │   Port 8080 ──► Frontend (ONLY port that needs external access)        │    │
│  │                                                                          │    │
│  │   Port 5432 ──► PostgreSQL (OPTIONAL - only for external DB access)     │    │
│  │   Port 5050 ──► pgAdmin (OPTIONAL - only for DB admin UI)              │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Port Exposure Summary

| Port | Service | Expose Externally? | Purpose |
|------|---------|-------------------|---------|
| **8080** | Frontend | ✅ **YES** | Main web application - users access this |
| 3001 | API | ❌ NO | Only accessed via frontend's nginx proxy |
| 5432 | PostgreSQL | ⚠️ Optional | Only if you need external DB tools |
| 5050 | pgAdmin | ⚠️ Optional | Only if you want web-based DB admin |

**Key Point:** The frontend container (nginx) handles all external traffic. It serves static files and proxies `/api/*` requests to the backend API internally. The API and database never need direct external access.

---

### 🌐 Using with Nginx Proxy Manager (NPM)

If you have **Nginx Proxy Manager** installed and want to use a domain with WeaveNote:

#### Step 1: Configure WeaveNote Port

In your `.env` file or `docker-compose.yml`, set the frontend to use port 80 internally:

```yaml
# docker-compose.yml
services:
  frontend:
    ports:
      - "8080:80"  # Maps external 8080 to internal 80
```

Or use any port you prefer (e.g., `3000:80`, `9000:80`).

#### Step 2: Create NPM Proxy Host

1. Open Nginx Proxy Manager admin panel
2. Go to **Proxy Hosts** → **Add Proxy Host**
3. Configure as follows:

| Field | Value |
|-------|-------|
| **Domain Names** | `notes.yourdomain.com` |
| **Scheme** | `http` |
| **Forward Hostname / IP** | `weavenote-frontend` (or server IP) |
| **Forward Port** | `80` (or your mapped port) |
| **Block Common Exploits** | ✅ Enabled |
| **Websockets Support** | ✅ Enabled |

#### Step 3: SSL Configuration

In the **SSL** tab:
1. Select **Request a new SSL Certificate**
2. Enable **Force SSL**
3. Enable **HTTP/2 Support**
4. Enter your email for Let's Encrypt
5. Save

#### Step 4: Environment Variables Update

Update your `.env` file for production domain:

```bash
# Update CORS to allow your domain
CORS_ORIGINS=https://notes.yourdomain.com

# If using external access
VITE_API_URL=https://notes.yourdomain.com/api
```

#### NPM Configuration Example

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NGINX PROXY MANAGER CONFIGURATION                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Domain: notes.yourdomain.com                                           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Incoming Request                                                │   │
│  │       │                                                          │   │
│  │       ▼                                                          │   │
│  │  ┌─────────────────┐                                             │   │
│  │  │   NPM Proxy     │  SSL Termination                           │   │
│  │  │   (Port 80/443) │  HTTPS → HTTP                              │   │
│  │  └────────┬────────┘                                             │   │
│  │           │                                                       │   │
│  │           │ Forward to: weavenote-frontend:80                    │   │
│  │           ▼                                                       │   │
│  │  ┌─────────────────┐                                             │   │
│  │  │   WeaveNote     │                                             │   │
│  │  │   Frontend      │  Serves static files                        │   │
│  │  │   (Nginx)       │  Proxies /api/* to backend:3001             │   │
│  │  └─────────────────┘                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Important Notes for NPM Setup

1. **Only expose port 8080** (or your chosen frontend port) to NPM
2. **Do NOT expose** ports 3001 (API) or 5432 (PostgreSQL) externally
3. **Database port (5432)** should only be exposed if you need external database tools
4. **Both NPM and WeaveNote** should be on the same Docker network, OR use the host IP

#### Same Docker Network Setup

If NPM is also running in Docker, create a shared network:

```bash
# Create shared network
docker network create npm-network

# Connect NPM to the network
docker network connect npm-network nginx-proxy-manager

# Connect WeaveNote to the network
docker network connect npm-network weavenote-frontend
```

Then in NPM, use the container name as the forward hostname:
- **Forward Hostname**: `weavenote-frontend`
- **Forward Port**: `80`

---

### 🔒 Production Deployment Checklist

When deploying to production with a domain:

- [ ] Change all default passwords
- [ ] Update `CORS_ORIGINS` to your domain
- [ ] Configure SSL/TLS certificates
- [ ] Set up proper firewall rules
- [ ] Only expose necessary ports (8080 or NPM's 80/443)
- [ ] Enable rate limiting
- [ ] Configure backup strategy
- [ ] Review database security settings

---

## 💾 Backup & Migration

WeaveNote includes a comprehensive backup and migration tool for data protection and easy migration from other services.

### Quick Start

**Windows:**
```bash
# Double-click backup-migration.bat or run:
.\backup-migration.bat
```

**All Platforms:**
```bash
powershell -ExecutionPolicy Bypass -File backup-migration.ps1
```

### Main Menu Options

```
╔═══════════════════════════════════════════════════════════════════╗
║   🧶 WEAVERNOTE BACKUP & MIGRATION TOOL v1.0.0                    ║
╚═══════════════════════════════════════════════════════════════════╝

BACKUP OPTIONS:
[1] Create Local Backup - SQL, JSON, CSV exports
[2] Create Cloud Backup - AWS S3, GCS, Azure, Dropbox, SFTP

MIGRATION OPTIONS:
[3] Migrate from Cloud - Firebase, Supabase, MongoDB, Notion

RESTORE OPTIONS:
[4] Restore from Backup - Restore from backup files

UTILITIES:
[5] Pre-flight Checks - Database & disk space verification
[6] Clean Old Backups - Remove backups older than 30 days
```

### Backup Features

#### Local Backup

Creates multiple backup formats for maximum compatibility:

| Format | Description | Use Case |
|--------|-------------|----------|
| **SQL Dump** | Full PostgreSQL database export | Complete restore |
| **Custom Dump** | PostgreSQL custom format | Selective restore |
| **JSON Export** | Notes, folders, tags in JSON | Cross-platform import |
| **CSV Export** | Notes in spreadsheet format | Analysis, reporting |

```
Backup Location: ./backups/
Files Created:
  • weavenote_backup_20240115_143022.sql
  • weavenote_backup_20240115_143022.dump
  • weavenote_export_20240115_143022.json
  • weavenote_notes_20240115_143022.csv
  • manifest_20240115_143022.json
```

#### Cloud Backup Destinations

| Service | Requirements | Notes |
|---------|--------------|-------|
| **AWS S3** | AWS CLI configured | Cost-effective long-term storage |
| **Google Cloud Storage** | gcloud CLI configured | Good for Google Workspace users |
| **Azure Blob Storage** | Azure CLI configured | Enterprise integration |
| **Dropbox** | Access token | Easy personal backup |
| **SFTP/FTP** | Server credentials | Self-hosted option |

### Migration Features

#### Supported Sources

| Source | Method | Requirements |
|--------|--------|--------------|
| **Firebase Firestore** | Direct/API | Service Account JSON |
| **Supabase** | Database/API | Connection string or API key |
| **MongoDB** | Dump/API | Connection string |
| **Notion** | API | Integration token |
| **JSON Import** | File import | Valid JSON format |

#### Firebase Migration

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FIREBASE MIGRATION SETUP                         │
├─────────────────────────────────────────────────────────────────────┤
│  Required:                                                           │
│  • Firebase Project ID                                               │
│  • Service Account JSON file                                         │
│                                                                      │
│  To get your Service Account JSON:                                  │
│  1. Go to Firebase Console → Project Settings → Service Accounts    │
│  2. Click 'Generate new private key'                                 │
│  3. Save the JSON file securely                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Migration Process:**
1. Pre-flight checks (database running, disk space)
2. Connect to Firebase using service account
3. Export notes, folders, and tags
4. Transform to WeaveNote schema
5. Import to local PostgreSQL
6. Verification and cleanup

#### Supabase Migration

Two migration methods available:

| Method | Speed | Use Case |
|--------|-------|----------|
| **Direct Database** | Fast | Recommended when network allows |
| **API Migration** | Slower | Works through firewalls |

**Direct Database Migration:**
```
Required: Supabase Database Connection String
Format: postgresql://user:password@host:port/database
```

**API Migration:**
```
Required:
• Supabase Project URL (https://xxxxx.supabase.co)
• Service Role Key (from Settings → API)
```

#### JSON Import Format

```json
{
  "notes": [
    {
      "title": "My Note",
      "content": "Note content here...",
      "type": "quick",
      "tags": ["tag1", "tag2"],
      "folderId": "optional-folder-id"
    }
  ],
  "folders": [
    {
      "name": "My Folder",
      "order": 1
    }
  ]
}
```

### Pre-flight Checks

The tool automatically verifies before any operation:

| Check | Description | Action if Failed |
|-------|-------------|------------------|
| Docker Status | Is Docker running? | Prompt to start Docker |
| Container Status | Are containers running? | Attempt to start containers |
| Database Connection | Can we connect to PostgreSQL? | Show connection error |
| Disk Space | Is there enough free space? | Offer cleanup suggestions |

```
┌─────────────────────────────────────────────────────────────────────┐
│ Checking Disk Space                                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Drive: C:\                                                          │
│  Total Space: 500 GB                                                 │
│  Free Space: 125 GB                                                  │
│  Used: 75%                                                           │
│                                                                      │
│  [✓] Sufficient disk space available: 125 GB                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Restore Process

**WARNING: Restore will replace ALL data in your database!**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Database Restore                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Available backups:                                                  │
│  [1] weavenote_backup_20240115_143022.sql (12.5 MB)                 │
│  [2] weavenote_backup_20240114_091500.sql (11.8 MB)                 │
│  [3] weavenote_backup_20240113_183022.sql (10.2 MB)                 │
│                                                                      │
│  Select backup to restore: 1                                         │
│                                                                      │
│  ⚠️  WARNING: This will replace ALL data!                           │
│  Are you sure? (yes/N): yes                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Backup Best Practices

| Practice | Recommendation |
|----------|---------------|
| **Frequency** | Daily automated backups for production |
| **Retention** | Keep 30 days locally, 90+ days in cloud |
| **Verification** | Test restore process monthly |
| **Encryption** | Enable for cloud backups containing sensitive data |
| **Offsite** | Always maintain at least one offsite backup |

### Automated Backup Schedule (Optional)

Create a scheduled task for automated backups:

**Windows Task Scheduler:**
```powershell
# Create daily backup task
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$PWD\backup-migration.ps1`" -AutoBackup"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "WeaveNote Backup" -Action $action -Trigger $trigger
```

**Linux Cron:**
```bash
# Add to crontab (daily at 2am)
0 2 * * * cd /path/to/weavenote && ./backup-migration.ps1 -AutoBackup
```

---

## 📡 API Reference

### Authentication

```bash
# Register new user
POST /api/auth/register
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Get current user
GET /api/auth/me
Authorization: Bearer <token>

# Validate token
GET /api/auth/validate
Authorization: Bearer <token>

# Logout
POST /api/auth/logout
Authorization: Bearer <token>
```

### Notes

```bash
# List notes (with filters)
GET /api/notes?type=quick&folderId=xxx&isDeleted=false

# Get single note
GET /api/notes/:id

# Create note
POST /api/notes
{
  "title": "My Note",
  "content": "Note content",
  "type": "quick",
  "tags": ["tag1", "tag2"]
}

# Update note
PUT /api/notes/:id

# Soft delete note
DELETE /api/notes/:id

# Permanent delete
DELETE /api/notes/:id?permanent=true

# Restore deleted note
POST /api/notes/:id/restore
```

### Folders

```bash
# List folders
GET /api/folders

# Create folder
POST /api/folders
{
  "name": "My Folder"
}

# Update folder
PUT /api/folders/:id

# Delete folder
DELETE /api/folders/:id

# Reorder folders
POST /api/folders/reorder
{
  "folderIds": ["id1", "id2", "id3"]
}
```

### Export

```bash
# Export as JSON
GET /api/export/notes/json

# Export as CSV
GET /api/export/notes/csv

# Export as SQL
GET /api/export/notes/sql
```

### Settings (Admin Only)

```bash
# List all settings
GET /api/settings

# Create/Update setting
POST /api/settings
{
  "key": "GEMINI_API_KEY",
  "value": "your-key",
  "isSecret": true,
  "category": "api",
  "description": "Google Gemini API Key"
}

# Delete setting
DELETE /api/settings/:id

# Export settings
POST /api/settings/export

# Import settings
POST /api/settings/import
{
  "content": "KEY=value\nKEY2=value2",
  "category": "general"
}
```

---

## 🗄️ Database Architecture

### Schema Overview

WeaveNote uses PostgreSQL with Prisma ORM for robust, type-safe database operations.

| Table | Description |
|-------|-------------|
| `users` | User accounts, roles, and authentication data |
| `sessions` | Active login sessions for JWT management |
| `audit_logs` | Security audit trail for compliance |
| `notes` | Main note content with metadata |
| `note_tags` | Tag associations for organization |
| `folders` | Hierarchical folder structure |
| `templates` | User-created templates |
| `system_settings` | Environment variables (encrypted storage) |
| `system_versions` | Version history and patch tracking |

### Key Features

- **Full ACID Compliance**: Ensures data integrity for all operations
- **Proper Indexing**: Optimized queries for fast note retrieval
- **Cascading Deletes**: Maintains referential integrity
- **Encrypted Storage**: Sensitive data protected with AES-256-GCM
- **Audit Logging**: Track all system changes for compliance

### Backup & Restore

```bash
# Create backup
docker-compose exec postgres pg_dump -U weavenote weavenote > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20240101.sql | docker-compose exec -T postgres psql -U weavenote weavenote
```

---

## 🔒 Security

### Security Features

| Feature | Implementation |
|---------|---------------|
| **Password Hashing** | bcrypt with salt rounds |
| **Data Encryption** | AES-256-GCM for sensitive settings |
| **Authentication** | JWT with configurable expiration |
| **Rate Limiting** | Configurable request throttling |
| **CORS Protection** | Whitelist-based origin validation |
| **Input Validation** | Server-side validation on all inputs |
| **SQL Injection Prevention** | Prisma parameterized queries |
| **XSS Protection** | Sanitized markdown rendering |

### Security Recommendations

1. **Change Default Passwords**
   - PostgreSQL password
   - JWT secret (use 32+ random characters)
   - pgAdmin credentials (if used)

2. **Protect API Keys**
   - Never commit `.env` files (already gitignored)
   - Use the Settings UI for secure key management
   - Rotate keys periodically

3. **Network Security**
   - Don't expose database port (5432) to the internet
   - Use HTTPS in production
   - Configure firewall rules

4. **Regular Maintenance**
   - Keep Docker images updated
   - Monitor audit logs
   - Backup database regularly

---

## 📦 Versioning & Patching

### Current Version

| Component | Version |
|-----------|---------|
| **WeaveNote** | 1.6.4 |
| **Frontend** | React 18 + Vite 5 |
| **Backend** | Node.js 20 + Express 4 |
| **Database** | PostgreSQL 16 |
| **ORM** | Prisma 5.x |

### Version History

WeaveNote tracks all patches and updates in the `system_versions` table. View version history in the Settings panel.

| Version | Date | Changes |
|---------|------|---------|
| **1.6.4** | 2026-04 | Sentinel: IDOR protection - fixed authentication bypass in note retrieval |
| **1.6.3** | 2026-04 | Sentinel: Security hardening - removed hardcoded secrets and implemented fail-secure startup |
| **1.6.2** | 2026-03 | Firebase database URL wiring + on-prem spinoff override profile |
| **1.5.0** | 2024-01 | Smart installer, auto-fix capabilities, Docker optimizations |
| **1.4.0** | 2024-01 | Added project management features, Gantt charts |
| **1.3.0** | 2024-01 | Mind map view, workflow editor |
| **1.2.0** | 2023-12 | AI integration with Google Gemini |
| **1.1.0** | 2023-12 | PostgreSQL migration, Prisma ORM |
| **1.0.0** | 2023-11 | Initial release |

### Update Process

**Automatic Update (Recommended):**

**Windows (PowerShell):**
```powershell
cd Weavenote
git pull
docker-compose down
docker-compose up -d --build
start http://localhost:8080
```

**Linux/Mac:**
```bash
cd Weavenote
git pull
docker-compose down
docker-compose up -d --build
open http://localhost:8080
```

**Check Current Version:**
```bash
# Via API
curl http://localhost:8080/api/version

# Via database
docker-compose exec postgres psql -U weavenote -d weavenote -c "SELECT * FROM system_versions ORDER BY appliedAt DESC LIMIT 5;"
```

### Patch Notes

Patches are automatically tracked in the database. Each patch includes:
- Version number
- Patch notes
- Applied timestamp
- Breaking change flags
- Rollback capability (for non-breaking patches)

### Database Migrations

When updating, Prisma automatically handles database migrations:

```bash
# Check migration status
docker-compose exec api npx prisma migrate status

# Apply pending migrations
docker-compose exec api npx prisma migrate deploy

# View migration history
docker-compose exec postgres psql -U weavenote -d weavenote -c "SELECT * FROM _prisma_migrations;"
```

### Rollback

If an update causes issues:

```bash
# Stop current version
docker-compose down

# Checkout previous version
git checkout <previous-tag>

# Restart
docker-compose up -d --build

# Or restore from backup
cat backup.sql | docker-compose exec -T postgres psql -U weavenote weavenote
```

---

## 🔧 Troubleshooting

### Common Issues

#### Docker Issues

| Problem | Solution |
|---------|----------|
| "Docker not found" | Install Docker Desktop and ensure it's running |
| "Port 8080 already in use" | Stop the conflicting service or change port in docker-compose.yml |
| "Permission denied" | Run as administrator (Windows) or use sudo (Linux) |
| "No space left on device" | Run `docker system prune -a` to clean up |

#### Database Issues

| Problem | Solution |
|---------|----------|
| "Connection refused" | Wait for PostgreSQL to fully start (30-60 seconds) |
| "Database doesn't exist" | Run `docker-compose down -v` then `docker-compose up -d --build` |
| "Authentication failed" | Check credentials in .env file |

#### Application Issues

| Problem | Solution |
|---------|----------|
| "AI not working" | Add Gemini API key in Settings → ENV Settings |
| "Login fails" | Check database connection, verify user exists |
| "Changes not saving" | Check API logs: `docker-compose logs -f api` |

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f postgres
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 api
```

### Reset Everything

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
docker-compose up -d --build
```

---

## ❓ FAQ

### General Questions

**Q: What is WeaveNote?**

A: WeaveNote is an AI-powered note-taking application that combines intelligent content synthesis with robust PostgreSQL storage. It's designed for professionals who need more than basic note apps, offering features like AI-powered summarization, multiple view modes, and enterprise-grade data management.

**Q: Is WeaveNote free?**

A: Yes, WeaveNote is open source. AI features require a free Google Gemini API key which has a generous free tier (60 requests/minute, 1500 requests/day).

**Q: Can I use WeaveNote offline?**

A: The Docker deployment runs entirely locally. AI features require internet access to call the Gemini API, but all other features work offline.

**Q: Where is my data stored?**

A: All data is stored in your local PostgreSQL database. Nothing is sent to external servers unless you configure Firebase integration or use AI features.

### Installation Questions

**Q: Do I need to know Docker to use WeaveNote?**

A: No! The Windows one-click installer handles everything automatically. For other platforms, basic Docker Compose commands are provided.

**Q: Can I run WeaveNote on a server?**

A: Yes, WeaveNote is fully containerized and can be deployed on any server with Docker. Configure environment variables for production security.

**Q: How do I update WeaveNote?**

A:
```bash
git pull origin main
docker-compose down
docker-compose up -d --build
```

**Q: Can I use a different database?**

A: WeaveNote is optimized for PostgreSQL. While Prisma supports other databases, switching requires schema modifications and is not officially supported.

### Configuration Questions

**Q: How do I get a Gemini API key?**

A:
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it in Settings → ENV Settings

**Q: Can I change the ports?**

A: Yes, edit `docker-compose.yml` and change the port mappings:
```yaml
services:
  frontend:
    ports:
      - "9000:80"  # Changed from 8080
```

**Q: How do I add users?**

A: Users can register through the application's login page. Admin users can manage users in Settings → User Base.

**Q: Can I customize themes?**

A: The app includes 15+ built-in themes. For custom themes, you can modify the theme definitions in the source code.

### Technical Questions

**Q: What tech stack does WeaveNote use?**

A:
- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL 16
- **Containerization**: Docker, Nginx
- **AI**: Google Gemini API

**Q: How is sensitive data protected?**

A:
- Passwords are hashed with bcrypt
- API keys and secrets are encrypted with AES-256-GCM
- JWT tokens for session management
- All sensitive files are gitignored

**Q: Can I contribute to WeaveNote?**

A: Yes! Fork the repository, make your changes, and submit a pull request. See the Development section for local setup instructions.

### Troubleshooting Questions

**Q: The installer says "Port already in use"**

A: Another application is using the required port. Either:
1. Stop the conflicting application
2. Change the port in `docker-compose.yml`

**Q: I forgot my password**

A: If you're the admin, you can:
1. Register a new account
2. Use the database to reset: `docker-compose exec postgres psql -U weavenote -d weavenote -c "UPDATE users SET password='new_hashed_password' WHERE email='your@email.com';"`

**Q: AI features aren't working**

A: Check:
1. Gemini API key is set in Settings → ENV Settings
2. API key is valid (test at Google AI Studio)
3. You haven't exceeded daily quota
4. Internet connection is available

**Q: Database is corrupted**

A: Restore from backup or reset:
```bash
docker-compose down -v
docker-compose up -d --build
```

---

## 👨‍💻 Development

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express + Prisma ORM |
| Database | PostgreSQL 16 |
| Containerization | Docker + Docker Compose |
| Web Server | Nginx (reverse proxy) |
| AI | Google Gemini API |

### Project Structure

```
Weavenote/
├── App.tsx                     # Main app state and routing
├── components/
│   ├── SettingsPanel.tsx       # Settings UI with ENV management
│   ├── NoteInput.tsx           # Note creation interface
│   ├── NoteCard.tsx            # Card rendering
│   └── ...
├── services/
│   ├── apiDatabaseService.ts   # API database adapter
│   ├── storageService.ts       # Storage abstraction layer
│   ├── authService.ts          # Authentication logic
│   └── ...
├── backend/
│   ├── src/
│   │   ├── index.js            # Express server
│   │   ├── routes/             # API routes
│   │   └── middleware/         # Auth middleware
│   └── prisma/
│       └── schema.prisma       # Database schema
├── Dockerfile                  # Frontend container
├── docker-compose.yml          # Full stack orchestration
├── install-weavenote.bat       # Windows one-click installer
├── install-weavenote.ps1       # PowerShell installer script
└── DOCKER.md                   # Detailed Docker documentation
```

### Development Commands

```bash
# Frontend development
npm install
npm run dev

# Backend development
cd backend
npm install
npm run dev

# Database management
cd backend
npx prisma studio    # Open database GUI
npx prisma migrate   # Run migrations
npx prisma generate  # Generate Prisma client

# Docker development
docker-compose up -d
docker-compose logs -f

# Run tests
npm test

# Build for production
npm run build

# Generate screenshots
npm run screenshots
```

---

## 🙏 Credits

### Core Development

| Role | Contributor |
|------|-------------|
| **Project Creator & Lead Developer** | [141stfighterwing-collab](https://github.com/141stfighterwing-collab) |
| **Docker & Infrastructure** | [141stfighterwing-collab](https://github.com/141stfighterwing-collab) |
| **Backend & Database Architecture** | [141stfighterwing-collab](https://github.com/141stfighterwing-collab) |
| **UI/UX Design & Implementation** | [Shootre](https://github.com/Shootre) |

### Special Thanks

- **Google Gemini Team** - For the powerful AI API that enables intelligent note synthesis
- **Vercel** - For Vite, the lightning-fast build tool
- **Prisma Team** - For the excellent ORM that makes database operations a breeze
- **Docker Team** - For containerization technology that simplifies deployment
- **Open Source Community** - For the countless libraries and tools that made this project possible

### Built With

- [React](https://reactjs.org/) - UI Library
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [Vite](https://vitejs.dev/) - Build Tool
- [Node.js](https://nodejs.org/) - Runtime
- [Express](https://expressjs.com/) - Web Framework
- [Prisma](https://www.prisma.io/) - ORM
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Docker](https://www.docker.com/) - Containerization
- [Nginx](https://nginx.org/) - Web Server
- [Google Gemini](https://ai.google.dev/) - AI API
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Playwright](https://playwright.dev/) - Testing & Screenshots

---

## 📞 Support & License

### Getting Help

- **Issues**: Open an issue on [GitHub Issues](https://github.com/141stfighterwing-collab/Weavenote/issues)
- **Discussions**: Use [GitHub Discussions](https://github.com/141stfighterwing-collab/Weavenote/discussions) for questions

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">

<p>Made with ❤️ by the WeaveNote Team</p>

<p>
  <a href="#-quick-start">🚀 Get Started Now</a> •
  <a href="#-faq">❓ FAQ</a> •
  <a href="https://github.com/141stfighterwing-collab/Weavenote/issues">🐛 Report Bug</a> •
  <a href="https://github.com/141stfighterwing-collab/Weavenote/issues">✨ Request Feature</a>
</p>

<p>
  <strong>Keywords:</strong> note-taking app, AI notes, PostgreSQL notes, Docker notes, self-hosted notes, knowledge management, project planning, Google Gemini AI, React notes app, TypeScript notes, open source notes, markdown notes, dark mode notes, offline notes, encrypted notes
</p>

<p>
  <a href="https://github.com/141stfighterwing-collab/Weavenote">
    <img src="https://img.shields.io/badge/GitHub-WeaveNote-blue?logo=github" alt="GitHub">
  </a>
</p>

</div>
