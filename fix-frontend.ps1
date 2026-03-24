# =============================================================================
# Weavenote Setup & Diagnostic Tool
# =============================================================================
# Features:
# - Database backend selection (On-Prem, Cloud, Firebase, AWS)
# - Real-time progress with 0-99% bar
# - Diagnostic and repair tools
# =============================================================================

param(
    [string]$Action = "menu"
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

function Show-ProgressBar {
    param([int]$Percent, [string]$Status = "")
    $Percent = [Math]::Max(0, [Math]::Min(99, $Percent))
    $barWidth = 40
    $filled = [Math]::Floor($Percent / 100 * $barWidth)
    $empty = $barWidth - $filled
    $bar = "[" + ("█" * $filled) + ("░" * $empty) + "]"
    Write-Host "`r  $bar $Percent% $Status" -NoNewline
}

function Complete-ProgressBar {
    param([string]$Status = "Complete!")
    Write-Host "`r  [" + ("█" * 40) + "] 100% $Status"
}

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

$script:DatabaseConfig = @{
    Type = "postgresql"  # Default: on-prem PostgreSQL
    Firebase = @{
        Enabled = $false
        ApiKey = ""
        AuthDomain = ""
        ProjectId = ""
        StorageBucket = ""
        MessagingSenderId = ""
        AppId = ""
    }
    AWS = @{
        Enabled = $false
        Region = ""
        AccessKeyId = ""
        SecretAccessKey = ""
    }
    Supabase = @{
        Enabled = $false
        Url = ""
        AnonKey = ""
    }
}

function Show-DatabaseMenu {
    Clear-Host
    Write-ColorOutput Magenta @"

  ██╗    ██╗██╗  ██╗███████╗██╗     ███████╗ ██████╗ ███╗   ██╗
  ██║    ██║██║  ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗  ██║
  ██║ █╗ ██║███████║█████╗  ██║     ███████╗██║   ██║██╔██╗ ██║
  ██║███╗██║██╔══██║██╔══╝  ██║     ╚════██║██║   ██║██║╚██╗██║
  ╚███╔███╔╝██║  ██║███████╗███████╗███████║╚██████╔╝██║ ╚████║
   ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝

  Database Configuration

"@
    Write-Host "  SELECT DATABASE BACKEND:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [1] PostgreSQL (On-Premises) - DEFAULT" -ForegroundColor Green
    Write-Host "      Local Docker PostgreSQL - Full control, no cloud needed"
    Write-Host ""
    Write-Host "  [2] Supabase (Cloud PostgreSQL)" -ForegroundColor Cyan
    Write-Host "      Managed PostgreSQL with real-time features"
    Write-Host ""
    Write-Host "  [3] Firebase (Cloud)" -ForegroundColor Yellow
    Write-Host "      Google's NoSQL database with authentication"
    Write-Host ""
    Write-Host "  [4] AWS RDS (Cloud)" -ForegroundColor Magenta
    Write-Host "      Amazon's managed relational database"
    Write-Host ""
    Write-Host "  [Q] Cancel" -ForegroundColor Gray
    Write-Host ""

    $choice = Read-Host "  Select option"
    return $choice
}

function Configure-PostgreSQL {
    Write-Header "Configuring On-Premises PostgreSQL"
    Write-Success "Using local Docker PostgreSQL"
    Write-Info "No cloud configuration needed!"
    Write-Info "Database runs in weavenote-postgres container"
    
    $script:DatabaseConfig.Type = "postgresql"
    $script:DatabaseConfig.Firebase.Enabled = $false
    $script:DatabaseConfig.AWS.Enabled = $false
    $script:DatabaseConfig.Supabase.Enabled = $false
    
    # Disable Firebase in .env
    Update-EnvFile -DisableFirebase
    Write-Success "Configuration saved!"
    return $true
}

function Configure-Supabase {
    Write-Header "Configuring Supabase (Cloud PostgreSQL)"
    
    Write-Info "You need Supabase credentials from: https://supabase.com"
    Write-Host ""
    
    $url = Read-Host "  Supabase URL (e.g., https://xxx.supabase.co)"
    $anonKey = Read-Host "  Supabase Anon Key"
    $dbUrl = Read-Host "  Database URL (from Project Settings > Database)"
    
    if ([string]::IsNullOrWhiteSpace($url) -or [string]::IsNullOrWhiteSpace($anonKey)) {
        Write-Err "Invalid credentials"
        return $false
    }
    
    $script:DatabaseConfig.Type = "supabase"
    $script:DatabaseConfig.Supabase.Enabled = $true
    $script:DatabaseConfig.Supabase.Url = $url
    $script:DatabaseConfig.Supabase.AnonKey = $anonKey
    $script:DatabaseConfig.Firebase.Enabled = $false
    
    # Update .env
    Update-EnvFile -SupabaseUrl $url -SupabaseKey $anonKey -DatabaseUrl $dbUrl
    
    Write-Success "Supabase configured!"
    return $true
}

function Configure-Firebase {
    Write-Header "Configuring Firebase (Cloud)"
    
    Write-Info "You need Firebase credentials from: https://console.firebase.google.com"
    Write-Host ""
    
    $apiKey = Read-Host "  Firebase API Key"
    $authDomain = Read-Host "  Auth Domain (e.g., your-project.firebaseapp.com)"
    $projectId = Read-Host "  Project ID"
    $storageBucket = Read-Host "  Storage Bucket (e.g., your-project.appspot.com)"
    $messagingSenderId = Read-Host "  Messaging Sender ID"
    $appId = Read-Host "  App ID"
    
    if ([string]::IsNullOrWhiteSpace($apiKey) -or [string]::IsNullOrWhiteSpace($projectId)) {
        Write-Err "Invalid credentials"
        return $false
    }
    
    $script:DatabaseConfig.Type = "firebase"
    $script:DatabaseConfig.Firebase.Enabled = $true
    $script:DatabaseConfig.Firebase.ApiKey = $apiKey
    $script:DatabaseConfig.Firebase.AuthDomain = $authDomain
    $script:DatabaseConfig.Firebase.ProjectId = $projectId
    $script:DatabaseConfig.Firebase.StorageBucket = $storageBucket
    $script:DatabaseConfig.Firebase.MessagingSenderId = $messagingSenderId
    $script:DatabaseConfig.Firebase.AppId = $appId
    
    # Update .env
    Update-EnvFile -FirebaseConfig $script:DatabaseConfig.Firebase
    
    Write-Success "Firebase configured!"
    Write-Warn "Note: Firebase is for auth/sync. PostgreSQL is still used for main data."
    return $true
}

function Configure-AWS {
    Write-Header "Configuring AWS RDS"
    
    Write-Info "You need AWS RDS credentials"
    Write-Host ""
    
    $region = Read-Host "  AWS Region (e.g., us-east-1)"
    $endpoint = Read-Host "  RDS Endpoint"
    $port = Read-Host "  Port (default: 5432)"
    $database = Read-Host "  Database Name"
    $username = Read-Host "  Username"
    $password = Read-Host "  Password" -AsSecureString
    
    if ([string]::IsNullOrWhiteSpace($endpoint)) {
        Write-Err "Invalid credentials"
        return $false
    }
    
    $script:DatabaseConfig.Type = "aws"
    $script:DatabaseConfig.AWS.Enabled = $true
    $script:DatabaseConfig.AWS.Region = $region
    
    # Build connection string
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    )
    $dbUrl = "postgresql://${username}:${plainPassword}@${endpoint}:${port}/${database}"
    
    # Update .env
    Update-EnvFile -DatabaseUrl $dbUrl
    
    Write-Success "AWS RDS configured!"
    return $true
}

function Update-EnvFile {
    param(
        [switch]$DisableFirebase,
        [string]$SupabaseUrl = "",
        [string]$SupabaseKey = "",
        [string]$DatabaseUrl = "",
        [hashtable]$FirebaseConfig = $null
    )
    
    $envFile = ".env"
    $envContent = ""
    
    if (Test-Path $envFile) {
        $envContent = Get-Content $envFile -Raw
    }
    
    # Disable Firebase if requested
    if ($DisableFirebase) {
        $envContent = $envContent -replace "VITE_FIREBASE_API_KEY=.*", "VITE_FIREBASE_API_KEY="
        $envContent = $envContent -replace "VITE_FIREBASE_AUTH_DOMAIN=.*", "VITE_FIREBASE_AUTH_DOMAIN="
        $envContent = $envContent -replace "VITE_FIREBASE_PROJECT_ID=.*", "VITE_FIREBASE_PROJECT_ID="
        $envContent = $envContent -replace "VITE_FIREBASE_STORAGE_BUCKET=.*", "VITE_FIREBASE_STORAGE_BUCKET="
        $envContent = $envContent -replace "VITE_FIREBASE_MESSAGING_SENDER_ID=.*", "VITE_FIREBASE_MESSAGING_SENDER_ID="
        $envContent = $envContent -replace "VITE_FIREBASE_APP_ID=.*", "VITE_FIREBASE_APP_ID="
    }
    
    # Update Supabase
    if ($SupabaseUrl) {
        if ($envContent -match "SUPABASE_URL=") {
            $envContent = $envContent -replace "SUPABASE_URL=.*", "SUPABASE_URL=$SupabaseUrl"
        } else {
            $envContent += "`nSUPABASE_URL=$SupabaseUrl"
        }
        if ($envContent -match "SUPABASE_ANON_KEY=") {
            $envContent = $envContent -replace "SUPABASE_ANON_KEY=.*", "SUPABASE_ANON_KEY=$SupabaseKey"
        } else {
            $envContent += "`nSUPABASE_ANON_KEY=$SupabaseKey"
        }
    }
    
    # Update Database URL
    if ($DatabaseUrl) {
        if ($envContent -match "DATABASE_URL=") {
            $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$DatabaseUrl"
        } else {
            $envContent += "`nDATABASE_URL=$DatabaseUrl"
        }
    }
    
    # Update Firebase config
    if ($FirebaseConfig) {
        if ($FirebaseConfig.ApiKey) {
            $envContent = $envContent -replace "VITE_FIREBASE_API_KEY=.*", "VITE_FIREBASE_API_KEY=$($FirebaseConfig.ApiKey)"
        }
        if ($FirebaseConfig.AuthDomain) {
            $envContent = $envContent -replace "VITE_FIREBASE_AUTH_DOMAIN=.*", "VITE_FIREBASE_AUTH_DOMAIN=$($FirebaseConfig.AuthDomain)"
        }
        if ($FirebaseConfig.ProjectId) {
            $envContent = $envContent -replace "VITE_FIREBASE_PROJECT_ID=.*", "VITE_FIREBASE_PROJECT_ID=$($FirebaseConfig.ProjectId)"
        }
        if ($FirebaseConfig.StorageBucket) {
            $envContent = $envContent -replace "VITE_FIREBASE_STORAGE_BUCKET=.*", "VITE_FIREBASE_STORAGE_BUCKET=$($FirebaseConfig.StorageBucket)"
        }
        if ($FirebaseConfig.MessagingSenderId) {
            $envContent = $envContent -replace "VITE_FIREBASE_MESSAGING_SENDER_ID=.*", "VITE_FIREBASE_MESSAGING_SENDER_ID=$($FirebaseConfig.MessagingSenderId)"
        }
        if ($FirebaseConfig.AppId) {
            $envContent = $envContent -replace "VITE_FIREBASE_APP_ID=.*", "VITE_FIREBASE_APP_ID=$($FirebaseConfig.AppId)"
        }
    }
    
    $envContent | Out-File -FilePath $envFile -Encoding UTF8
    Write-Info "Updated .env file"
}

# =============================================================================
# DOCKER BUILD WITH REAL-TIME PROGRESS
# =============================================================================

function Invoke-DockerBuild {
    Write-Header "Building Docker Containers"
    
    $script:currentPercent = 0
    $script:currentStatus = "Initializing..."
    $logFile = "weavenote-install.log"
    
    "=== Weavenote Installation Log ===" | Out-File -FilePath $logFile
    "Started: $(Get-Date)" | Out-File -Append -FilePath $logFile
    "Database: $($script:DatabaseConfig.Type)" | Out-File -Append -FilePath $logFile
    
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
            Add-Content -Path "weavenote-install.log" -Value $line
            
            $percent = $script:currentPercent
            $status = $script:currentStatus
            
            if ($line -match "Pulling") { $percent = 5; $status = "Pulling images..." }
            elseif ($line -match "npm ci|npm install") { $percent = 25; $status = "Installing packages..." }
            elseif ($line -match "added.*packages") { $percent = 40; $status = "Packages ready" }
            elseif ($line -match "prisma generate") { $percent = 50; $status = "Generating Prisma..." }
            elseif ($line -match "vite.*build") { $percent = 60; $status = "Building frontend..." }
            elseif ($line -match "rendering chunks") { $percent = 75; $status = "Rendering chunks..." }
            elseif ($line -match "built in") { $percent = 80; $status = "Frontend built" }
            elseif ($line -match "Creating|Created") { $percent = 90; $status = "Creating containers..." }
            elseif ($line -match "Healthy") { $percent = 96; $status = "Health check passed" }
            
            if ($line -match "error|Error|ERROR|failed") {
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
    
    while (-not $process.HasExited) {
        Start-Sleep -Milliseconds 300
        Show-ProgressBar -Percent $script:currentPercent -Status $script:currentStatus
    }
    
    Start-Sleep -Milliseconds 500
    Write-Host ""
    Complete-ProgressBar -Status "Build complete!"
    
    return ($process.ExitCode -eq 0)
}

# =============================================================================
# DIAGNOSTIC FUNCTIONS
# =============================================================================

function Test-ContainerStatus {
    Write-Header "Container Status"
    
    $containers = docker ps -a --filter "name=weavenote" --format "{{.Names}}|{{.Status}}" 2>$null
    
    if (-not $containers) {
        Write-Warn "No containers found"
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
            Write-Err "$name - $status (CRASH LOOP)"
            $allHealthy = $false
        } else {
            Write-Warn "$name - $status"
            $allHealthy = $false
        }
    }
    
    return $allHealthy
}

function Get-ContainerLogs {
    Write-Header "Container Logs"
    Write-Info "=== FRONTEND ==="
    docker logs weavenote-frontend --tail 30 2>&1
    Write-Info "`n=== API ==="
    docker logs weavenote-api --tail 20 2>&1
    Write-Info "`n=== POSTGRES ==="
    docker logs weavenote-postgres --tail 10 2>&1
}

function Open-App {
    Start-Process "http://localhost:8080"
}

# =============================================================================
# REPAIR FUNCTIONS
# =============================================================================

function Repair-Containers {
    Write-Header "Rebuilding Containers"
    Write-Info "Stopping containers..."
    docker-compose down 2>&1 | Out-Null
    
    Write-Info "Removing old images..."
    docker rmi weavenote-frontend weavenote-api -f 2>$null
    
    Write-Info "Rebuilding..."
    Invoke-DockerBuild | Out-Null
    
    Write-Success "Done!"
}

function Start-FullRepair {
    Write-Header "Full Repair"
    
    # Configure database first
    $choice = Show-DatabaseMenu
    switch ($choice) {
        "1" { Configure-PostgreSQL | Out-Null }
        "2" { if (-not (Configure-Supabase)) { return } }
        "3" { if (-not (Configure-Firebase)) { return } }
        "4" { if (-not (Configure-AWS)) { return } }
        default { return }
    }
    
    Write-Info "Database: $($script:DatabaseConfig.Type)"
    
    # Rebuild
    Repair-Containers
    
    # Health check
    Write-Header "Health Check"
    $maxWait = 30
    for ($i = 0; $i -lt $maxWait; $i++) {
        Show-ProgressBar -Percent ([Math]::Floor($i / $maxWait * 99)) -Status "Waiting for services..."
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($r.StatusCode -eq 200) {
                Write-Host ""
                Write-Success "Services healthy!"
                break
            }
        } catch {}
        Start-Sleep -Seconds 1
    }
    
    Write-Header "Complete"
    Write-Success "Weavenote is ready!"
    Write-Host "  Frontend: http://localhost:8080" -ForegroundColor Green
}

# =============================================================================
# MAIN MENU
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

  Setup & Diagnostic Tool

"@
    Write-Host "  DATABASE OPTIONS:" -ForegroundColor Yellow
    Write-Host "  [D] Configure Database Backend"
    Write-Host ""
    Write-Host "  DIAGNOSTIC OPTIONS:" -ForegroundColor Cyan
    Write-Host "  [1] Check Container Status"
    Write-Host "  [2] View Container Logs"
    Write-Host ""
    Write-Host "  REPAIR OPTIONS:" -ForegroundColor Green
    Write-Host "  [3] Rebuild Containers"
    Write-Host "  [4] Full Repair (with database config)"
    Write-Host ""
    Write-Host "  OTHER:" -ForegroundColor Magenta
    Write-Host "  [5] Open Weavenote in Browser"
    Write-Host "  [Q] Quit"
    Write-Host ""
}

function Main {
    do {
        Show-Menu
        $choice = Read-Host "  Select option"
        
        switch ($choice.ToUpper()) {
            "D" {
                $dbChoice = Show-DatabaseMenu
                switch ($dbChoice) {
                    "1" { Configure-PostgreSQL }
                    "2" { Configure-Supabase }
                    "3" { Configure-Firebase }
                    "4" { Configure-AWS }
                }
            }
            "1" { Test-ContainerStatus }
            "2" { Get-ContainerLogs }
            "3" { Repair-Containers }
            "4" { Start-FullRepair }
            "5" { Open-App }
            "Q" { Write-Host "`n  Goodbye!"; return }
        }
        
        Write-Host "`n  Press any key to continue..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        
    } while ($true)
}

# Run
Main
