<div align="center">

<img src="public/logo.svg" alt="WSH Logo" width="120" height="120" />

# WSH — WeaveNote Self-Hosted v4.4.7

**A self-hosted, AI-powered note-taking application with mind mapping, smart synthesis, and a beautiful dark-mode interface.**

Inspired by [WeaveNote](https://weavenote.com), WSH gives you full control over your notes and data — running entirely on your own infrastructure.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-FFC107?logo=bun)](https://bun.sh/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
  - [Configuring AI (Optional)](#configuring-ai-optional)
- [Docker Deployment](#docker-deployment)
  - [Quick Install (Recommended)](#quick-install-recommended)
  - [Updating WSH (Non-Destructive)](#updating-wsh-non-destructive)
  - [Available URLs](#available-urls)
  - [Default Login Credentials](#default-login-credentials)
  - [Custom Port](#custom-port)
  - [Include pgAdmin](#include-pgadmin)
  - [Manual Docker Commands](#manual-docker-commands)
  - [Docker Configuration](#docker-configuration)
  - [Docker Safety](#docker-safety)
- [Troubleshooting](#troubleshooting)
- [PowerShell Installer](#powershell-installer)
- [Project Structure](#project-structure)
- [API Routes](#api-routes)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Overview

**WSH (WeaveNote Self-Hosted)** is a feature-rich, self-hosted note-taking application designed for developers, researchers, and teams who value data sovereignty. Built on a modern stack of **Next.js 16**, **TypeScript**, and **Tailwind CSS 4**, WSH provides a sleek, dark-mode-first interface that runs entirely on your own hardware.

At its core, WSH combines powerful note management with an **AI Synthesis Engine** powered by a hybrid approach: local deterministic algorithms for **Generate Tags** and **Create Outline**, plus Claude, OpenAI, or Gemini for **Summarize**, **Expand**, and **Improve**. This reduces API dependency for lightweight structure-extraction tasks while preserving LLM power for generative rewriting. AI features remain optional — the app works fully without any AI keys configured, and tags/outlines can now run locally.

Key design principles:

- **Self-hosted first** — your data never leaves your server
- **Zero external JS dependencies for visualization** — custom SVG force graph without D3.js
- **localStorage persistence** — all application state survives page reloads
- **Role-based access control** — user, admin, and super-admin roles
- **Extensible architecture** — Prisma ORM with PostgreSQL for production-grade data management
- **Docker-safe cleanup** — install/uninstall scripts only touch WSH resources, never other containers

---

## Features

### 🧠 Mind Map

A fully interactive **SVG force-directed graph** that visualizes the relationships between your notes in real time. The mind map uses a custom physics simulation engine — no external D3.js dependency required.

- **Physics simulation** — Nodes repel each other while shared-tag edges attract connected notes, creating organic, balanced layouts automatically
- **Node dragging** — Click and drag any node to reposition it; the simulation continues around the pinned node
- **Pan & Zoom** — Click and drag the background to pan; use the zoom controls (or scroll) to zoom in/out from 30% to 300%
- **Tag-based edge connections** — Edges are automatically calculated between notes that share one or more tags, with edge thickness and opacity proportional to the number of shared tags
- **Color-coded by note type** — Each of the 6 note types has a distinct color: Quick (blue), Notebook (green), Deep (purple), Code (orange), Project (pink), Document (cyan)
- **Click-to-edit** — Clicking any node opens that note in the editor and closes the mind map
- **Legend** — A built-in legend in the bottom-left corner shows all note type colors
- **Zoom indicator** — Current zoom percentage displayed in the bottom-right corner
- **Reset view** — One-click button to reset pan and zoom to defaults
- **Node/edge counter** — Header displays the total number of nodes and connections

### ✅ Things to do Today

A personal **daily task checklist** in the right sidebar that helps you track what needs to get done each day. It's separate from the note system — designed for quick, lightweight task management right from your workspace.

- **Quick add** — Type a task and press Enter (or click the + button). Press Escape to cancel.
- **Check off items** — Click the checkbox to mark a task as complete. Completed items get a green checkmark, strikethrough text, and reduced opacity.
- **Progress tracking** — A gradient progress bar (amber → green) shows your completion percentage, with a counter showing remaining items.
- **Clear completed** — One-click "Clear done" button removes all finished tasks at once.
- **Delete individual items** — Hover over any task to reveal a trash icon for deletion.
- **Auto-reset at midnight** — Todos automatically clear when a new day begins. No stale tasks from yesterday.
- **Persistent** — All tasks are saved to your browser's `localStorage`, surviving page reloads and browser restarts. No database or server-side storage required.
- **Empty state** — When no tasks exist, a friendly message guides you to click "Add" to create your first task.
- **Scrollable** — The list has a maximum height with overflow scrolling, preventing sidebar overflow even with many tasks.

### 🗑️ Trash Modal

A comprehensive **soft-delete system** that protects you from accidental data loss while keeping your workspace clean.

- **Restore individual notes** — Hover over any trashed note and click "Restore" to move it back to your active notes with a single click
- **Permanent delete** — Remove notes forever with a dedicated delete action (cannot be undone)
- **Empty trash** — One-click button to permanently delete all trashed notes at once
- **AlertTriangle warning** — A prominent warning icon and message alerts you before irreversible actions
- **Deleted count badge** — The trash icon in the footer displays a live count of trashed notes, so you always know how many items are in the trash
- **Soft-delete architecture** — Notes are marked `isDeleted: true` rather than removed from the database, enabling full recovery

### 📖 Notebook View

A distraction-free **linear document reader** that presents all your notes as a continuous, scrollable document — like reading a book.

- **Full-screen reading mode** — Takes over the entire viewport for immersive reading, hiding all sidebar distractions
- **Sidebar navigation** — A compact sidebar lists all notes with their titles, allowing quick jumps between sections
- **Scroll tracking** — The sidebar highlights the currently visible note as you scroll through the document
- **Note pages** — Each note is rendered as a distinct page with a type badge (colored by note type), creation date, tags, and full content
- **Visual separators** — Elegant dividers between notes for clear visual separation
- **Tag display** — All tags associated with each note are shown as small badges beneath the note header

### 📝 Note Detail Modal

A **full-featured note viewer** that displays all metadata and content for any individual note without entering edit mode.

- **Type badge** — Displays the note's type with its corresponding color
- **Creation & updated dates** — Shows when the note was first created and last modified in a clean, formatted layout
- **Content rendering** — Full HTML rendering of the note's processed content with all formatting preserved
- **Raw content preview** — A collapsible section showing the raw markdown/plain-text source of the note
- **Edit action** — One-click button to open the note in the editor for modifications
- **Trash action** — One-click button to move the note to the trash
- **Tag display** — All associated tags shown as interactive badges

### 🌐 Web DB Viewer

A powerful **full-screen database browser** for inspecting and managing your WSH data directly from the web interface.

- **Full-screen database browser** — Dedicated full-viewport overlay for maximum screen real estate
- **Multiple tables** — Browse data across three core tables: Notes, Folders, and Users
- **Search & filter** — Real-time search filtering across all rows and columns
- **Inline editing** — Double-click any cell to edit its value directly in the table (with instant save)
- **Add new rows** — Create new notes, folders, or users directly from the viewer
- **Delete rows** — Remove records with confirmation dialogs
- **Column display** — All database fields are shown as sortable columns
- **Port 5682 access** — Designed to run on a dedicated admin port for secure, separate access

### 🔗 Mind Map API

A RESTful API endpoint that provides the graph data structure consumed by the Mind Map visualization.

**Endpoint:** `GET /api/graph?notes=[...]`

- **Returns nodes and edges** — The response contains a `nodes` array (each with `id`, `title`, `type`, `tags`) and an `edges` array (each with `source`, `target`, `weight`)
- **Tag-based connection calculation** — Automatically computes edges between notes that share one or more tags
- **Edge weighting** — The `weight` field indicates how many tags two notes share (higher = stronger connection)
- **Deleted note filtering** — Automatically excludes soft-deleted notes from the graph data
- **JSON API** — Returns clean, structured JSON for easy integration with any visualization library

### ⚠️ AlertTriangle for ENV Warning Banner

A prominent **security warning banner** displayed in the Admin Panel's ENV Settings section to remind administrators about the dangers of exposing environment variables.

- **Visual warning** — Uses the Lucide `AlertTriangle` icon with amber/yellow styling for high visibility
- **Security message** — Warns administrators to never commit `.env` files to version control or expose them publicly
- **Persistent display** — The warning remains visible whenever the ENV Settings section is active, ensuring it's always noticed

### 💾 ENV Import/Export Buttons

Convenient **file-based management** of your application's environment configuration directly from the Admin Panel.

- **Import .env files** — Upload a `.env` file from your local machine to load environment variables into the admin interface
- **Export current config** — Download all currently configured environment variables as a `.env` file
- **File download** — Exported files are automatically downloaded to your default downloads folder
- **Format preservation** — Both import and export use the standard `KEY=VALUE` format

### ➕ Quick Add Common Keys

One-click **preset buttons** that instantly add the most commonly used environment variables to the Admin Panel's ENV configuration.

- **Pre-configured keys** — Buttons for `PORT`, `APP_NAME`, `STORAGE_TYPE`, `BACKUP_INTERVAL`, `LOG_LEVEL`, and `MAX_UPLOAD_SIZE`
- **Default values** — Each preset comes with a sensible default value that you can modify after adding
- **Duplicate prevention** — Existing keys are not added again
- **Bulk configuration** — Quickly set up a complete environment configuration in seconds

### 🤖 AI Synthesis Engine

An intelligent **text processing engine** powered by Claude (Anthropic), OpenAI, or Google Gemini that transforms your notes using five distinct AI modes. AI is fully optional — WSH works perfectly without any API keys.

| Mode | Description |
|------|-------------|
| **Summarize** | Condenses note content into a concise summary while preserving key information |
| **Expand** | Enriches notes with additional detail, examples, and contextual information |
| **Improve** | Enhances writing quality by fixing grammar, improving clarity, and refining style |
| **Generate Tags** | Uses deterministic keyword/technical-term extraction to return relevant tags as a JSON array |
| **Create Outline** | Uses deterministic sentence scoring and topic extraction to generate a structured outline |

- **Hybrid synthesis pipeline** — Generate Tags and Create Outline run locally with deterministic algorithms (HTML stripping, stop-word removal, keyword ranking, technical-term extraction, sentence scoring) and do not consume AI tokens
- **Multi-provider support** — Choose between Claude, OpenAI, or Gemini for Summarize, Expand, and Improve by setting the corresponding API key in your environment
- **Auto-detection** — If no `AI_PROVIDER` is set, the system auto-detects which provider is available by checking API keys in order: Anthropic → OpenAI → Gemini
- **Per-user model selection** — Users can select their preferred provider and model from the Settings > AI Engine panel (only providers with configured API keys are shown)
- **Custom OpenAI-compatible endpoints** — Set `OPENAI_BASE_URL` to use Azure OpenAI, local LLMs (Ollama, LM Studio), or any OpenAI-compatible API
- **Daily usage limit** — Enforces a configurable daily limit (default: 800 requests/day) for LLM-backed modes only, with automatic counter reset at midnight
- **Configurable parameters** — Model name, temperature, and max tokens are all configurable via environment variables
- **Rate limiting** — Returns HTTP 429 when the daily limit is exceeded
- **Usage tracking** — Each response includes `tokensUsed` and `usageCount` for monitoring
- **No external SDK required** — Uses native `fetch` calls directly to provider APIs — no vendor lock-in

### 🛡️ Admin Panel

A comprehensive **system administration dashboard** with six distinct sections for managing every aspect of your WSH instance.

**Sections:**

1. **ENV Settings** — View, edit, import, and export environment variables with security warnings and quick-add presets
2. **Versioning** — View current application version, build information, and update history
3. **User Base** — Manage users, assign roles, view activity, and handle account status
4. **Cloud Setup** — Configure cloud backup, remote storage, and deployment settings
5. **DB Viewer** — Launch the full-screen Web DB Viewer for direct database inspection
6. **System Logs** — View real-time and historical application logs for debugging and monitoring

- **Role-based access** — Only users with `admin` or `super-admin` roles can access the panel
- **Tabbed navigation** — Clean tab-based UI for switching between sections
- **Responsive design** — Fully functional on both desktop and tablet screen sizes

### 🎨 15 Color Themes

### 🧠 AI Prompt Library

A comprehensive **prompt management system** for saving, organizing, and quickly accessing reusable AI prompt templates, integrated as a dedicated tab in the Note Editor alongside Quick, Notebook, Deep, Code, Project, and Document.

- **Editor tab integration** — Accessible via the "AI Prompts" tab in the Note Editor's tab bar, positioned directly alongside the six note type tabs for instant access without leaving the editing context
- **Create, edit, and delete prompts** — Full CRUD operations with inline editing, title and content fields, and confirmation-free quick actions
- **8 categories** — Organize prompts by type: General, Writing, Code, Analysis, Creative, Business, Research, Education
- **Custom tags** — Add comma-separated tags to each prompt for flexible cross-category search and filtering
- **Favorites system** — Star your most-used prompts for quick access with a dedicated favorites-only filter toggle
- **One-click copy** — Copy any prompt to clipboard with a single click, with visual "Copied!" confirmation feedback
- **Search and filter** — Real-time search across titles, content, and tags, plus category filtering and favorites-only mode
- **Multiple sort options** — Sort by newest, oldest, alphabetical (A-Z), or recently updated
- **localStorage persistence** — All prompts are saved to your browser's localStorage, surviving page reloads and browser restarts
- **5 starter prompts included** — Comes pre-loaded with useful templates: Summarize Text, Code Review Assistant, SWOT Analysis, Explain Like I'm 5, and Blog Post Outline

### 🎨 15 Color Themes

WSH ships with **15 hand-crafted color themes** that transform the entire application's look and feel with a single click.

| Theme | Mood |
|-------|------|
| **Default** | Clean, neutral dark mode |
| **Ocean** | Deep blues and teals |
| **Forest** | Rich greens and earth tones |
| **Sunset** | Warm oranges and reds |
| **Rose** | Soft pinks and blush tones |
| **Midnight** | Deep navy and charcoal |
| **Coffee** | Warm browns and cream |
| **Neon** | Vibrant electric colors on dark |
| **Cyberpunk** | Futuristic magentas and cyans |
| **Nord** | Cool arctic blues and grays |
| **Dracula** | Iconic purple-toned dark theme |
| **Lavender** | Soft purples and gentle gradients |
| **Earth** | Natural greens, browns, and sand |
| **Yellow** | Warm golden tones |
| **Hyperblue** | Intense electric blue |

- **Instant switching** — Theme changes apply immediately without page reload
- **Persistent selection** — Your chosen theme is saved to `localStorage` and restored on next visit
- **Full coverage** — Themes affect all components, cards, badges, backgrounds, and borders

### 📝 6 Note Types

WSH supports **six distinct note types**, each with its own colored badge, description, and visual treatment.

| Type | Color | Description |
|------|-------|-------------|
| **Quick** | Blue | Short, rapid notes for capturing thoughts, ideas, and reminders on the fly |
| **Notebook** | Green | Medium-length notes organized into sections, ideal for meeting notes and daily journals |
| **Deep** | Purple | Long-form, research-grade notes with detailed analysis, citations, and comprehensive content |
| **Code** | Orange | Technical notes with code snippets, configuration files, and development documentation |
| **Project** | Pink | Project planning notes with tasks, milestones, timelines, and deliverables |
| **Document** | Cyan | Formal documents, reports, and structured writing with distinct left-border styling |

- **Colored badges** — Each type displays a uniquely colored badge on every note card
- **Type filtering** — Filter your notes grid by type to focus on specific categories
- **Distinct descriptions** — The Note Editor displays a unique description for each type when selected

### 📂 Folders & Tags

A flexible **organizational system** combining hierarchical folders with flat tag-based categorization.

- **Folder creation and management** — Create, rename, reorder, and delete folders to organize notes hierarchically
- **Drag-and-drop** — Reorder folders with drag-and-drop using `@dnd-kit`
- **Tag management** — Add, remove, and filter by tags on any note
- **Multi-tag support** — Each note can have multiple tags for cross-cutting categorization
- **Folder filtering** — Click a folder in the sidebar to filter the notes grid to that folder's contents
- **Tag filtering** — Click a tag to see all notes sharing that tag across folders (neon-colored tags with glow effects)
- **Searchable tags** — Click any tag in the sidebar to instantly filter the notes grid; click again to clear

### 🔐 User Authentication

A secure **authentication system** with role-based access control for multi-user deployments, featuring both login and public self-registration.

- **Login & Sign Up** — Built-in tabbed auth widget with Login and Sign Up modes. New users can create accounts directly from the login popover with username, email (optional), password, and password confirmation fields. Password show/hide toggles are provided for usability.
- **Auto-login after registration** — Users are automatically logged in with a JWT token immediately after creating an account — no need to re-enter credentials.
- **Role-based access** — Three roles with escalating permissions:
  - `user` — Standard access to personal notes and basic features
  - `admin` — Access to the Admin Panel and user management
  - `super-admin` — Full system access including ENV settings and system logs
- **JWT tokens** — Secure token-based authentication with 7-day expiration
- **Rate limiting** — Login (10/min) and registration (3/min) rate limits per IP to prevent brute-force attacks
- **Password requirements** — Minimum 8 characters with at least 2 of: uppercase, lowercase, digit, special character
- **Status management** — User accounts can be set to `active`, `suspended` (auto-expires after 24h), or `banned` status
- **Default admin seeding** — On first Docker run, a super-admin account is automatically created from `ADMIN_DEFAULT_*` environment variables. A `prisma/seed.ts` script is also available for manual seeding during development (`bun run db:seed`).

### 🐳 Docker Support

WSH includes a production-ready **Docker configuration** for easy deployment on any server or cloud platform.

- **Multi-stage Dockerfile** — Three-stage build (deps → builder → runner) with visible progress output at each step
- **PostgreSQL backend** — Production-grade database with health checks, persistent volume storage, and automatic readiness detection
- **Health checks** — Built-in health check hitting `/api/health` every 30 seconds
- **Volume persistence** — PostgreSQL data stored in a named Docker volume (`postgres-data`) for data persistence across container restarts
- **Auto-restart** — Configured with `restart: unless-stopped` for high availability
- **Configurable environment** — All settings configurable via `docker-compose.yml` environment variables
- **Safe cleanup** — Install/uninstall scripts only target WSH resources, never touching other containers, images, or volumes on your system

### 📊 Analytics Panel

A visual **statistics dashboard** showing insights into your note-taking habits and data.

- **Note statistics** — Total notes, notes by type, notes by folder
- **Activity tracking** — Creation trends, update frequency
- **Tag analytics** — Most used tags, tag distribution
- **Visual charts** — Powered by Recharts for beautiful, interactive data visualization

### ⚙️ Settings Panel

A central **configuration panel** for personalizing your WSH experience.

- **Dark/light mode toggle** — Switch between dark and light themes with a single click
- **Theme selection** — Choose from all 15 color themes
- **View mode** — Toggle between grid and focus view modes
- **Preferences** — Configure editor behavior, default note type, and other personal settings

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ or [Bun](https://bun.sh/) 1.0+
- [PostgreSQL](https://www.postgresql.org/) 16+ (started automatically via Docker Compose)

### Installation

```bash
# Clone the repository
git clone https://github.com/141stfighterwing-collab/WSH.git
cd WSH

# Install dependencies
bun install

# Create your .env file (see Environment Variables table below)
cp .env.example .env
# Edit .env with your configuration

# Set up the database
bun run db:generate
bun run db:push

# Start the development server
bun run dev
```

Open [http://localhost:8883](http://localhost:8883) in your browser.

### Production Build

```bash
# Build for production
bun run build

# Start the production server
bun run start
```

### Configuring AI (Optional)

WSH's AI Synthesis features are **completely optional** — the app works fully without any API keys. To enable AI, set one or more provider API keys in your `.env` file:

```bash
# Option 1: Claude (Anthropic) — Recommended for strong reasoning
ANTHROPIC_API_KEY=sk-ant-api03-...

# Option 2: OpenAI — Versatile and widely used
OPENAI_API_KEY=sk-...

# Option 3: Gemini (Google) — Fast and multimodal
GEMINI_API_KEY=AIzaSy...

# Optional: Force a specific provider (auto-detects if not set)
# AI_PROVIDER=claude

# Optional: Override the default model
# AI_SYNTHESIS_MODEL=claude-sonnet-4-20250514

# Optional: Use a custom OpenAI-compatible endpoint (Ollama, LM Studio, Azure, etc.)
# OPENAI_BASE_URL=http://localhost:11434/v1
```

**How auto-detection works:**
1. If `AI_PROVIDER` is set → use that provider
2. If `AI_PROVIDER` is not set → check which API keys are configured, in this order:
   - `ANTHROPIC_API_KEY` → Claude
   - `OPENAI_API_KEY` → OpenAI
   - `GEMINI_API_KEY` → Gemini
3. If no keys are set → AI synthesis is disabled (Settings panel shows "No AI provider configured")

**Using your own LLM (Ollama, LM Studio, vLLM, etc.):**
Set `OPENAI_API_KEY` to any non-empty value and `OPENAI_BASE_URL` to your local endpoint:
```bash
OPENAI_API_KEY=not-needed
OPENAI_BASE_URL=http://localhost:11434/v1
AI_PROVIDER=openai
AI_SYNTHESIS_MODEL=llama3
```

**Available models per provider:**

| Provider | Available Models |
|----------|-----------------|
| **Claude** | claude-sonnet-4, claude-haiku-4, claude-3.5-sonnet, claude-3.5-haiku |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |
| **Gemini** | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash |

Users can select their preferred provider and model from **Settings > AI Engine** in the app. Only providers with configured API keys are shown as available.

---

## Docker Deployment

### Quick Install (Recommended)

The install script automatically removes only WSH containers, images, volumes, and networks before rebuilding from scratch. **Other Docker projects on your system are never affected.** See [Docker Safety](#docker-safety) for details.

**Windows (PowerShell):**
```powershell
git clone https://github.com/141stfighterwing-collab/WSH.git
cd WSH
.\install.ps1                    # Standard install (App + DB Viewer + PostgreSQL)
.\install.ps1 -WithPgAdmin        # Include pgAdmin on port 5050
.\install.ps1 -Port 8080          # Custom app port
.\install.ps1 -CleanOnly          # Remove only WSH resources without reinstalling
```

**Linux / macOS:**
```bash
git clone https://github.com/141stfighterwing-collab/WSH.git
cd WSH
chmod +x install.sh && ./install.sh                # Standard install
./install.sh --with-pgadmin                        # Include pgAdmin
./install.sh 8080                                  # Custom app port
./install.sh --clean-only                          # Remove only WSH resources without reinstalling
```

The install script will:
1. Stop and remove only WSH's own containers (by exact name: `wsh-postgres`, `weavenote-app`, `wsh-dbviewer`, `wsh-pgadmin`)
2. Use `docker compose down -v` for project-scoped volume/network removal
3. Remove only the locally-built WSH image (`weavenote:4.4.7`) — shared images like `postgres:16-alpine` and `adminer:latest` are left alone
4. Clean only WSH's build cache (filtered by project label) — not the system-wide build cache
5. Build the Docker image with visible progress at each step
6. Start all services (App + PostgreSQL + DB Viewer)
7. Validate that all 3 required containers are running

### Updating WSH (Non-Destructive)

When a new version is released, update WSH **without losing any data** using the update script:

**Windows:**
```powershell
cd WSH
.\update.ps1                    # Pull latest code + rebuild + restart
.\update.ps1 -NoCache           # Force full rebuild (no layer caching)
```

**Linux / macOS:**
```bash
cd WSH
./update.sh                    # Pull latest code + rebuild + restart
./update.sh --no-cache          # Force full rebuild (no layer caching)
```

The update script will:
1. `git pull` the latest code from GitHub
2. Rebuild the Docker image (uses layer caching — only changed layers rebuild)
3. Restart containers with `--force-recreate` (your PostgreSQL data is preserved)
4. Validate all services are running and health check passes

> **Note:** The install script (`install.sh` / `install.ps1`) is for first-time installs or complete resets. It destroys WSH data only. For ongoing updates, always use the update script.

### Available URLs

| Service | URL | Description |
|---------|-----|-------------|
| **WSH App** | http://localhost:8883 | Main application |
| **DB Viewer** | http://localhost:5682 | Adminer — browse database tables, run SQL queries |
| **pgAdmin** | http://localhost:5050 | Full PostgreSQL admin UI (requires `-WithPgAdmin` / `--with-pgadmin`) |

**pgAdmin login:** `admin@example.com` / `admin123` (configurable via `PGADMIN_EMAIL` / `PGADMIN_PASSWORD`)

### Default Login Credentials

The following table lists all default credentials created during a fresh WSH deployment. **Change all of these before exposing any service to a network.**

| Service | URL | Username / Email | Password | Configured Via |
|---------|-----|-------------------|----------|----------------|
| **WSH App** (admin) | http://localhost:8883 | `admin` | `admin123` | `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD` |
| **WSH App** (email) | http://localhost:8883 | `admin@example.com` | *(same as above)* | `ADMIN_DEFAULT_EMAIL` |
| **PostgreSQL** | `postgres:5432` *(internal)* | `wsh` | `wsh-secret-pw` | `POSTGRES_USER` / `POSTGRES_PASSWORD` |
| **DB Viewer** (Adminer) | http://localhost:5682 | *(see PostgreSQL)* | *(see PostgreSQL)* | `POSTGRES_USER` / `POSTGRES_PASSWORD` |
| **pgAdmin** *(optional)* | http://localhost:5050 | `admin@example.com` | `admin123` | `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` |

> ⚠️ **Security Warning:** The defaults above are for local development and first-run convenience only. Before deploying to any network-accessible environment, you must change at minimum `POSTGRES_PASSWORD`, `JWT_SECRET`, and `ADMIN_DEFAULT_PASSWORD`. The `JWT_SECRET` defaults to `change-me-in-production` — see the [Environment Variables](#environment-variables) table for the full list of security-critical settings.

### Custom Port

```powershell
.\install.ps1 -Port 8080        # Windows install
./install.sh 8080               # Linux/macOS install
```

### Include pgAdmin

```powershell
.\install.ps1 -WithPgAdmin      # Windows
./install.sh --with-pgadmin     # Linux/macOS
```

### Manual Docker Commands

If you prefer manual control:
```bash
docker compose down -v
docker compose build --no-cache
docker compose up -d --force-recreate
docker compose logs -f weavenote
```

### Docker Configuration

The `docker-compose.yml` includes:

- **PostgreSQL 16** — Production database with health checks and persistent volume storage
- **Health checks** — All services have automatic health monitoring (PostgreSQL: `pg_isready`, App: `/api/health`)
- **Container dependency ordering** — App and DB Viewer wait for PostgreSQL to be healthy before starting
- **Persistent storage** — PostgreSQL data in `postgres-data` volume, app data in `weavenote-data` volume
- **Dedicated network** — All services communicate via the `wsh-net` bridge network
- **Adminer DB Viewer** — Lightweight web database browser on port 5682 with `pepa-linhac` design theme
- **pgAdmin** — Full PostgreSQL admin UI on port 5050 (optional, enabled via `--profile admin`)
- **Environment passthrough** — All configuration via environment variables (see `.env.example`)
- **Auto-restart** — All containers configured with `restart: unless-stopped`
- **Version-tagged image** — Image tagged as `weavenote:4.4.7` for cache busting
- **Update scripts** — `update.sh` / `update.ps1` for non-destructive updates (git pull + rebuild without data loss)

### Docker Safety

> **Your other Docker projects are safe.** The install and update scripts use scoped cleanup that only targets WSH resources.

**What the scripts DO remove:**

| Resource | Target | Method |
|----------|--------|--------|
| Containers | `wsh-postgres`, `weavenote-app`, `wsh-dbviewer`, `wsh-pgadmin` | Exact name match |
| Images | `weavenote:4.4.7`, `weavenote:latest` | Exact tag match |
| Volumes | `postgres-data`, `weavenote-data`, `pgadmin-data` (with project prefix) | Exact name match |
| Networks | `wsh-net` (with project prefix) | Exact name match |
| Build cache | Only cache with WSH project label | `--filter` by project |

**What the scripts do NOT touch:**

- Any container not named `wsh-postgres`, `weavenote-app`, `wsh-dbviewer`, or `wsh-pgadmin`
- Any image not tagged `weavenote:*` (including shared images like `postgres:16-alpine`, `adminer:latest`, `dpage/pgadmin4:latest`)
- Any volume not named with WSH's project prefix
- Any network not created by WSH's docker-compose
- System-wide Docker prune (the old `docker system prune -af` has been removed)
- Containers, images, volumes, or networks from other Docker Compose projects

**Why this matters:** If you have other applications running in Docker (e.g., a WordPress site, a home automation stack, or another development project), running `./install.sh` or `./install.ps1` will NOT affect them. The old scripts used broad `grep` pattern matching and `docker system prune -af`, which could destroy unrelated containers and data.

---

## Troubleshooting

### `update.ps1` shows "NativeCommandError" from git pull

**Symptom:** When running `.\update.ps1` on Windows PowerShell, you see red error output like:

```
git : From https://github.com/141stfighterwing-collab/WSH
    + CategoryInfo          : NotSpecified: (String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
```

**Cause:** This is a known PowerShell behavior, not an actual failure. Git writes progress information (like `From https://...`) to **stderr**. PowerShell treats all stderr output from native (non-PowerShell) commands as errors and displays them in red, even when the command succeeds. The update itself completes normally despite the red text.

**Fix:** This was fixed in **v4.1.2** by adding `$ErrorActionPreference = "SilentlyContinue"` to `update.ps1` (matching the behavior already present in `install.ps1`). To get the fix:

```powershell
git pull origin main
.\update.ps1
```

If you're still seeing the error after pulling v4.1.2, you can manually suppress it:

```powershell
$ErrorActionPreference = "SilentlyContinue"
.\update.ps1
```

### Git pull fails with "local changes" or merge conflicts

If `git pull` fails because you have local modifications:

```powershell
git stash          # Temporarily save your changes
git pull origin main
git stash pop      # Restore your changes
```

Or if you want to discard local changes and reset to upstream:

```powershell
git fetch origin
git reset --hard origin/main
```

### Docker build fails after update

If the Docker image fails to build after pulling new code, try a clean rebuild:

```powershell
.\update.ps1 -NoCache    # Windows
./update.sh --no-cache   # Linux/macOS
```

### Containers start but health check fails

The health check waits 15 seconds after starting containers. Some systems may need more time. Wait 30-60 seconds and check manually:

```bash
curl http://localhost:8883/api/health
```

Or check container logs:

```bash
docker compose logs -f weavenote
```

### "Already up to date" but version hasn't changed

This means your local code is already at the latest commit. If you expected a new version, verify you're on the `main` branch:

```powershell
git branch            # Should show * main
git log --oneline -3  # Check recent commits
```

---

## PowerShell Installer

The Windows PowerShell installer (`install.ps1`) provides the same functionality as the Bash version with identical safety guarantees:

```powershell
# First-time install
.\install.ps1

# Install with pgAdmin
.\install.ps1 -WithPgAdmin

# Install on custom port
.\install.ps1 -Port 8080

# Clean only (remove WSH resources without reinstalling)
.\install.ps1 -CleanOnly

# Update (non-destructive, preserves data)
.\update.ps1

# Force full rebuild
.\update.ps1 -NoCache
```

---

## Project Structure

```
wsh/
├── public/
│   ├── logo.svg              # WSH application logo
│   └── robots.txt            # Search engine directives
├── src/
│   ├── app/
│   │   ├── globals.css       # Global styles and theme definitions
│   │   ├── layout.tsx        # Root layout with providers
│   │   ├── page.tsx          # Main application page
│   │   └── api/
│   │       ├── health/       # Health check endpoint
│   │       ├── synthesis/    # AI synthesis endpoint
│   │       ├── graph/        # Mind map graph data endpoint
│   │       └── admin/
│   │           ├── env/      # ENV settings management
│   │           ├── users/    # User management
│   │           ├── system/   # System information
│   │           └── logs/     # System logs
│   ├── components/
│   │   ├── ui/               # shadcn/ui base components
│   │   └── wsh/              # WSH application components
│   │       ├── MindMap.tsx       # SVG force-directed graph
│   │       ├── TrashModal.tsx    # Soft-delete/restore modal
│   │       ├── NotebookView.tsx  # Linear document reader
│   │       ├── NoteDetailModal.tsx # Individual note viewer
│   │       ├── DBViewer.tsx      # Full-screen database browser
│   │       ├── AdminPanel.tsx    # Admin dashboard
│   │       ├── NoteEditor.tsx    # Rich text note editor
│   │       ├── NotesGrid.tsx     # Notes grid display
│   │       ├── Folders.tsx       # Folder management
│   │       ├── Tags.tsx          # Tag management
│   │       ├── AnalyticsPanel.tsx # Statistics dashboard
│   │       ├── SettingsPanel.tsx  # Settings & preferences
│   │       ├── LoginWidget.tsx    # Authentication UI
│   │       ├── Header.tsx         # Application header
│   │       ├── Footer.tsx         # Application footer
│   │       ├── LeftSidebar.tsx    # Calendar, Folders, Tags
│   │       ├── RightSidebar.tsx   # Live Clock, TodoChecklist (Things to do Today), Today's Things, Projects
│   │       ├── Calendar.tsx       # Compact calendar view
│   │       ├── QuickReferences.tsx # Template quick access
│   │       ├── FarRightSidebar.tsx # Legacy (content merged into RightSidebar)
│   │       ├── Logo.tsx           # WSH logo component
│   │       └── PromptLibrary.tsx   # AI Prompt Library management
│   ├── hooks/
│   │   ├── use-toast.ts      # Toast notification hook
│   │   └── use-mobile.ts     # Mobile detection hook
│   ├── lib/
│   │   ├── db.ts             # Prisma database client
│   │   └── utils.ts          # Utility functions
│   └── store/
│       └── wshStore.ts       # Zustand global state store
├── prisma/
│   └── schema.prisma         # Database schema (PostgreSQL)
├── docker-compose.yml        # Docker Compose (PostgreSQL + App + DB Viewer + pgAdmin)
├── Dockerfile                # Multi-stage Docker build (deps → build → runner)
├── docker-entrypoint.sh      # Container startup script (DB init + server)
├── install.ps1               # Windows PowerShell auto-nuke & install (WSH-scoped)
├── install.sh                # Linux/macOS auto-nuke & install (WSH-scoped)
├── update.ps1                # Windows PowerShell non-destructive update
├── update.sh                 # Linux/macOS non-destructive update
├── Caddyfile                 # Caddy reverse proxy config
├── next.config.ts            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

---

## API Routes

### `GET /api/health`

Health check endpoint. Returns the application status, version, and current timestamp.

```json
{ "status": "healthy", "version": "4.4.7", "timestamp": "2026-06-12T12:00:00.000Z" }
```

### `POST /api/synthesis`

AI synthesis endpoint for processing note content through five modes.

**Request body:**
```json
{ "content": "Your note content here...", "action": "summarize", "provider": "claude", "model": "claude-sonnet-4-20250514" }
```

- `provider` and `model` are optional — if omitted, the server uses `AI_PROVIDER` env var or auto-detects from available API keys

**Valid actions:** `summarize`, `expand`, `improve`, `tags`, `outline`

**Response:**
```json
{ "result": "AI-generated content...", "tokensUsed": 245, "usageCount": 1, "provider": "claude" }
```

For `tags` and `outline`, the API may return `provider: "local-algorithm"` with `tokensUsed: 0` because those modes now run locally.

**Rate limit:** Returns HTTP 429 when the daily limit (default: 800) is exceeded.

### `GET /api/synthesis`

Returns which AI providers are configured and available.

**Response:**
```json
{
  "provider": "claude",
  "available": { "claude": true, "openai": false, "gemini": false },
  "configured": ["claude"],
  "model": "claude-sonnet-4-20250514"
}
```

### `GET /api/graph?notes=[...]`

Mind Map graph data endpoint. Returns nodes and edges calculated from shared tags.

**Query parameter:** `notes` — URL-encoded JSON array of note objects

**Response:**
```json
{
  "nodes": [
    { "id": "...", "title": "Note Title", "type": "quick", "tags": ["tag1", "tag2"] }
  ],
  "edges": [
    { "source": "id1", "target": "id2", "weight": 2 }
  ]
}
```

### `GET|POST /api/admin/env`

Admin endpoint for reading and writing environment variable configuration.

### `GET /api/admin/system`

Admin endpoint for retrieving system information (version, uptime, resource usage).

### `GET|POST /api/admin/users`

Admin endpoint for user management (list, create, update roles, suspend accounts).

### `POST /api/admin/users/register`

Public registration endpoint for creating new user accounts. No authentication required.

**Request body:**
```json
{ "username": "newuser", "password": "MyP@ss1234", "confirmPassword": "MyP@ss1234", "email": "user@example.com" }
```

**Response (201 Created):**
```json
{ "user": { "id": "...", "username": "newuser", "email": "user@example.com", "role": "user", "status": "active" }, "token": "eyJ...", "message": "Registration successful — logged in automatically" }
```

**Validation rules:**
- Username: minimum 2 characters, must be unique
- Password: minimum 8 characters, at least 2 of: uppercase, lowercase, digit, special character
- Email: optional, must be valid format if provided (defaults to `username@example.com`)
- `confirmPassword`: must match `password` field

**Rate limit:** 3 registrations per minute per IP address. Returns HTTP 429 when exceeded.

### `POST /api/admin/users/login`

Public authentication endpoint for logging in. No authentication required.

**Request body:**
```json
{ "username": "admin", "password": "admin123" }
```

**Response:**
```json
{ "user": { "id": "...", "username": "admin", "email": "admin@example.com", "role": "super-admin", "status": "active" }, "token": "eyJ...", "message": "Login successful" }
```

**Rate limit:** 10 login attempts per minute per IP address.

### `GET /api/admin/logs`

Admin endpoint for retrieving application logs (filterable by level and time range).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8883` | Application listening port |
| `HOSTNAME` | `0.0.0.0` | Application bind address |
| `DATABASE_URL` | `postgresql://wsh:wsh-secret-pw@postgres:5432/weavenote` | PostgreSQL connection string (set by docker-compose) |
| `JWT_SECRET` | `change-me-in-production` | Secret key for JWT token signing (**change in production!**) |
| `ADMIN_DEFAULT_USERNAME` | `admin` | Default admin username on first run |
| `ADMIN_DEFAULT_EMAIL` | `admin@example.com` | Default admin email on first run |
| `ADMIN_DEFAULT_PASSWORD` | `admin123` | Default admin password on first run (**change immediately!**) |
| `AI_PROVIDER` | *(auto-detect)* | Force a specific AI provider: `claude`, `openai`, or `gemini`. If not set, auto-detects from API keys below. |
| `ANTHROPIC_API_KEY` | *(none)* | Anthropic API key for Claude models. Get one at [console.anthropic.com](https://console.anthropic.com/) |
| `OPENAI_API_KEY` | *(none)* | OpenAI API key for GPT models. Get one at [platform.openai.com](https://platform.openai.com/api-keys) |
| `GEMINI_API_KEY` | *(none)* | Google AI API key for Gemini models. Get one at [aistudio.google.com](https://aistudio.google.com/apikey) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Custom OpenAI-compatible base URL (for Azure OpenAI, Ollama, LM Studio, etc.) |
| `AI_SYNTHESIS_MODEL` | *(provider default)* | Default AI model. If not set, each provider uses its own default model. |
| `AI_SYNTHESIS_TEMPERATURE` | `0.7` | AI response creativity (0.0–1.0) |
| `AI_SYNTHESIS_MAX_TOKENS` | `4096` | Maximum tokens per AI response |
| `AI_DAILY_LIMIT` | `800` | Maximum AI synthesis requests per day |
| `APP_NAME` | `WSH` | Application display name |
| `STORAGE_TYPE` | `local` | Storage backend type (`local` or `cloud`) |
| `BACKUP_INTERVAL` | `24h` | Automatic backup interval |
| `LOG_LEVEL` | `info` | Application log verbosity (`debug`, `info`, `warn`, `error`) |
| `MAX_UPLOAD_SIZE` | `10mb` | Maximum file upload size |

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui + Radix UI |
| State Management | Zustand 5 |
| Database | PostgreSQL 16 via Prisma ORM |
| AI Integration | Anthropic / OpenAI / Gemini (native fetch) |
| Charts | Recharts |
| Animations | Framer Motion |
| Icons | Lucide React |
| Drag & Drop | @dnd-kit |
| Runtime | Bun / Node.js |
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Caddy (optional) |

---

## License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 WSH Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

<div align="center">

**Built with ❤️ by the WSH Contributors**

</div>
