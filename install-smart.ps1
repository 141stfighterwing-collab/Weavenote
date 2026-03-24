# =============================================================================
# Weavenote Smart Installer - One-Click Installation with Auto-Fix
# =============================================================================
# Features:
# - Real-time progress display with percentage
# - Background Docker build process
# - Comprehensive error logging
# - Auto-fix for common issues
# - Dependency checking and installation
# =============================================================================

param(
    [switch]$SkipDeps,
    [switch]$Verbose,
    [string]$LogFile = "weavenote-install.log"
)

# Configuration
$ErrorActionPreference = "Continue"
$ProgressPreference = "Continue"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Header {
    param([string]$Message)
    Write-ColorOutput Cyan "`n$('='*60)"
    Write-ColorOutput Cyan "  $Message"
    Write-ColorOutput Cyan "$('='*60)`n"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput Green "  [OK] $Message"
}

function Write-Err {
    param([string]$Message)
    Write-ColorOutput Red "  [ERROR] $Message"
}

function Write-Warn {
    param([string]$Message)
    Write-ColorOutput Yellow "  [WARN] $Message"
}

function Write-Status {
    param([string]$Message)
    Write-ColorOutput White "  [..] $Message"
}

# Logging function
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    if ($Verbose -or $Level -eq "ERROR") {
        Write-Output $logEntry
    }
}

# =============================================================================
# ERROR DEFINITIONS AND AUTO-FIXES
# =============================================================================

$script:ErrorFixes = @{
    "npm ci.*package-lock.json" = @{
        Description = "Missing package-lock.json"
        Fix = {
            Write-Status "Auto-fixing: Generating package-lock.json..."
            Push-Location backend
            npm install --legacy-peer-deps 2>&1 | Out-File -Append -FilePath $LogFile
            Pop-Location
            return $true
        }
    }
    "ECONNREFUSED" = @{
        Description = "Connection refused - Docker may not be running"
        Fix = {
            Write-Status "Auto-fixing: Attempting to start Docker..."
            Start-Process "docker" -ArgumentList "desktop" -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 10
            return $true
        }
    }
    "port is already allocated" = @{
        Description = "Port already in use"
        Fix = {
            Write-Status "Auto-fixing: Stopping conflicting containers..."
            docker-compose down 2>&1 | Out-Null
            return $true
        }
    }
    "no space left on device" = @{
        Description = "Disk space full"
        Fix = {
            Write-Status "Auto-fixing: Cleaning Docker system..."
            docker system prune -af 2>&1 | Out-File -Append -FilePath $LogFile
            return $true
        }
    }
    "network.*not found" = @{
        Description = "Docker network issue"
        Fix = {
            Write-Status "Auto-fixing: Creating Docker network..."
            docker network create weavenote-network 2>&1 | Out-Null
            return $true
        }
    }
    "permission denied" = @{
        Description = "Permission denied"
        Fix = {
            Write-Warn "Permission issue detected. Please run as Administrator."
            return $false
        }
    }
    "P1012" = @{
        Description = "Prisma schema validation error (likely version mismatch)"
        Fix = {
            Write-Warn "Detected Prisma version mismatch. Pulling latest code with fix..."
            git pull 2>&1 | Out-File -Append -FilePath $LogFile
            return $true
        }
    }
    "ENOENT.*package.json" = @{
        Description = "Missing package.json"
        Fix = {
            Write-Err "Critical: package.json is missing. Please re-clone the repository."
            return $false
        }
    }
}

# =============================================================================
# DEPENDENCY CHECKING
# =============================================================================

function Test-Dependency {
    param([string]$Name, [string]$Command, [string]$InstallUrl)

    Write-Status "Checking $Name..."
    try {
        $result = & $Command 2>&1
        if ($LASTEXITCODE -eq 0 -or $result) {
            Write-Success "$Name is installed"
            Write-Log "$Name found: $result" "INFO"
            return $true
        }
    } catch {
        Write-Warn "$Name not found"
        Write-Log "$Name not found" "WARN"

        if (-not $SkipDeps) {
            Write-Warn "Please install $Name from: $InstallUrl"
            $install = Read-Host "Would you like to open the download page? (Y/n)"
            if ($install -ne "n") {
                Start-Process $InstallUrl
            }
        }
        return $false
    }
    return $false
}

function Test-AllDependencies {
    Write-Header "Checking Dependencies"

    $allOk = $true

    # Check Docker
    if (-not (Test-Dependency "Docker" "docker" "https://www.docker.com/products/docker-desktop")) {
        $allOk = $false
    }

    # Check Docker Compose
    $composeResult = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) {
        $composeResult = docker-compose --version 2>&1
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker Compose is installed"
    } else {
        Write-Warn "Docker Compose not found"
        $allOk = $false
    }

    # Check Git
    if (-not (Test-Dependency "Git" "git" "https://git-scm.com/downloads")) {
        $allOk = $false
    }

    return $allOk
}

# =============================================================================
# DOCKER BUILD WITH PROGRESS
# =============================================================================

function Invoke-DockerBuild {
    Write-Header "Building Docker Containers"
    Write-Status "Starting Docker build process..."

    # Create log file
    "=== Weavenote Installation Log ===" | Out-File -FilePath $LogFile
    "Started: $(Get-Date)" | Out-File -Append -FilePath $LogFile

    # Progress tracking
    $percent = 0
    $status = "Initializing..."
    $activity = "Installing Weavenote"

    # Run docker-compose with progress
    $buildProcess = Start-Process -FilePath "docker-compose" -ArgumentList "up", "-d", "--build" -NoNewWindow -PassThru -RedirectStandardOutput "$LogFile.out" -RedirectStandardError "$LogFile.err"

    # Monitor progress
    while (-not $buildProcess.HasExited) {
        # Read output for progress hints
        if (Test-Path "$LogFile.out") {
            $output = Get-Content "$LogFile.out" -Tail 20 -ErrorAction SilentlyContinue
            
            # Analyze progress
            if ($output -match "Pulling") {
                $percent = 10
                $status = "Pulling base images..."
            } elseif ($output -match "npm ci|npm install") {
                $percent = 30
                $status = "Installing npm packages..."
            } elseif ($output -match "prisma generate") {
                $percent = 50
                $status = "Generating Prisma client..."
            } elseif ($output -match "vite.*build|Building") {
                $percent = 70
                $status = "Building frontend..."
            } elseif ($output -match "Creating|Starting") {
                $percent = 90
                $status = "Starting containers..."
            } elseif ($output -match "DONE") {
                $percent = [Math]::Min($percent + 5, 95)
            }

            # Check for errors
            $errors = $output | Where-Object { $_ -match "error|Error|ERROR|failed|FAILED" }
            foreach ($err in $errors) {
                foreach ($pattern in $script:ErrorFixes.Keys) {
                    if ($err -match $pattern) {
                        Write-Warn "Detected: $($script:ErrorFixes[$pattern].Description)"
                        $fixResult = & $script:ErrorFixes[$pattern].Fix
                        if ($fixResult) {
                            Write-Success "Auto-fixed!"
                        }
                        break
                    }
                }
            }
        }

        # Update progress bar
        Write-Progress -Activity $activity -Status $status -PercentComplete $percent

        Start-Sleep -Milliseconds 500
    }

    # Final output
    Write-Progress -Activity $activity -Status "Finalizing..." -PercentComplete 100

    # Append logs
    if (Test-Path "$LogFile.out") {
        Get-Content "$LogFile.out" | Add-Content $LogFile
        Remove-Item "$LogFile.out" -Force
    }
    if (Test-Path "$LogFile.err") {
        Get-Content "$LogFile.err" | Add-Content $LogFile
        Remove-Item "$LogFile.err" -Force
    }

    if ($buildProcess.ExitCode -eq 0) {
        Write-Success "Docker build completed successfully!"
        return $true
    } else {
        Write-Err "Docker build failed. Check log file: $LogFile"
        return $false
    }
}

# =============================================================================
# HEALTH CHECK
# =============================================================================

function Test-ApplicationHealth {
    Write-Header "Running Health Checks"

    $maxRetries = 30
    $retry = 0
    $healthy = $false

    while ($retry -lt $maxRetries -and -not $healthy) {
        $retry++
        $percent = [Math]::Round(($retry / $maxRetries) * 100)

        Write-Progress -Activity "Health Check" -Status "Waiting for services to start... ($retry/$maxRetries)" -PercentComplete $percent

        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $healthy = $true
                Write-Success "Frontend is responding"
            }
        } catch {
            Start-Sleep -Seconds 2
        }

        try {
            $apiResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($apiResponse.StatusCode -eq 200) {
                Write-Success "API is responding"
            }
        } catch {
            # API might not be ready yet
        }
    }

    Write-Progress -Activity "Health Check" -Completed
    return $healthy
}

# =============================================================================
# MAIN INSTALLATION
# =============================================================================

function Main {
    Clear-Host

    Write-ColorOutput Magenta @"

  ██╗    ██╗██╗  ██╗███████╗██╗     ███████╗ ██████╗ ███╗   ██╗
  ██║    ██║██║  ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗  ██║
  ██║ █╗ ██║███████║█████╗  ██║     ███████╗██║   ██║██╔██╗ ██║
  ██║███╗██║██╔══██║██╔══╝  ██║     ╚════██║██║   ██║██║╚██╗██║
  ╚███╔███╔╝██║  ██║███████╗███████╗███████║╚██████╔╝██║ ╚████║
   ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝

  Smart Installer v2.0 - One-Click Installation

"@

    Write-Log "Installation started"

    # Step 1: Check dependencies
    if (-not (Test-AllDependencies)) {
        Write-Err "Missing required dependencies. Please install them and try again."
        Write-Log "Installation failed - missing dependencies" "ERROR"
        exit 1
    }

    # Step 2: Ensure package-lock.json exists
    Write-Header "Preparing Build Files"
    if (-not (Test-Path "backend/package-lock.json")) {
        Write-Status "Generating backend package-lock.json..."
        Push-Location backend
        npm install --legacy-peer-deps 2>&1 | Out-File -Append -FilePath $LogFile
        Pop-Location
        Write-Success "package-lock.json generated"
    } else {
        Write-Success "package-lock.json already exists"
    }

    # Step 3: Stop any existing containers
    Write-Header "Cleaning Up"
    Write-Status "Stopping any existing containers..."
    docker-compose down 2>&1 | Out-Null
    Write-Success "Cleanup complete"

    # Step 4: Build and start containers
    $buildSuccess = Invoke-DockerBuild

    if (-not $buildSuccess) {
        Write-Header "Installation Failed"
        Write-Err "Docker build failed. Check the log file for details:"
        Write-Output "  $LogFile"
        Write-Log "Installation failed - Docker build error" "ERROR"

        # Offer to show log
        $showLog = Read-Host "Would you like to view the error log? (Y/n)"
        if ($showLog -ne "n") {
            Get-Content $LogFile | Select-Object -Last 50
        }

        exit 1
    }

    # Step 5: Health check
    $healthy = Test-ApplicationHealth

    # Step 6: Final status
    Write-Header "Installation Complete"

    if ($healthy) {
        Write-Success "Weavenote is running!"
        Write-Output ""
        Write-ColorOutput Green "  Access the application at: http://localhost:8080"
        Write-ColorOutput Green "  API endpoint: http://localhost:3001"
        Write-Output ""
        Write-Output "  Log file: $LogFile"
        Write-Log "Installation completed successfully"

        # Open browser
        $openBrowser = Read-Host "Open Weavenote in browser? (Y/n)"
        if ($openBrowser -ne "n") {
            Start-Process "http://localhost:8080"
        }
    } else {
        Write-Warn "Services are starting but not yet responding."
        Write-Output "  Please wait a moment and try accessing: http://localhost:8080"
        Write-Log "Installation completed but health check timed out" "WARN"
    }

    Write-Output ""
    Write-ColorOutput Cyan "  To stop: docker-compose down"
    Write-ColorOutput Cyan "  To restart: docker-compose restart"
    Write-ColorOutput Cyan "  To view logs: docker-compose logs -f"
}

# Run main function
Main
