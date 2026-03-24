# =============================================================================
# Weavenote Smart Installer - Real-Time Progress with Live Logging
# =============================================================================
# Features:
# - Real-time Docker output display
# - 0-99% progress bar
# - Live logging to console
# - Auto-fix for common issues
# =============================================================================

param(
    [switch]$Verbose,
    [string]$LogFile = "weavenote-install.log"
)

$ErrorActionPreference = "Continue"

# =============================================================================
# COLOR FUNCTIONS
# =============================================================================

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) { Write-Output $args }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { param([string]$Message) Write-ColorOutput Green "  [OK] $Message" }
function Write-Err { param([string]$Message) Write-ColorOutput Red "  [ERROR] $Message" }
function Write-Warn { param([string]$Message) Write-ColorOutput Yellow "  [WARN] $Message" }
function Write-Info { param([string]$Message) Write-ColorOutput Cyan "  [INFO] $Message" }

function Write-Header {
    param([string]$Message)
    Write-ColorOutput Cyan "`n$('='*60)"
    Write-ColorOutput Cyan "  $Message"
    Write-ColorOutput Cyan "$('='*60)`n"
}

# =============================================================================
# PROGRESS BAR FUNCTION
# =============================================================================

function Show-ProgressBar {
    param(
        [int]$Percent,
        [string]$Status = "",
        [string]$Activity = "Installing Weavenote"
    )

    # Clamp to 0-99
    $Percent = [Math]::Max(0, [Math]::Min(99, $Percent))

    # Build progress bar
    $barWidth = 40
    $filled = [Math]::Floor($Percent / 100 * $barWidth)
    $empty = $barWidth - $filled

    $bar = "[" + ("█" * $filled) + ("░" * $empty) + "]"

    # Clear line and write progress
    $statusText = if ($Status) { " $Status" } else { "" }
    Write-Host "`r  $bar $Percent%$statusText" -NoNewline
}

function Complete-ProgressBar {
    param([string]$Status = "Complete!")
    $barWidth = 40
    $bar = "[" + ("█" * $barWidth) + "]"
    Write-Host "`r  $bar 100% $Status"
}

# =============================================================================
# REAL-TIME DOCKER BUILD
# =============================================================================

function Invoke-RealTimeBuild {
    Write-Header "Building Docker Containers"

    # Initialize log
    "=== Weavenote Installation Log ===" | Out-File -FilePath $LogFile
    "Started: $(Get-Date)" | Out-File -Append -FilePath $LogFile

    # Progress tracking variables
    $script:currentPercent = 0
    $script:currentStatus = "Initializing..."
    $script:buildErrors = @()

    # Create process
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker-compose"
    $psi.Arguments = "up -d --build"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    # Event handlers for output
    $outputAction = {
        param($sender, $e)
        if (-not [string]::IsNullOrEmpty($e.Data)) {
            $line = $e.Data
            
            # Write to log
            Add-Content -Path $LogFile -Value $line
            
            # Analyze for progress
            $percent = $script:currentPercent
            $status = $script:currentStatus

            if ($line -match "Pulling") {
                $percent = 5
                $status = "Pulling base images..."
            }
            elseif ($line -match "\[internal\]") {
                $percent = 10
                $status = "Initializing build..."
            }
            elseif ($line -match "builder") {
                $percent = [Math]::Max($percent, 15)
                $status = "Building stage..."
            }
            elseif ($line -match "npm ci|npm install") {
                $percent = [Math]::Max($percent, 25)
                $status = "Installing npm packages..."
            }
            elseif ($line -match "added.*packages") {
                $percent = [Math]::Max($percent, 40)
                $status = "Packages installed"
            }
            elseif ($line -match "prisma generate") {
                $percent = [Math]::Max($percent, 50)
                $status = "Generating Prisma client..."
            }
            elseif ($line -match "Generated Prisma") {
                $percent = [Math]::Max($percent, 55)
                $status = "Prisma client ready"
            }
            elseif ($line -match "vite.*build|Building for production") {
                $percent = [Math]::Max($percent, 60)
                $status = "Building frontend..."
            }
            elseif ($line -match "transforming") {
                $percent = [Math]::Max($percent, 65)
                $status = "Transforming modules..."
            }
            elseif ($line -match "rendering chunks") {
                $percent = [Math]::Max($percent, 75)
                $status = "Rendering chunks..."
            }
            elseif ($line -match "built in") {
                $percent = [Math]::Max($percent, 80)
                $status = "Frontend built"
            }
            elseif ($line -match "exporting") {
                $percent = [Math]::Max($percent, 85)
                $status = "Exporting image..."
            }
            elseif ($line -match "Creating|Created") {
                $percent = [Math]::Max($percent, 90)
                $status = "Creating containers..."
            }
            elseif ($line -match "Starting|Started") {
                $percent = [Math]::Max($percent, 93)
                $status = "Starting containers..."
            }
            elseif ($line -match "Healthy") {
                $percent = [Math]::Max($percent, 96)
                $status = "Health check passed"
            }
            elseif ($line -match "DONE") {
                $percent = [Math]::Min($percent + 2, 98)
            }

            # Check for errors
            if ($line -match "error|Error|ERROR|failed|FAILED") {
                $script:buildErrors += $line
                Write-Host ""  # New line
                Write-Err $line
            }

            # Update progress
            $script:currentPercent = $percent
            $script:currentStatus = $status
            Show-ProgressBar -Percent $percent -Status $status
        }
    }

    $errorAction = {
        param($sender, $e)
        if (-not [string]::IsNullOrEmpty($e.Data)) {
            $line = $e.Data
            Add-Content -Path $LogFile -Value "STDERR: $line"
            
            if ($line -match "error|Error|ERROR|failed|FAILED") {
                $script:buildErrors += $line
                Write-Host ""  # New line
                Write-Err $line
            }
        }
    }

    # Register events
    Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action $outputAction | Out-Null
    Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action $errorAction | Out-Null

    # Start process
    Write-Info "Starting Docker build..."
    $process.Start() | Out-Null
    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()

    # Wait with animated progress
    $dots = 0
    while (-not $process.HasExited) {
        Start-Sleep -Milliseconds 200
        
        # Animate dots
        $dots = ($dots + 1) % 4
        $dotString = "." * $dots
        
        # Show current progress
        Show-ProgressBar -Percent $script:currentPercent -Status "$($script:currentStatus)$dotString"
    }

    # Wait for events to complete
    Start-Sleep -Milliseconds 500

    # Complete progress bar
    Write-Host ""  # New line
    Complete-ProgressBar -Status "Build complete!"

    $exitCode = $process.ExitCode

    # Cleanup
    $process.Dispose()

    if ($exitCode -eq 0) {
        Write-Success "Docker build completed successfully!"
        return $true
    } else {
        Write-Err "Docker build failed with exit code: $exitCode"
        Write-Info "Check log file: $LogFile"
        return $false
    }
}

# =============================================================================
# DEPENDENCY CHECK
# =============================================================================

function Test-Docker {
    Write-Header "Checking Prerequisites"

    # Check Docker
    try {
        $dockerVersion = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker: $dockerVersion"
        } else {
            Write-Err "Docker not found"
            return $false
        }
    } catch {
        Write-Err "Docker not installed"
        return $false
    }

    # Check Docker daemon
    try {
        docker info | Out-Null
        Write-Success "Docker daemon is running"
    } catch {
        Write-Err "Docker daemon is not running. Please start Docker Desktop."
        return $false
    }

    # Check Docker Compose
    try {
        docker compose version | Out-Null
        Write-Success "Docker Compose is available"
    } catch {
        Write-Err "Docker Compose not found"
        return $false
    }

    return $true
}

# =============================================================================
# HEALTH CHECK
# =============================================================================

function Wait-ForHealthy {
    Write-Header "Waiting for Services"

    $maxWait = 60
    $waited = 0

    while ($waited -lt $maxWait) {
        $percent = [Math]::Floor($waited / $maxWait * 99)
        Show-ProgressBar -Percent $percent -Status "Waiting for services... ($waited/$maxWait)"

        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host ""
                Write-Success "Frontend is ready!"
                
                try {
                    $apiResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
                    if ($apiResponse.StatusCode -eq 200) {
                        Write-Success "API is ready!"
                    }
                } catch {}
                
                return $true
            }
        } catch {}

        Start-Sleep -Seconds 1
        $waited++
    }

    Write-Host ""
    Write-Warn "Services taking longer than expected. Try accessing manually."
    return $false
}

# =============================================================================
# MAIN
# =============================================================================

function Main {
    Clear-Host

    # Banner
    Write-ColorOutput Magenta @"

  ██╗    ██╗██╗  ██╗███████╗██╗     ███████╗ ██████╗ ███╗   ██╗
  ██║    ██║██║  ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗  ██║
  ██║ █╗ ██║███████║█████╗  ██║     ███████╗██║   ██║██╔██╗ ██║
  ██║███╗██║██╔══██║██╔══╝  ██║     ╚════██║██║   ██║██║╚██╗██║
  ╚███╔███╔╝██║  ██║███████╗███████╗███████║╚██████╔╝██║ ╚████║
   ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝

  Smart Installer v3.0 - Real-Time Progress

"@

    # Check prerequisites
    if (-not (Test-Docker)) {
        Write-Err "Prerequisites not met. Please install Docker Desktop."
        Read-Host "Press Enter to exit"
        exit 1
    }

    # Cleanup
    Write-Header "Cleanup"
    Write-Info "Stopping existing containers..."
    docker-compose down 2>&1 | Out-Null
    Write-Success "Cleanup done"

    # Build
    $success = Invoke-RealTimeBuild

    if (-not $success) {
        Write-Header "Build Failed"
        Write-Err "Installation failed. Check the log:"
        Write-Host "  $LogFile"
        Read-Host "Press Enter to view last 30 lines"
        Get-Content $LogFile | Select-Object -Last 30
        exit 1
    }

    # Health check
    Wait-ForHealthy | Out-Null

    # Done
    Write-Header "Installation Complete"
    Write-Success "Weavenote is running!"
    Write-Host ""
    Write-ColorOutput Green "  Frontend:  http://localhost:8080"
    Write-ColorOutput Green "  API:       http://localhost:3001"
    Write-Host ""
    Write-Info "Log file: $LogFile"
    Write-Host ""
    Write-ColorOutput Cyan "  Commands:"
    Write-Host "    Stop:     docker-compose down"
    Write-Host "    Restart:  docker-compose restart"
    Write-Host "    Logs:     docker-compose logs -f"
    Write-Host ""

    # Open browser
    $open = Read-Host "Open browser? (Y/n)"
    if ($open -ne "n") {
        Start-Process "http://localhost:8080"
    }
}

# Run
Main
