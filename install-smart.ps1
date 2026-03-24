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

function Write-Error {
    param([string]$Message)
    Write-ColorOutput Red "  [ERROR] $Message"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput Yellow "  [WARN] $Message"
}

function Write-Progress {
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

$ErrorFixes = @{
    "npm ci.*package-lock.json" = @{
        Description = "Missing package-lock.json"
        Fix = {
            Write-Progress "Auto-fixing: Generating package-lock.json..."
            Push-Location backend
            npm install --legacy-peer-deps 2>&1 | Out-File -Append -FilePath $LogFile
            Pop-Location
            return $true
        }
    }
    "ECONNREFUSED" = @{
        Description = "Connection refused - Docker may not be running"
        Fix = {
            Write-Progress "Auto-fixing: Attempting to start Docker..."
            Start-Process "docker" -ArgumentList "desktop" -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 10
            return $true
        }
    }
    "port is already allocated" = @{
        Description = "Port already in use"
        Fix = {
            Write-Progress "Auto-fixing: Stopping conflicting containers..."
            docker-compose down 2>&1 | Out-Null
            return $true
        }
    }
    "no space left on device" = @{
        Description = "Disk space full"
        Fix = {
            Write-Progress "Auto-fixing: Cleaning Docker system..."
            docker system prune -af 2>&1 | Out-File -Append -FilePath $LogFile
            return $true
        }
    }
    "network.*not found" = @{
        Description = "Docker network issue"
        Fix = {
            Write-Progress "Auto-fixing: Creating Docker network..."
            docker network create weavenote-network 2>&1 | Out-Null
            return $true
        }
    }
    "permission denied" = @{
        Description = "Permission denied"
        Fix = {
            Write-Warning "Permission issue detected. Please run as Administrator."
            return $false
        }
    }
    "prisma.*generate" = @{
        Description = "Prisma client generation failed"
        Fix = {
            Write-Progress "Auto-fixing: Regenerating Prisma client..."
            Push-Location backend
            ./node_modules/.bin/prisma generate 2>&1 | Out-File -Append -FilePath $LogFile
            Pop-Location
            return $true
        }
    }
    "P1012" = @{
        Description = "Prisma schema validation error (likely version mismatch)"
        Fix = {
            Write-Warning "Detected Prisma version mismatch. Pulling latest code with fix..."
            git pull 2>&1 | Out-File -Append -FilePath $LogFile
            return $true
        }
    }
    "url.*no longer supported" = @{
        Description = "Prisma 7.x breaking change detected"
        Fix = {
            Write-Warning "Detected Prisma 7.x breaking change. Pulling latest fix..."
            git pull 2>&1 | Out-File -Append -FilePath $LogFile
            return $true
        }
    }
    "ENOENT.*package.json" = @{
        Description = "Missing package.json"
        Fix = {
            Write-Error "Critical: package.json is missing. Please re-clone the repository."
            return $false
        }
    }
    "daemon.*not running" = @{
        Description = "Docker daemon not running"
        Fix = {
            Write-Progress "Auto-fixing: Waiting for Docker to start..."
            $retries = 0
            while ($retries -lt 30) {
                docker info 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    return $true
                }
                Start-Sleep -Seconds 2
                $retries++
            }
            return $false
        }
    }
}

# =============================================================================
# DEPENDENCY CHECKING
# =============================================================================

function Test-Dependency {
    param([string]$Name, [string]$Command, [string]$InstallUrl)

    Write-Progress "Checking $Name..."
    try {
        $result = & $Command 2>&1
        if ($LASTEXITCODE -eq 0 -or $result) {
            Write-Success "$Name is installed"
            Write-Log "$Name found: $result" "INFO"
            return $true
        }
    } catch {
        Write-Warning "$Name not found"
        Write-Log "$Name not found" "WARN"

        if (-not $SkipDeps) {
            Write-Warning "Please install $Name from: $InstallUrl"
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
        Write-Warning "Docker Compose not found"
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

function Start-DockerBuild {
    param([ref]$ProgressData)

    Write-Header "Building Docker Containers"
    Write-Progress "Starting Docker build process..."

    # Create log file
    "=== Weavenote Installation Log ===" | Out-File -FilePath $LogFile
    "Started: $(Get-Date)" | Out-File -Append -FilePath $LogFile

    # Start docker-compose in background
    $job = Start-Job -ScriptBlock {
        param($workDir, $logFile)
        Set-Location $workDir
        docker-compose up -d --build 2>&1 | Tee-Object -FilePath $logFile
    } -ArgumentList $PWD.Path, $LogFile

    return $job
}

function Get-DockerBuildProgress {
    param($Job, [ref]$ProgressData)

    $output = Receive-Job -Job $Job -ErrorAction SilentlyContinue
    $progressData.Value.Output += $output

    # Analyze progress based on Docker output
    $totalSteps = 16
    $currentStep = 0

    $progressText = ""

    if ($output) {
        $outputArray = $output -split "`n"

        foreach ($line in $outputArray) {
            # Detect build stages
            if ($line -match "Building|builder|production") {
                $currentStep++
            }
            if ($line -match "DONE") {
                $currentStep++
            }
            if ($line -match "pulling|Pulled") {
                $progressText = "Pulling base images..."
            }
            if ($line -match "npm ci|npm install") {
                $progressText = "Installing npm packages..."
            }
            if ($line -match "prisma generate") {
                $progressText = "Generating Prisma client..."
            }
            if ($line -match "COPY|copying") {
                $progressText = "Copying files..."
            }
            if ($line -match "vite.*build|Building for production") {
                $progressText = "Building frontend..."
            }
            if ($line -match "Creating|Created|Starting") {
                $progressText = "Creating containers..."
            }
            if ($line -match "Health|healthy") {
                $progressText = "Running health checks..."
            }
        }
    }

    $percent = [Math]::Min(100, [Math]::Round(($currentStep / $totalSteps) * 100))
    $progressData.Value.Percent = $percent
    $progressData.Value.Text = $progressText

    return $Job.State
}

function Watch-DockerBuild {
    param($Job)

    $progressData = @{
        Percent = 0
        Text = "Initializing..."
        Output = @()
        Errors = @()
        RetryCount = 0
        MaxRetries = 3
    }

    $activity = "Installing Weavenote"

    while ($Job.State -eq "Running") {
        $state = Get-DockerBuildProgress -Job $Job -ProgressData ([ref]$progressData)

        # Display progress bar
        $status = if ($progressData.Text) { $progressData.Text } else { "Processing..." }
        Write-Progress -Activity $activity -Status $status -PercentComplete $progressData.Percent

        # Check for errors in output
        $recentOutput = $progressData.Output | Select-Object -Last 10
        foreach ($line in $recentOutput) {
            if ($line -match "error|Error|ERROR|failed|FAILED") {
                # Try auto-fix
                $fixed = $false
                foreach ($pattern in $ErrorFixes.Keys) {
                    if ($line -match $pattern) {
                        Write-Warning "Detected: $($ErrorFixes[$pattern].Description)"
                        $fixResult = & $ErrorFixes[$pattern].Fix
                        if ($fixResult) {
                            Write-Success "Auto-fixed: $($ErrorFixes[$pattern].Description)"
                            $fixed = $true
                            # Retry build
                            if ($progressData.RetryCount -lt $progressData.MaxRetries) {
                                $progressData.RetryCount++
                                Write-Progress "Retrying build (attempt $($progressData.RetryCount)/$($progressData.MaxRetries))..."
                                Stop-Job -Job $Job
                                Remove-Job -Job $Job
                                $Job = Start-DockerBuild -ProgressData ([ref]$progressData)
                            }
                        }
                        break
                    }
                }
                if (-not $fixed) {
                    $progressData.Errors += $line
                }
            }
        }

        Start-Sleep -Milliseconds 500
    }

    # Final status
    $finalOutput = Receive-Job -Job $Job
    $progressData.Output += $finalOutput

    if ($Job.State -eq "Completed" -and $LASTEXITCODE -eq 0) {
        Write-Progress -Activity $activity -Status "Complete!" -PercentComplete 100
        Write-Success "Docker build completed successfully!"
        return $true
    } else {
        Write-Progress -Activity $activity -Status "Failed" -PercentComplete 100
        Write-Error "Docker build failed. Check log file: $LogFile"
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
        Write-Error "Missing required dependencies. Please install them and try again."
        Write-Log "Installation failed - missing dependencies" "ERROR"
        exit 1
    }

    # Step 2: Ensure package-lock.json exists
    Write-Header "Preparing Build Files"
    if (-not (Test-Path "backend/package-lock.json")) {
        Write-Progress "Generating backend package-lock.json..."
        Push-Location backend
        npm install --legacy-peer-deps 2>&1 | Out-File -Append -FilePath $LogFile
        Pop-Location
        Write-Success "package-lock.json generated"
    } else {
        Write-Success "package-lock.json already exists"
    }

    # Step 3: Stop any existing containers
    Write-Header "Cleaning Up"
    Write-Progress "Stopping any existing containers..."
    docker-compose down 2>&1 | Out-Null
    Write-Success "Cleanup complete"

    # Step 4: Build and start containers
    $progressData = @{Percent = 0; Text = ""; Output = @(); Errors = @()}
    $buildJob = Start-DockerBuild -ProgressData ([ref]$progressData)

    $buildSuccess = Watch-DockerBuild -Job $buildJob

    Remove-Job -Job $buildJob -Force -ErrorAction SilentlyContinue

    if (-not $buildSuccess) {
        Write-Header "Installation Failed"
        Write-Error "Docker build failed. Check the log file for details:"
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
        Write-Warning "Services are starting but not yet responding."
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
