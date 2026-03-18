<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# WeaveNote

AI-powered note workspace for capture, synthesis, project planning, and knowledge organization.

---

## Table of Contents

1. [Screenshots & Visual Guide](#1-screenshots--visual-guide)
2. [Versioning](#2-versioning)
3. [Quick Start](#3-quick-start)
4. [Docker Deployment](#4-docker-deployment)
5. [Environment Configuration](#5-environment-configuration)
6. [Settings Management](#6-settings-management)
7. [Version Control & Patching](#7-version-control--patching)
8. [API Reference](#8-api-reference)
9. [AI Model Configuration](#9-ai-model-configuration)
10. [Database Architecture](#10-database-architecture)
11. [Backup & Export](#11-backup--export)
12. [Security Recommendations](#12-security-recommendations)
13. [Development Guide](#13-development-guide)

---

## 1) Screenshots & Visual Guide

### Main Application Interface

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🧶 WeaveNote          [Grid|MindMap]  📊 Analytics  [🔍 Search...]  👤 Login ⚙️ │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐   ┌─────────────────────────────────────────────────────────┐   │
│  │ Sidebar │   │                    Main Content                        │   │
│  │         │   │  ┌─────────────────────────────────────────────────┐   │   │
│  │ Folders │   │  │  Note Input Area                                │   │   │
│  │ ├─ Work │   │  │  ┌──────────────────────────────────────────┐  │   │   │
│  │ ├─ Personal│ │  │  │ Enter your note here...                  │  │   │   │
│  │ └─ Ideas │   │  │  │                                          │  │   │   │
│  │         │   │  │  └──────────────────────────────────────────┘  │   │   │
│  │ Tags    │   │  │  [Quick] [Deep] [Code] [Project] [Notebook]   │   │   │
│  │ #work   │   │  └─────────────────────────────────────────────────┘   │   │
│  │ #ideas  │   │                                                     │   │
│  │ #todo   │   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │   │
│  │         │   │  │ 📝 Note 1    │  │ 📝 Note 2    │  │ 📝 Note 3    │ │   │
│  │ Calendar│   │  │              │  │              │  │              │ │   │
│  │ 📅 Today│   │  │ Content...   │  │ Content...   │  │ Content...   │ │   │
│  │         │   │  │ #work #idea  │  │ #personal    │  │ #todo        │ │   │
│  └─────────┘   │  └──────────────┘  └──────────────┘  └──────────────┘ │   │
│                └─────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────┤
│  🟢 Cloud Sync Active                              Daily AI Usage: 45/800    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Settings Panel - Entry Point

Click the **⚙️ gear icon** in the top-right corner to open the Settings Panel:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🧶 WeaveNote          [Grid|MindMap]  📊 Analytics  [🔍 Search...]  👤 Login ⚙️│
│                                                                   ↑          │
│                                                        Click here to open    │
│                                                        Settings Panel         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Settings Panel - Full View

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ System Control                                                           [ ✕ ]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  ┌──────────────────┐   ┌────────────────────────────────────────────────────────┐   │
│  │ Sidebar          │   │                    Content Area                        │   │
│  │                  │   │                                                        │   │
│  │ 🎨 Visuals       │   │  ┌──────────────────────────────────────────────────┐  │   │
│  │ 🛡️ My Security   │   │  │              Dark Mode                          │  │   │
│  │ ✨ AI Engine     │   │  │  [━━━━━━━━━━━━━━○──]                             │  │   │
│  │ 🔍 Diagnostics   │   │  └──────────────────────────────────────────────────┘  │   │
│  │                  │   │                                                        │   │
│  │ ── Admin Only ── │   │  ┌──────────────────────────────────────────────────┐  │   │
│  │ 🔐 ENV Settings  │   │  │              Theme Selector                     │  │   │
│  │ 📦 Versioning    │   │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │  │   │
│  │ 👥 User Base     │   │  │  │default│ocean│forest│sunset│rose│ ...       │  │   │
│  │ ☁️ Cloud Setup   │   │  │  └────┘ └────┘ └────┘ └────┘ └────┘           │  │   │
│  │ 📜 System Logs   │   │  └──────────────────────────────────────────────────┘  │   │
│  │                  │   │                                                        │   │
│  └──────────────────┘   └────────────────────────────────────────────────────────┘   │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### ENV Settings Tab (Admin Only)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ System Control                                                           [ ✕ ]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  ┌──────────────────┐   ┌────────────────────────────────────────────────────────┐   │
│  │ Sidebar          │   │  🔐 Environment Variables                              │   │
│  │                  │   │  Manage API keys, database credentials, and settings    │   │
│  │ 🎨 Visuals       │   │                                                        │   │
│  │ 🛡️ My Security   │   │  [Import .env] [Export .env] [+ Add Variable]          │   │
│  │ ✨ AI Engine     │   │                                                        │   │
│  │ 🔍 Diagnostics   │   │  Quick Add:                                            │   │
│  │                  │   │  [+ GEMINI_API_KEY] [+ POSTGRES_PASSWORD]              │   │
│  │ ── Admin Only ── │   │  [+ JWT_SECRET] [+ VITE_FIREBASE_API_KEY]              │   │
│  │ 🔐 ENV Settings ◀│   │                                                        │   │
│  │ 📦 Versioning    │   │  ┌──────────────────────────────────────────────────┐  │   │
│  │ 👥 User Base     │   │  │ Key              │ Value        │ Category│ Act │  │   │
│  │ ☁️ Cloud Setup   │   │  ├──────────────────────────────────────────────────┤  │   │
│  │ 📜 System Logs   │   │  │ GEMINI_API_KEY   │ •••••••••••• │ API     │📝 🗑️│  │   │
│  │                  │   │  │ POSTGRES_PASSWORD│ •••••••••••• │ Database│📝 🗑️│  │   │
│  └──────────────────┘   │  │ JWT_SECRET       │ •••••••••••• │ Security│📝 🗑️│  │   │
│                         │  └──────────────────────────────────────────────────┘  │   │
│                         │                                                        │   │
│                         │  ⚠️ Variables are encrypted and gitignored            │   │
│                         └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Add Environment Variable Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                     Add Variable                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Key                                                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ GEMINI_API_KEY                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Value                                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ AIzaSy...your-api-key-here...                             │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Category          │  ☑ Secret (encrypt)                        │
│  ┌───────────────┐ │                                            │
│  │ API           ▼│ │                                            │
│  └───────────────┘ │                                            │
│                                                                 │
│  Description (optional)                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Google Gemini AI API Key                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│              [Cancel]              [Save]                        │
└─────────────────────────────────────────────────────────────────┘
```

### Versioning Tab

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ System Control                                                           [ ✕ ]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  ┌──────────────────┐   ┌────────────────────────────────────────────────────────┐   │
│  │ Sidebar          │   │  📦 System Versioning                                  │   │
│  │                  │   │  Track patches, updates, and system changes             │   │
│  │ 🎨 Visuals       │   │                                                        │   │
│  │ 🛡️ My Security   │   │  ┌──────────────────────────────────────────────────┐  │   │
│  │ ✨ AI Engine     │   │  │  📦 v1.4.1                     Applied: 2024-01-15 │  │   │
│  │ 🔍 Diagnostics   │   │  │                                                    │  │   │
│  │                  │   │  │  Added ENV Settings UI, PostgreSQL backend,       │  │   │
│  │ ── Admin Only ── │   │  │  Docker support, and versioning system.           │  │   │
│  │ 🔐 ENV Settings  │   │  └──────────────────────────────────────────────────┘  │   │
│  │ 📦 Versioning ◀  │   │                                                        │   │
│  │ 👥 User Base     │   │  Version History:                                      │   │
│  │ ☁️ Cloud Setup   │   │  ┌──────────────────────────────────────────────────┐  │   │
│  │ 📜 System Logs   │   │  │ v1.4.1 │ Current  │ 2024-01-15                   │  │   │
│  │                  │   │  │ v1.4.0 │          │ 2024-01-10                   │  │   │
│  └──────────────────┘   │  │ v1.3.0 │ BREAKING │ 2024-01-05                   │  │   │
│                         │  └──────────────────────────────────────────────────┘  │   │
│                         └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Theme Selection

```
┌─────────────────────────────────────────────────────────────────┐
│                     Theme Selector                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │DEFAULT │ │ OCEAN  │ │ FOREST │ │ SUNSET │ │  ROSE  │       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │MIDNIGHT│ │ COFFEE │ │  NEON  │ │CYBERPUNK│ │  NORD  │       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │DRACULA │ │LAVENDER│ │  EARTH │ │ YELLOW │HYPERBLUE│       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Grid View vs Mindmap View

**Grid View:**
```
┌──────────────────────────────────────────────────────────────────┐
│  [Grid ████] [MindMap ○○]                                        │
├──────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │ 📝 Meeting    │  │ 📝 Project    │  │ 📝 Ideas      │        │
│  │ Notes         │  │ Planning      │  │               │        │
│  │               │  │               │  │               │        │
│  │ Discuss Q3... │  │ Milestones:   │  │ New features  │        │
│  │ #work #meeting│  │ #project      │  │ #ideas        │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │ 📝 Code       │  │ 📝 Research   │  │ 📝 Tasks      │        │
│  │ Snippets      │  │ Notes         │  │               │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

**Mindmap View:**
```
┌──────────────────────────────────────────────────────────────────┐
│  [Grid ○○] [MindMap ████]   [Performance OFF]                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         ┌─────────┐                              │
│                         │  Note 1 │                              │
│                         └────┬────┘                              │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│    ┌────┴────┐          ┌────┴────┐          ┌────┴────┐        │
│    │  Note 2 │          │  Note 3 │          │  Note 4 │        │
│    └────┬────┘          └────┬────┘          └─────────┘        │
│         │                    │                                  │
│    ┌────┴────┐               │                                  │
│    │  Note 5 │          ┌────┴────┐                             │
│    └─────────┘          │  Note 6 │                             │
│                         └─────────┘                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Running Screenshot Tests

Generate actual screenshots using Playwright:

```bash
# Install Playwright browsers
npx playwright install chromium

# Run screenshot tests
npm run screenshots

# View the HTML report
npm run show-report
```

Screenshots will be saved to `screenshots/` directory:
- `01-homepage.png` - Main application interface
- `02-settings-button-location.png` - Settings button location
- `03-settings-panel.png` - Settings panel overview
- `04-settings-visuals.png` - Visual settings tab
- `05-settings-env.png` - ENV settings tab (Admin)
- `06-add-env-variable.png` - Add variable modal
- `07-versioning.png` - Version control panel
- And more...

---

## 2) Versioning

WeaveNote follows **Semantic Versioning (SemVer)**.

- **Current app version:** `1.4.1` (from `package.json`)
- **Changelog:** see [`CHANGELOG.md`](./CHANGELOG.md)

Version format:

- `MAJOR` → breaking changes
- `MINOR` → backwards-compatible feature additions
- `PATCH` → backwards-compatible fixes

---

## 3) Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Docker & Docker Compose (for containerized deployment)

### Local Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build production bundle**
   ```bash
   npm run build
   ```

5. **Type-check/lint**
   ```bash
   npm run lint
   ```

---

## 4) Docker Deployment

### Architecture Overview

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

### Quick Docker Start

```bash
# 1. Clone the repository
git clone https://github.com/141stfighterwing-collab/Weavenote.git
cd Weavenote

# 2. Copy and configure environment
cp .env.example .env
nano .env  # Edit with your settings

# 3. Build and start all services
docker-compose up -d --build

# 4. Check service status
docker-compose ps

# 5. View logs
docker-compose logs -f
```

### Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:8080 | Main web application |
| API Health | http://localhost:8080/api/health | Backend health check |
| PostgreSQL | localhost:5432 | Database (if exposed) |
| pgAdmin | http://localhost:5050 | Database admin (optional) |

### Docker Commands Reference

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Rebuild containers
docker-compose up -d --build

# View logs for specific service
docker-compose logs -f api
docker-compose logs -f postgres

# Execute command in container
docker-compose exec api sh
docker-compose exec postgres psql -U weavenote -d weavenote

# Reset everything (including volumes)
docker-compose down -v
```

---

## 5) Environment Configuration

### Required Environment Variables

```bash
# PostgreSQL Database
POSTGRES_USER=weavenote
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=weavenote

# Security
JWT_SECRET=your_super_secret_jwt_key_min_32_chars

# AI Integration
GEMINI_API_KEY=your_gemini_api_key_here
```

### Optional Environment Variables

```bash
# Backend API
API_PORT=3001
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:8080,http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Firebase (for hybrid mode)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# pgAdmin (optional database admin)
PGADMIN_EMAIL=admin@weavenote.local
PGADMIN_PASSWORD=admin
```

### Environment File Management

**Important:** The `.env` file is **gitignored** and will never be committed to version control.

You can manage environment variables through:

1. **Direct File Edit** - Edit `.env` file manually
2. **Settings UI** - Use the in-app Settings panel (Admin → ENV Settings)
3. **Import/Export** - Import from or export to `.env` files via the UI

---

## 6) Settings Management

### Accessing Settings

1. Click the **⚙️ gear icon** in the top-right corner of the application
2. Navigate to the appropriate tab:

| Tab | Access | Description |
|-----|--------|-------------|
| 🎨 Visuals | All Users | Theme and appearance settings |
| 🛡️ My Security | All Users | Password and account settings |
| ✨ AI Engine | All Users | AI usage quota and logs |
| 🔍 Diagnostics | All Users | System health checks |
| 🔐 ENV Settings | Admin Only | Environment variable management |
| 📦 Versioning | Admin Only | System version history |
| 👥 User Base | Admin Only | User management |
| ☁️ Cloud Setup | Admin Only | Firebase and cloud configuration |
| 📜 System Logs | Admin Only | Audit logs |

### Environment Variables Settings (Admin)

Navigate to **Settings → ENV Settings** to manage all environment variables through the UI.

#### Features:
- **Add Variable**: Create new environment variables with categories
- **Edit Variable**: Modify existing variables (decrypted view)
- **Delete Variable**: Remove variables (Super Admin only)
- **Import .env**: Bulk import from `.env` file content
- **Export .env**: Download all variables as `.env` file

#### Variable Categories:

| Category | Color | Examples |
|----------|-------|----------|
| API | Indigo | GEMINI_API_KEY, API_KEY |
| Database | Emerald | POSTGRES_PASSWORD, DATABASE_URL |
| Firebase | Amber | VITE_FIREBASE_* |
| Security | Rose | JWT_SECRET, ENCRYPTION_KEY |
| General | Gray | APP_NAME, DEBUG |

#### Quick Add Templates:

Click on any quick-add button to pre-fill common keys:
- `GEMINI_API_KEY` - Google Gemini AI API Key
- `POSTGRES_PASSWORD` - PostgreSQL Database Password
- `JWT_SECRET` - JWT Signing Secret
- `VITE_FIREBASE_API_KEY` - Firebase API Key

### Security Notes

- All secret variables are **encrypted** before storage
- Values are **masked** (••••••••••••) in list views
- Only admins can view decrypted values
- Exported `.env` files should be handled securely
- Never commit `.env` files to version control

---

## 7) Version Control & Patching

### Viewing Version Information

Navigate to **Settings → Versioning** to see:
- Current system version
- Patch notes
- Version history
- Breaking change flags

### Version History

The system maintains a complete history of all patches and updates:
- Version number
- Application date
- Patch notes
- Breaking change indicators
- Rollback capability (Super Admin)

### API Endpoints

```bash
# Get current version
GET /api/version

# Get version history (Admin)
GET /api/version/history

# Apply new version (Super Admin)
POST /api/version/apply
{
  "version": "1.5.0",
  "patchNotes": "Added new features",
  "isBreaking": false,
  "requiresRestart": false
}

# Rollback to previous version (Super Admin)
POST /api/version/rollback/1.4.0
```

---

## 8) API Reference

### Authentication

```bash
# Register
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
# List all notes
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

# Delete note (soft delete)
DELETE /api/notes/:id

# Permanent delete
DELETE /api/notes/:id?permanent=true

# Restore deleted note
POST /api/notes/:id/restore

# Batch sync
POST /api/notes/sync
{
  "notes": [...]
}
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

### Settings (Admin)

```bash
# List all settings
GET /api/settings

# Get single setting
GET /api/settings/:id

# Create/Update setting
POST /api/settings
{
  "key": "GEMINI_API_KEY",
  "value": "your-key",
  "isSecret": true,
  "category": "api",
  "description": "Google Gemini API Key"
}

# Delete setting (Super Admin)
DELETE /api/settings/:id

# Export settings
POST /api/settings/export

# Import settings
POST /api/settings/import
{
  "content": "KEY=value\nKEY2=value2",
  "category": "general",
  "isSecret": true
}
```

---

## 9) AI Model Configuration

WeaveNote uses **Google Gemini** through `@google/genai`.

### Primary Model Routing (Fallback Order):

1. `gemini-3.1-pro-preview`
2. `gemini-3-flash-preview`

If the first model fails, the app retries with the second. Response format is constrained to JSON for structured note extraction/formatting.

### Setting Up Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add the key in **Settings → ENV Settings**:
   - Click **+ GEMINI_API_KEY** quick-add button
   - Paste your API key
   - Click **Save**

### Daily Usage Limits

- Default limit: 800 requests per day
- View usage in **Settings → AI Engine**
- Usage resets daily at midnight

---

## 10) Database Architecture

### PostgreSQL Schema

The application uses PostgreSQL with Prisma ORM for robust data management.

#### Core Tables:

| Table | Description |
|-------|-------------|
| `users` | User accounts and authentication |
| `sessions` | Active login sessions |
| `audit_logs` | Security audit trail |
| `notes` | Main note content |
| `note_tags` | Tag associations |
| `folders` | Note organization |
| `templates` | User templates |
| `system_settings` | Environment variables (encrypted) |
| `system_versions` | Version history |

#### Key Features:
- Full ACID compliance
- Proper indexing for performance
- Cascading deletes for data integrity
- Encrypted sensitive data storage

### Database Backups

```bash
# Create backup
docker-compose exec postgres pg_dump -U weavenote weavenote > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20240101.sql | docker-compose exec -T postgres psql -U weavenote weavenote
```

---

## 11) Backup & Export

### Export Formats

Admin export supports:

- **JSON** (`WeaveNote_Database_<timestamp>.json`)
- **CSV** (`WeaveNote_Database_<timestamp>.csv`)
- **SQL** (`WeaveNote_Database_<timestamp>.sql`)

### Accessing Export

Navigate to **Settings → Cloud Setup → Database Export** and select your preferred format.

---

## 12) Security Recommendations

1. **Environment Variables**
   - Move all keys to environment variables
   - Never commit `.env` files to version control
   - Use the Settings UI to manage sensitive keys

2. **Database Security**
   - Use strong PostgreSQL passwords
   - Restrict network access to database port
   - Enable SSL for database connections in production

3. **API Security**
   - Use strong JWT secrets (32+ characters)
   - Enable rate limiting
   - Configure CORS properly

4. **API Key Management**
   - Rotate Gemini API key periodically
   - Use API key restrictions in Google Cloud Console
   - Monitor API usage

5. **Authentication**
   - Require strong passwords (8+ characters)
   - Implement session timeout
   - Enable audit logging

---

## 13) Development Guide

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL 16
- **Styling**: Tailwind-style utility classes

### Project Structure

```text
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
└── DOCKER.md                   # Detailed Docker documentation
```

### Development Commands

```bash
# Frontend development
npm run dev

# Backend development
cd backend
npm run dev

# Database operations
cd backend
npx prisma studio    # Open database GUI
npx prisma migrate   # Run migrations

# Docker development
docker-compose up -d
docker-compose logs -f
```

---

## Support

For issues and feature requests, please open an issue on GitHub.

---

## License

Add your license here (MIT/Apache-2.0/Proprietary) as needed.
