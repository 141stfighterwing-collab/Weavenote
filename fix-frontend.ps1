# =============================================================================
# Weavenote Diagnostic & Fix Tool
# =============================================================================
# Diagnoses and fixes common Docker issues
# =============================================================================

param(
    [string]$Action = "menu"
)

$ErrorActionPreference = "Continue"

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) { Write-Output $args }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Header {
    param([string]$Message)
    Write-ColorOutput Cyan "`n$('='*60)"
    Write-ColorOutput Cyan "  $Message"
    Write-ColorOutput Cyan "$('='*60)`n"
}

function Write-Success { param([string]$Message) Write-ColorOutput Green "  [OK] $Message" }
function Write-Error { param([string]$Message) Write-ColorOutput Red "  [ERROR] $Message" }
function Write-Warning { param([string]$Message) Write-ColorOutput Yellow "  [WARN] $Message" }
function Write-Info { param([string]$Message) Write-ColorOutput White "  [INFO] $Message" }

# =============================================================================
# DIAGNOSTIC FUNCTIONS
# =============================================================================

function Test-DockerStatus {
    Write-Header "Checking Docker Status"

    try {
        $dockerVersion = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker is installed: $dockerVersion"
        } else {
            Write-Error "Docker not found"
            return $false
        }
    } catch {
        Write-Error "Docker not installed or not in PATH"
        return $false
    }

    try {
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker daemon is running"
        } else {
            Write-Error "Docker daemon is not running"
            Write-Info "Please start Docker Desktop"
            return $false
        }
    } catch {
        Write-Error "Cannot connect to Docker daemon"
        return $false
    }

    return $true
}

function Test-ContainerStatus {
    Write-Header "Checking Container Status"

    $containers = docker ps -a --filter "name=weavenote" --format "{{.Names}}|{{.Status}}" 2>$null

    if (-not $containers) {
        Write-Warning "No Weavenote containers found"
        return $false
    }

    $allHealthy = $true
    foreach ($container in $containers) {
        $parts = $container -split "\|"
        $name = $parts[0]
        $status = $parts[1]

        if ($status -match "running|healthy") {
            Write-Success "$name - $status"
        } elseif ($status -match "restarting") {
            Write-Error "$name - $status (CRASH LOOP)"
            $allHealthy = $false
        } else {
            Write-Warning "$name - $status"
            $allHealthy = $false
        }
    }

    return $allHealthy
}

function Test-FileLineEndings {
    Write-Header "Checking File Line Endings"

    $filesToCheck = @(
        "docker-entrypoint.sh",
        "install-smart.sh"
    )

    $hasIssues = $false
    foreach ($file in $filesToCheck) {
        if (Test-Path $file) {
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $hasCRLF = $false

            for ($i = 0; $i -lt $bytes.Length - 1; $i++) {
                if ($bytes[$i] -eq 0x0D -and $bytes[$i+1] -eq 0x0A) {
                    $hasCRLF = $true
                    break
                }
            }

            if ($hasCRLF) {
                Write-Error "$file - Has CRLF (Windows) line endings - NEEDS FIX"
                $hasIssues = $true
            } else {
                Write-Success "$file - Has LF (Unix) line endings"
            }
        }
    }

    return -not $hasIssues
}

function Get-ContainerLogs {
    Write-Header "Container Logs (Last 50 lines)"

    Write-Info "=== FRONTEND LOGS ==="
    docker logs weavenote-frontend --tail 50 2>&1

    Write-Info "`n=== API LOGS ==="
    docker logs weavenote-api --tail 20 2>&1

    Write-Info "`n=== POSTGRES LOGS ==="
    docker logs weavenote-postgres --tail 10 2>&1
}

# =============================================================================
# FIX FUNCTIONS
# =============================================================================

function Fix-LineEndings {
    Write-Header "Fixing Line Endings"

    $filesToFix = @(
        "docker-entrypoint.sh",
        "install-smart.sh"
    )

    foreach ($file in $filesToFix) {
        if (Test-Path $file) {
            Write-Info "Converting $file to Unix (LF) line endings..."

            $content = [System.IO.File]::ReadAllText($file)
            $content = $content -replace "`r`n", "`n"
            [System.IO.File]::WriteAllText($file, $content)

            Write-Success "Fixed $file"
        }
    }

    Write-Success "All line endings fixed!"
}

function Repair-Container {
    Write-Header "Rebuilding Containers"

    Write-Info "Stopping containers..."
    docker-compose down 2>&1 | Out-Null

    Write-Info "Removing old images..."
    docker rmi weavenote-frontend weavenote-api -f 2>$null

    Write-Info "Rebuilding with no cache..."
    docker-compose build --no-cache 2>&1

    Write-Info "Starting containers..."
    docker-compose up -d 2>&1

    Write-Success "Rebuild complete!"
    Start-Sleep -Seconds 5

    Test-ContainerStatus
}

function Update-Repo {
    Write-Header "Updating Repository"

    Write-Info "Stashing any local changes..."
    git stash 2>$null

    Write-Info "Pulling latest changes..."
    git pull 2>&1

    Write-Info "Restoring stashed changes..."
    git stash pop 2>$null

    Write-Success "Repository updated!"

    # Fix line endings after pull
    Fix-LineEndings
}

function Start-FullRepair {
    Write-Header "Full Repair Process"

    Write-Info "Step 1: Updating repository..."
    Update-Repo

    Write-Info "`nStep 2: Fixing line endings..."
    Fix-LineEndings

    Write-Info "`nStep 3: Rebuilding containers..."
    Repair-Container

    Write-Header "Repair Complete"
    Test-ContainerStatus
}

function Open-App {
    Write-Header "Opening Weavenote"
    Start-Process "http://localhost:8080"
}

# =============================================================================
# MENU
# =============================================================================

function Show-Menu {
    Clear-Host

    Write-ColorOutput Magenta @"

  ██╗    ██╗██╗  ██╗███████╗██╗     ███████╗ ██████╗ ███╗   ██╗
  ██║    ██║██║  ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗  ██║
  ██║ █╗ ██║███████║█████╗  ██║     ███████╗██║   ██║██╔██╗ ██║
  ██║███╗██║██╔══██║██╔══╝  ██║     ╚════██║██║   ██║██║╚██╗██║
  ╚███╔███╔╝██║  ██║███████╗███████╗███████║╚██████╔╝██║ ╚████║
   ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝

  Diagnostic & Fix Tool

"@

    Write-Output "  DIAGNOSTIC OPTIONS:"
    Write-Output "  [1] Run Full Diagnostics"
    Write-Output "  [2] Check Container Status"
    Write-Output "  [3] Check File Line Endings"
    Write-Output "  [4] View Container Logs"
    Write-Output ""
    Write-Output "  FIX OPTIONS:"
    Write-Output "  [5] Fix Line Endings (CRLF -> LF)"
    Write-Output "  [6] Rebuild Containers"
    Write-Output "  [7] Pull Latest & Rebuild"
    Write-Output "  [8] Full Repair (Recommended)"
    Write-Output ""
    Write-Output "  OTHER:"
    Write-Output "  [9] Open Weavenote in Browser"
    Write-Output "  [Q] Quit"
    Write-Output ""
}

function Main {
    do {
        Show-Menu
        $choice = Read-Host "  Select option"

        switch ($choice.ToUpper()) {
            "1" {
                Test-DockerStatus
                Test-ContainerStatus
                Test-FileLineEndings
            }
            "2" {
                Test-ContainerStatus
            }
            "3" {
                Test-FileLineEndings
            }
            "4" {
                Get-ContainerLogs
            }
            "5" {
                Fix-LineEndings
            }
            "6" {
                Repair-Container
            }
            "7" {
                Update-Repo
                Repair-Container
            }
            "8" {
                Start-FullRepair
            }
            "9" {
                Open-App
            }
            "Q" {
                Write-Output "`n  Goodbye!"
                return
            }
            default {
                Write-Warning "Invalid option. Press any key to continue..."
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            }
        }

        Write-Output "`n  Press any key to continue..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    } while ($true)
}

# Run
Main
