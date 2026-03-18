# Weavenote Installation Guide

## One-Click Installation for Windows

This guide walks you through the automated installation process using our PowerShell installer.

---

## Prerequisites

Before running the installer, ensure you have:

| Requirement | Download Link | Notes |
|-------------|---------------|-------|
| Docker Desktop | https://www.docker.com/products/docker-desktop | Must be running |
| PowerShell 5.1+ | Built into Windows 10/11 | |
| Git (optional) | https://git-scm.com | For cloning the repo |

---

## Installation Steps

### Step 1: Download and Extract

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Option A: Clone with Git                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  git clone https://github.com/141stfighterwing-collab/Weavenote.git        │
│  cd Weavenote                                                              │
│                                                                             │
│  Option B: Download ZIP                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  1. Go to https://github.com/141stfighterwing-collab/Weavenote             │
│  2. Click "Code" → "Download ZIP"                                           │
│  3. Extract to your preferred location                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 2: Run the Installer

**Method 1: Double-click `install-weavenote.bat`**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│     📁 Weavenote                                                           │
│     ├── 📁 backend                                                         │
│     ├── 📁 components                                                      │
│     ├── 📄 docker-compose.yml                                              │
│     ├── 📄 install-weavenote.bat    ◀── Double-click this file            │
│     ├── 📄 install-weavenote.ps1                                           │
│     └── ...                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Method 2: PowerShell**

```powershell
cd C:\path\to\Weavenote
powershell -ExecutionPolicy Bypass -File install-weavenote.ps1
```

---

## Installation Wizard Screenshots

### Welcome Screen

```
  ╔═══════════════════════════════════════════════════════════════════════════╗
  ║                                                                           ║
  ║   🧶 WEAVERNOTE DOCKER INSTALLER v1.0.0                                   ║
  ║                                                                           ║
  ║   AI-powered note workspace with PostgreSQL backend                       ║
  ║                                                                           ║
  ╚═══════════════════════════════════════════════════════════════════════════╝
```

### Step 1: Prerequisites Check

```
  ======================================================================
    Checking Prerequisites
  ======================================================================

  [i] Checking Docker Desktop...
  [✓] Docker Desktop is installed (Version: 24.0.6)
  [i] Checking Docker Compose...
  [✓] Docker Compose is installed (Version: v2.23.0)
  [i] Checking Git...
  [✓] Git is installed (git version 2.42.0)
  [i] Checking required ports...
  [✓] Port 8080 is available
  [✓] Port 3001 is available
  [✓] Port 5432 is available
```

### Step 2: Environment Configuration

```
  ======================================================================
    Configuring Environment Variables
  ======================================================================

  [i] Setting default configuration values...
  [✓] Default values configured

  ┌─────────────────────────────────────────────────────────────┐
  │ Required: POSTGRES_PASSWORD                                 │
  │ PostgreSQL database password                                │
  └─────────────────────────────────────────────────────────────┘

  Generate secure random value? (Y/n): y
  [✓] Generated secure value for POSTGRES_PASSWORD

  ┌─────────────────────────────────────────────────────────────┐
  │ Required: JWT_SECRET                                        │
  │ JWT signing secret (min 32 chars)                           │
  └─────────────────────────────────────────────────────────────┘

  Generate secure random value? (Y/n): y
  [✓] Generated secure value for JWT_SECRET

  ┌─────────────────────────────────────────────────────────────┐
  │ Required: GEMINI_API_KEY                                    │
  │ Google Gemini API key                                       │
  └─────────────────────────────────────────────────────────────┘

  Enter value for GEMINI_API_KEY: AIzaSy...your-key-here
```

### Step 3: Creating Configuration

```
  ┌─────────────────────────────────────────────────────────────┐
  │ Step 3/8 - Creating Configuration Files                     │
  │ Progress: 37%                                               │
  └─────────────────────────────────────────────────────────────┘

  [✓] Environment file created at: .env
  [✓] Backend environment file created
```

### Step 4: Building Docker Images

```
  ┌─────────────────────────────────────────────────────────────┐
  │ Step 5/8 - Building Docker Images                           │
  │ Progress: 62%                                               │
  └─────────────────────────────────────────────────────────────┘

  Building images [████████████░░░░░░░░] 60% - Building backend

  [i] Using: docker-compose
  [i] Executing build command...
  [+] Building 45.2s (23/23) FINISHED
  [✓] Docker images built successfully
```

### Step 5: Starting Services

```
  ┌─────────────────────────────────────────────────────────────┐
  │ Step 6/8 - Starting Docker Containers                       │
  │ Progress: 75%                                               │
  └─────────────────────────────────────────────────────────────┘

  Starting services [████████████████░░░░] 80% - Starting API server

  [i] Executing start command...
  [+] Running 4/4
   ✔ Network weavenote-network     Created
   ✔ Container weavenote-postgres  Started
   ✔ Container weavenote-api       Started
   ✔ Container weavenote-frontend  Started
  [✓] Containers started successfully
```

### Step 6: Database Initialization

```
  ┌─────────────────────────────────────────────────────────────┐
  │ Step 7/8 - Initializing Database                            │
  │ Progress: 87%                                               │
  └─────────────────────────────────────────────────────────────┘

  Database ready [██████████████████░░] 90% - Attempt 8/30

  [✓] Database is ready
  [i] Running database migrations...
  [✓] Database migrations completed
  [✓] Database initialized successfully
```

### Step 7: Health Checks

```
  ┌─────────────────────────────────────────────────────────────┐
  │ Step 8/8 - Running Health Checks                            │
  │ Progress: 100%                                              │
  └─────────────────────────────────────────────────────────────┘

  [i] Checking Frontend...
  [✓] Frontend is healthy
  [i] Checking API...
  [✓] API is healthy
```

### Final Status

```
  ======================================================================
    Docker Container Status
  ======================================================================

  NAMES                  STATUS                   PORTS
  weavenote-frontend     Up 30 seconds           0.0.0.0:8080->8080/tcp
  weavenote-api          Up 30 seconds           0.0.0.0:3001->3001/tcp
  weavenote-postgres     Up 32 seconds           0.0.0.0:5432->5432/tcp
```

---

## Installation Complete!

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │   🎉 WEAVERNOTE IS NOW RUNNING! 🎉                                  │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘

  Access Points:
  ─────────────────────────────────────────────────────────────────────
  📱 Frontend:      http://localhost:8080
  🔌 API:           http://localhost:3001/api
  🗄️  Database:      localhost:5432

  Credentials:
  ─────────────────────────────────────────────────────────────────────
  👤 Database User:     weavenote
  🔐 Database Password: ******** (saved in .env)
  🗄️  Database Name:    weavenote

  Quick Commands:
  ─────────────────────────────────────────────────────────────────────
  View logs:        docker-compose logs -f
  Stop services:    docker-compose down
  Restart:          docker-compose restart
  Open shell:       docker exec -it weavenote-api sh

  Settings:
  ─────────────────────────────────────────────────────────────────────
  ⚙️  Click the gear icon (⚙️) in the top-right corner to access settings
  🔐 Admin users can configure ENV variables in Settings → ENV Settings

  ┌─────────────────────────────────────────────────────────────────────┐
  │ ⚠️  IMPORTANT: Save your credentials securely!                      │
  │     Your .env file contains sensitive information.                 │
  │     Never commit .env files to version control.                    │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

The installer includes comprehensive error handling:

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Docker not running | Docker Desktop not started | Start Docker Desktop |
| Port already in use | Another app using port 8080/3001/5432 | Stop the conflicting app |
| Build failed | Network issues or missing files | Check internet, retry |
| Database timeout | Slow system | Increase timeout, retry |

### Error Log

Errors are logged to `weavenote-install-error.log`:

```
[2024-01-15 14:30:22] ERROR: Failed to start Docker containers
Exception: port is already allocated
StackTrace: at Start-DockerContainers...
```

### Cleanup on Failure

When installation fails, you'll be prompted:

```
  [✗] Installation failed. Check weavenote-install-error.log for details.

  Attempt to cleanup failed installation? (Y/n): y

  [i] Stopping containers...
  [i] Removing orphaned resources...
  [!] Installation was rolled back due to errors
```

---

## Getting Your Gemini API Key

1. Go to **https://makersuite.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (starts with `AIzaSy...`)
5. Paste it when prompted during installation

---

## Next Steps After Installation

1. **Access the Application**: Open http://localhost:8080
2. **Create an Account**: Click "Login" → "Register"
3. **Configure Settings**: Click ⚙️ → ENV Settings to add more API keys
4. **Start Taking Notes**: Create your first note!

---

## Uninstallation

To completely remove Weavenote:

```powershell
# Stop and remove containers
docker-compose down -v

# Remove images (optional)
docker rmi weavenote-frontend weavenote-api

# Remove data (optional)
docker volume rm weavenote-postgres-data
```

---

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Check the error log: `weavenote-install-error.log`
3. Open an issue: https://github.com/141stfighterwing-collab/Weavenote/issues
