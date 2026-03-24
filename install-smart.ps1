# =============================================================================
# Weavenote Smart Installer - Real-Time Progress with Live Logging
# =============================================================================
# Features:
# - Real-time Docker output display
# - 0-99% progress bar
# - Database backend selection (PostgreSQL, Supabase, Firebase, AWS)
# - Live logging to console
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
    Write-ColorOutput Cyan ""
    Write-ColorOutput Cyan "  ============================================================"
    Write-ColorOutput Cyan "  $Message"
    Write-ColorOutput Cyan "  ============================================================"
    Write-ColorOutput Cyan ""
}

# =============================================================================
# PROGRESS BAR FUNCTION (ASCII-only for Windows compatibility)
# =============================================================================

function Show-ProgressBar {
    param(
        [int]$Percent,
        [string]$Status = ""
    )
    $Percent = [Math]::Max(0, [Math]::Min(99, $Percent))
    $barWidth = 40
    $filled = [Math]::Floor($Percent / 100 * $barWidth)
    $empty = $barWidth - $filled
    # Use ASCII characters only - # for filled, - for empty
    $bar = "[" + ("#" * $filled) + ("-" * $empty) + "]"
    $statusText = if ($Status) { " $Status" } else { "" }
    Write-Host "`r  $bar $Percent%$statusText" -NoNewline
}

function Complete-ProgressBar {
    param([string]$Status = "Complete!")
    # Use ASCII characters only
    Write-Host "`r  [" + ("#" * 40) + "] 100% $Status"
}

# =============================================================================
# REAL-TIME DOCKER BUILD
# =============================================================================

function Invoke-RealTimeBuild {
    Write-Header "Building Docker Containers"

    "=== Weavenote Installation Log ===" | Out-File -FilePath $LogFile
    "Started: $(Get-Date)" | Out-File -Append -FilePath $LogFile

    $script:currentPercent = 0
    $script:currentStatus = "Initializing..."

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker-compose"
    $psi.Arguments = "up -d --build"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    $outputAction = {
        param($sender, $e)
        if (-not [string]::IsNullOrEmpty($e.Data)) {
            $line = $e.Data
            Add-Content -Path $LogFile -Value $line

            $percent = $script:currentPercent
            $status = $script:currentStatus

            if ($line -match "Pulling") { $percent = 5; $status = "Pulling images..." }
            elseif ($line -match "\[internal\]") { $percent = 10; $status = "Initializing..." }
            elseif ($line -match "builder") { $percent = [Math]::Max($percent, 15); $status = "Building..." }
            elseif ($line -match "npm ci|npm install") { $percent = [Math]::Max($percent, 25); $status = "Installing packages..." }
            elseif ($line -match "added.*packages") { $percent = [Math]::Max($percent, 40); $status = "Packages ready" }
            elseif ($line -match "prisma generate") { $percent = [Math]::Max($percent, 50); $status = "Generating Prisma..." }
            elseif ($line -match "Generated Prisma") { $percent = [Math]::Max($percent, 55); $status = "Prisma ready" }
            elseif ($line -match "vite.*build|Building for production") { $percent = [Math]::Max($percent, 60); $status = "Building frontend..." }
            elseif ($line -match "transforming") { $percent = [Math]::Max($percent, 65); $status = "Transforming..." }
            elseif ($line -match "rendering chunks") { $percent = [Math]::Max($percent, 75); $status = "Rendering..." }
            elseif ($line -match "built in") { $percent = [Math]::Max($percent, 80); $status = "Build complete" }
            elseif ($line -match "Creating|Created") { $percent = [Math]::Max($percent, 90); $status = "Creating containers..." }
            elseif ($line -match "Starting|Started") { $percent = [Math]::Max($percent, 93); $status = "Starting..." }
            elseif ($line -match "Healthy") { $percent = [Math]::Max($percent, 96); $status = "Healthy" }

            if ($line -match "error|Error|ERROR|failed|FAILED") {
                Write-Host ""; Write-Err $line
            }

            $script:currentPercent = $percent
            $script:currentStatus = $status
            Show-ProgressBar -Percent $percent -Status $status
        }
    }

    Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action $outputAction | Out-Null
    Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action $outputAction | Out-Null

    Write-Info "Starting Docker build..."
    $process.Start() | Out-Null
    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()

    $dots = 0
    while (-not $process.HasExited) {
        Start-Sleep -Milliseconds 200
        $dots = ($dots + 1) % 4
        Show-ProgressBar -Percent $script:currentPercent -Status "$($script:currentStatus)$('.' * $dots)"
    }

    Start-Sleep -Milliseconds 500
    Write-Host ""
    Complete-ProgressBar -Status "Build complete!"

    $exitCode = $process.ExitCode
    $process.Dispose()

    if ($exitCode -eq 0) {
        Write-Success "Docker build completed!"
        return $true
    } else {
        Write-Err "Docker build failed. Check: $LogFile"
        return $false
    }
}

# =============================================================================
# DEPENDENCY CHECK
# =============================================================================

function Test-Docker {
    Write-Header "Checking Prerequisites"

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

    try {
        docker info | Out-Null
        Write-Success "Docker daemon is running"
    } catch {
        Write-Err "Docker daemon not running. Start Docker Desktop."
        return $false
    }

    try {
        docker compose version | Out-Null
        Write-Success "Docker Compose available"
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
        Show-ProgressBar -Percent ([Math]::Floor($waited / $maxWait * 99)) -Status "Waiting... ($waited/$maxWait)"

        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host ""
                Write-Success "Frontend ready!"
                return $true
            }
        } catch {}

        Start-Sleep -Seconds 1
        $waited++
    }

    Write-Host ""
    Write-Warn "Services starting. Try http://localhost:8080 manually."
    return $false
}

# =============================================================================
# DATABASE SELECTION
# =============================================================================

function Select-Database {
    Write-Header "Select Database Backend"
    
    Write-Host "  [1] PostgreSQL (On-Premises) - DEFAULT" -ForegroundColor Green
    Write-Host "      Local Docker PostgreSQL - No cloud needed"
    Write-Host ""
    Write-Host "  [2] Supabase (Cloud PostgreSQL)" -ForegroundColor Cyan
    Write-Host "      Managed PostgreSQL with real-time"
    Write-Host ""
    Write-Host "  [3] Firebase (Cloud - Auth Only)" -ForegroundColor Yellow
    Write-Host "      Google auth + sync (PostgreSQL for data)"
    Write-Host ""
    Write-Host "  [4] AWS RDS (Cloud PostgreSQL)" -ForegroundColor Magenta
    Write-Host "      Amazon managed database"
    Write-Host ""
    
    $choice = Read-Host "  Select (1-4, default is 1)"
    
    switch ($choice) {
        "2" { return "supabase" }
        "3" { return "firebase" }
        "4" { return "aws" }
        default { return "postgresql" }
    }
}

function Configure-Database {
    param([string]$Type)
    
    $envFile = ".env"
    $envContent = if (Test-Path $envFile) { Get-Content $envFile -Raw } else { "" }
    
    switch ($Type) {
        "postgresql" {
            Write-Success "Using On-Premises PostgreSQL (Docker)"
            # Clear Firebase settings for on-prem mode
            $envContent = $envContent -replace "VITE_FIREBASE_API_KEY=.*", "VITE_FIREBASE_API_KEY="
            $envContent = $envContent -replace "VITE_FIREBASE_AUTH_DOMAIN=.*", "VITE_FIREBASE_AUTH_DOMAIN="
            $envContent = $envContent -replace "VITE_FIREBASE_PROJECT_ID=.*", "VITE_FIREBASE_PROJECT_ID="
            $envContent = $envContent -replace "VITE_FIREBASE_STORAGE_BUCKET=.*", "VITE_FIREBASE_STORAGE_BUCKET="
            # Ensure local PostgreSQL settings
            if ($envContent -notmatch "DATABASE_URL=") {
                $envContent += "`nDATABASE_URL=postgresql://weavenote:weavenote@postgres:5432/weavenote"
            }
        }
        "supabase" {
            Write-Info "Enter Supabase credentials:"
            $url = Read-Host "  Supabase URL"
            $key = Read-Host "  Anon Key"
            $dbUrl = Read-Host "  Database URL"
            
            if ($envContent -match "SUPABASE_URL=") {
                $envContent = $envContent -replace "SUPABASE_URL=.*", "SUPABASE_URL=$url"
            } else { $envContent += "`nSUPABASE_URL=$url" }
            
            if ($envContent -match "SUPABASE_ANON_KEY=") {
                $envContent = $envContent -replace "SUPABASE_ANON_KEY=.*", "SUPABASE_ANON_KEY=$key"
            } else { $envContent += "`nSUPABASE_ANON_KEY=$key" }
            
            if ($envContent -match "DATABASE_URL=") {
                $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$dbUrl"
            } else { $envContent += "`nDATABASE_URL=$dbUrl" }
            
            Write-Success "Supabase configured"
        }
        "firebase" {
            Write-Info "Enter Firebase credentials:"
            $apiKey = Read-Host "  API Key"
            $authDomain = Read-Host "  Auth Domain"
            $projectId = Read-Host "  Project ID"
            $storageBucket = Read-Host "  Storage Bucket"
            
            $envContent = $envContent -replace "VITE_FIREBASE_API_KEY=.*", "VITE_FIREBASE_API_KEY=$apiKey"
            $envContent = $envContent -replace "VITE_FIREBASE_AUTH_DOMAIN=.*", "VITE_FIREBASE_AUTH_DOMAIN=$authDomain"
            $envContent = $envContent -replace "VITE_FIREBASE_PROJECT_ID=.*", "VITE_FIREBASE_PROJECT_ID=$projectId"
            $envContent = $envContent -replace "VITE_FIREBASE_STORAGE_BUCKET=.*", "VITE_FIREBASE_STORAGE_BUCKET=$storageBucket"
            
            Write-Success "Firebase configured (auth/sync only)"
        }
        "aws" {
            Write-Info "Enter AWS RDS credentials:"
            $endpoint = Read-Host "  RDS Endpoint"
            $port = Read-Host "  Port (default: 5432)"
            $database = Read-Host "  Database Name"
            $username = Read-Host "  Username"
            $password = Read-Host "  Password"
            
            if ([string]::IsNullOrWhiteSpace($port)) { $port = "5432" }
            $dbUrl = "postgresql://${username}:${password}@${endpoint}:${port}/${database}"
            
            if ($envContent -match "DATABASE_URL=") {
                $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$dbUrl"
            } else { $envContent += "`nDATABASE_URL=$dbUrl" }
            
            Write-Success "AWS RDS configured"
        }
    }
    
    $envContent | Out-File -FilePath $envFile -Encoding UTF8
    Write-Info "Saved to .env"
}

# =============================================================================
# MAIN
# =============================================================================

function Main {
    Clear-Host

    # Simple ASCII header - no special Unicode characters
    Write-ColorOutput Magenta ""
    Write-ColorOutput Magenta "  ============================================================"
    Write-ColorOutput Magenta "       W E A V E N O T E   Smart Installer v3.0"
    Write-ColorOutput Magenta "  ============================================================"
    Write-ColorOutput Magenta ""

    if (-not (Test-Docker)) {
        Write-Err "Prerequisites not met. Install Docker Desktop."
        Read-Host "Press Enter to exit"
        exit 1
    }

    $dbType = Select-Database
    Configure-Database -Type $dbType

    Write-Header "Cleanup"
    Write-Info "Stopping existing containers..."
    docker-compose down 2>&1 | Out-Null
    Write-Success "Done"

    $success = Invoke-RealTimeBuild

    if (-not $success) {
        Write-Header "Build Failed"
        Write-Err "Check: $LogFile"
        Read-Host "Press Enter for last 30 lines"
        Get-Content $LogFile | Select-Object -Last 30
        exit 1
    }

    Wait-ForHealthy | Out-Null

    Write-Header "Installation Complete"
    Write-Success "Weavenote is running!"
    Write-Host ""
    Write-ColorOutput Green "  Database:  $dbType"
    Write-ColorOutput Green "  Frontend:  http://localhost:8080"
    Write-ColorOutput Green "  API:       http://localhost:3001"
    Write-Host ""
    Write-Info "Log: $LogFile"
    Write-Host ""
    Write-ColorOutput Cyan "  Commands:  stop | restart | logs"
    Write-Host "    docker-compose down"
    Write-Host "    docker-compose restart"
    Write-Host "    docker-compose logs -f"
    Write-Host ""

    $open = Read-Host "Open browser? (Y/n)"
    if ($open -ne "n") {
        Start-Process "http://localhost:8080"
    }
}

# Run
Main
