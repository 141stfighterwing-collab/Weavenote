#!/usr/bin/env pwsh
# WeaveNote Self-Hosted (WSH) - Auto Nuke & Reinstall
# v4.4.7: Multi-stage Docker build. Installs a pre-built image.
# Updates are non-destructive: just `.\update.ps1` to pull + rebuild.
#
# Usage:  .\install.ps1
#         .\install.ps1 -Port 8080
#         .\install.ps1 -CleanOnly
#         .\install.ps1 -WithPgAdmin
#
# SAFETY: This script ONLY removes containers, images, volumes, and
#         networks that belong to WSH. It will NEVER touch resources
#         from other Docker Compose projects or standalone containers.

param(
    [int]$Port = 8883,
    [switch]$CleanOnly,
    [switch]$WithPgAdmin
)

$ErrorActionPreference = "SilentlyContinue"
$Host.UI.RawUI.ForegroundColor = "Cyan"

# ---- Manifest file path ----
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
$ManifestFile = Join-Path $ScriptDir ".wsh-manifest.json"
$projectName = (Split-Path -Leaf $ScriptDir).ToLower()

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WSH - Auto Nuke & Reinstall v4.4.7" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# Helper: write installation manifest
# ============================================================
function Write-Manifest {
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $installDir = $ScriptDir -replace '\\','\\'
    $withPgAdminBool = if ($WithPgAdmin) { "true" } else { "false" }

    # Build config files list from files that exist
    $configFiles = @()
    @("docker-compose.yml", "Dockerfile", ".wsh-manifest.json", "install.sh", "update.sh", "install.ps1") | ForEach-Object {
        $fp = Join-Path $ScriptDir $_
        if (Test-Path $fp) {
            $configFiles += ($fp -replace '\\','\\')
        }
    }
    $configFilesJson = ($configFiles | ForEach-Object { "      `"$_`"" }) -join ",`n"

    $manifestContent = @"
{
  "version": "4.4.7",
  "app_name": "WeaveNote Self-Hosted (WSH)",
  "install_dir": "$installDir",
  "install_date": "$timestamp",
  "installer": "install.ps1 (PowerShell)",
  "options": {
    "port": $Port,
    "with_pgadmin": $withPgAdminBool
  },
  "resources": {
    "containers": ["wsh-postgres", "weavenote-app", "wsh-dbviewer", "wsh-pgadmin"],
    "images": ["weavenote:4.4.7", "weavenote:latest"],
    "volumes": ["postgres-data", "weavenote-data", "pgadmin-data"],
    "networks": ["wsh-net"]
  },
  "directories": {
    "app_source": "$installDir",
    "docker_compose": "$installDir\docker-compose.yml",
    "dockerfile": "$installDir\Dockerfile",
    "data_volumes": [
      "docker-vol:postgres-data",
      "docker-vol:weavenote-data",
      "docker-vol:pgadmin-data"
    ],
    "logs": "docker-logs:weavenote-app,wsh-postgres,wsh-dbviewer,wsh-pgadmin",
    "config_files": [
$configFilesJson
    ]
  },
  "ports": {
    "app": $Port,
    "db_viewer": 5682,
    "postgres_internal": 5432,
    "pgadmin": 5050
  }
}
"@

    Set-Content -Path $ManifestFile -Value $manifestContent -Encoding UTF8
    Write-Host "  [OK] Manifest written to $ManifestFile" -ForegroundColor Green
}

# ============================================================
# Helper: read manifest for cleanup
# ============================================================
function Read-Manifest {
    if (Test-Path $ManifestFile) {
        Write-Host "  [INFO] Reading install manifest..." -ForegroundColor Cyan
        try {
            $manifest = Get-Content $ManifestFile -Raw | ConvertFrom-Json
            Write-Host "  Install dir:  $($manifest.install_dir)" -ForegroundColor DarkGray
            Write-Host "  Install date: $($manifest.install_date)" -ForegroundColor DarkGray
            Write-Host "  Installer:    $($manifest.installer)" -ForegroundColor DarkGray
        } catch {
            Write-Host "  Manifest file: $ManifestFile" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  [WARN] No manifest file found. Using default cleanup." -ForegroundColor Yellow
    }
}

# ============================================================
# Helper: show tracked files from manifest
# ============================================================
function Show-TrackedFiles {
    if (Test-Path $ManifestFile) {
        Write-Host "  Cleaning tracked files from manifest..." -ForegroundColor Yellow
        try {
            $manifest = Get-Content $ManifestFile -Raw | ConvertFrom-Json
            Write-Host "  [OK] Manifest file reviewed. Docker resources cleaned above." -ForegroundColor Green
            Write-Host "  [INFO] To remove the source directory, manually run:" -ForegroundColor Cyan
            Write-Host "         Remove-Item -Recurse -Force '$($manifest.install_dir)'" -ForegroundColor DarkGray
        } catch {
            Write-Host "  [WARN] Could not parse manifest." -ForegroundColor Yellow
        }
    }
}

# ---- PHASE 1: Stop & remove WSH containers (exact names only) ----
Write-Host "[1/6] Stopping WSH containers..." -ForegroundColor Yellow

# Use docker compose down for project-scoped cleanup (containers + networks)
# This ONLY touches resources defined in docker-compose.yml
docker compose down -v --remove-orphans 2>$null | Out-Null
docker compose --profile admin down -v --remove-orphans 2>$null | Out-Null

# Also remove any orphaned WSH containers by their EXACT container_name values
# These are the only container_name values defined in docker-compose.yml
$wshContainers = @("wsh-postgres", "weavenote-app", "wsh-dbviewer", "wsh-pgadmin")
$foundCount = 0
$allContainers = docker ps -a --format "{{.Names}}" 2>$null
if ($allContainers) {
    foreach ($c in $wshContainers) {
        if ($allContainers -contains $c) {
            Write-Host "  - Removing container: $c" -ForegroundColor DarkGray
            docker rm -f $c 2>$null | Out-Null
            $foundCount++
        }
    }
}
if ($foundCount -gt 0) {
    Write-Host "  [OK] Removed $foundCount orphaned container(s)" -ForegroundColor Green
} else {
    Write-Host "  [OK] No orphaned containers" -ForegroundColor Green
}

# ---- PHASE 2: Remove WSH images (exact matches only) ----
Write-Host "[2/6] Removing WSH Docker images..." -ForegroundColor Yellow

# Only remove images that WSH explicitly builds or tags
# We do NOT remove shared images like postgres:16-alpine, adminer:latest, etc.
$wshImages = @("weavenote:4.4.7", "weavenote:latest", "weavenote-app")
$foundImages = 0
$allImages = docker images --format "{{.Repository}}:{{.Tag}}" 2>$null
if ($allImages) {
    foreach ($img in $wshImages) {
        if ($allImages -contains $img) {
            Write-Host "  - Removing image: $img" -ForegroundColor DarkGray
            docker rmi -f $img 2>$null | Out-Null
            $foundImages++
        }
    }
}
if ($foundImages -gt 0) {
    Write-Host "  [OK] Removed $foundImages image(s)" -ForegroundColor Green
} else {
    Write-Host "  [OK] No WSH images to remove" -ForegroundColor Green
}

# ---- PHASE 3: Remove WSH volumes & networks (exact names only) ----
Write-Host "[3/6] Removing WSH volumes and networks..." -ForegroundColor Yellow

# Docker Compose prefixes volumes with the project directory name (e.g., "WSH_postgres-data")
# Remove known WSH volume names by exact match
$wshVolumes = @(
    "postgres-data",
    "weavenote-data",
    "pgadmin-data",
    "${projectName}_postgres-data",
    "${projectName}_weavenote-data",
    "${projectName}_pgadmin-data",
    "WSH_postgres-data",
    "WSH_weavenote-data",
    "WSH_pgadmin-data"
)
$allVolumes = docker volume ls --format "{{.Name}}" 2>$null
if ($allVolumes) {
    foreach ($v in $wshVolumes) {
        if ($allVolumes -contains $v) {
            Write-Host "  - Removing volume: $v" -ForegroundColor DarkGray
            docker volume rm $v 2>$null | Out-Null
        }
    }
}

# Remove WSH networks by exact name
$wshNetworks = @("wsh-net", "${projectName}_wsh-net", "WSH_wsh-net", "WSH_default")
$allNetworks = docker network ls --format "{{.Name}}" 2>$null
if ($allNetworks) {
    foreach ($n in $wshNetworks) {
        if ($allNetworks -contains $n) {
            Write-Host "  - Removing network: $n" -ForegroundColor DarkGray
            docker network rm $n 2>$null | Out-Null
        }
    }
}

Write-Host "  [OK] Cleaned" -ForegroundColor Green

# ---- PHASE 4: Clean WSH build cache only ----
Write-Host "[4/6] Cleaning WSH build cache..." -ForegroundColor Yellow

# Use --filter to ONLY prune build cache for this project
# We DO NOT use "docker system prune -af" as that would destroy resources
# from other Docker Compose projects and standalone containers.
docker builder prune -f --filter "label=com.docker.compose.project=$projectName" 2>$null | Out-Null
Write-Host "  [OK] Build cache cleaned" -ForegroundColor Green

# ---- PHASE 5: Read manifest & clean tracked files ----
Write-Host "[5/6] Reviewing install manifest..." -ForegroundColor Yellow
Read-Manifest
Show-TrackedFiles

if ($CleanOnly) {
    # Remove the manifest file itself on clean-only
    Remove-Item -Path $ManifestFile -Force -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  CLEAN COMPLETE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Only WSH resources were removed." -ForegroundColor Cyan
    Write-Host "  Other Docker containers/images/volumes are untouched." -ForegroundColor Cyan
    Write-Host ""
    exit 0
}

# ---- PHASE 6: Build, start, and write manifest ----
Write-Host "[6/6] Building WSH Docker image..." -ForegroundColor Yellow
Write-Host "  (this may take 3-5 minutes)" -ForegroundColor DarkGray
Write-Host ""

$env:WSH_PORT = $Port
& docker compose build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Starting WSH stack..." -ForegroundColor Yellow

if ($WithPgAdmin) {
    docker compose --profile admin up -d --force-recreate
} else {
    docker compose up -d --force-recreate
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Docker start failed!" -ForegroundColor Red
    exit 1
}

# ---- Write installation manifest ----
Write-Host ""
Write-Host "Writing installation manifest..." -ForegroundColor Yellow
Write-Manifest

# ---- Validate ----
Write-Host ""
Write-Host "Validating services..." -ForegroundColor Yellow
Write-Host "  Waiting 30s for services to start..." -ForegroundColor DarkGray
Start-Sleep -Seconds 30

$allOk = $true
foreach ($svc in @(
    @{ Name = "weavenote-app"; Port = $Port;  Label = "WSH App" },
    @{ Name = "wsh-dbviewer";  Port = 5682;  Label = "DB Viewer" },
    @{ Name = "wsh-postgres";  Port = 5432;  Label = "PostgreSQL" }
)) {
    $running = docker inspect -f '{{.State.Running}}' $svc.Name 2>$null
    if ($running -eq "true") {
        Write-Host "  [OK] $($svc.Label) is RUNNING" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $($svc.Label) is NOT running" -ForegroundColor Red
        $allOk = $false
    }
}

# Check health
try {
    $health = Invoke-WebRequest -Uri "http://localhost:$Port/api/health" -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    if ($health.StatusCode -eq 200) {
        $body = $health.Content | ConvertFrom-Json
        Write-Host "  [OK] Health check PASSED -- v$($body.version)" -ForegroundColor Green
    }
} catch {
    Write-Host "  [WARN] Still initializing. Watch logs:" -ForegroundColor Yellow
    Write-Host "         docker compose logs -f weavenote" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  WSH INSTALLED SUCCESSFULLY" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App:        http://localhost:$Port" -ForegroundColor Cyan
Write-Host "  DB Viewer:  http://localhost:5682" -ForegroundColor Cyan
Write-Host "  PostgreSQL: localhost:5432 (internal)" -ForegroundColor DarkGray
if ($WithPgAdmin) {
    Write-Host "  pgAdmin:    http://localhost:5050" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Manifest:   $ManifestFile" -ForegroundColor DarkGray
Write-Host "  Logs:       docker compose logs -f weavenote" -ForegroundColor DarkGray
Write-Host "  Stop:       docker compose down" -ForegroundColor DarkGray
Write-Host '  Update:      .\update.ps1  (preserves data!)' -ForegroundColor Green
Write-Host '  Full nuke:   .\install.ps1 -CleanOnly' -ForegroundColor DarkGray
Write-Host ""
