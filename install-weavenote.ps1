<#
.SYNOPSIS
    Weavenote One-Click Docker Installer
.DESCRIPTION
    This script automatically sets up Weavenote with Docker, PostgreSQL database,
    default credentials, and prompts for any missing environment variables.
.NOTES
    File Name      : install-weavenote.ps1
    Author         : Weavenote Team
    Prerequisite   : Docker Desktop must be installed and running
    Version        : 1.0.0
#>

# =============================================================================
# CONFIGURATION
# =============================================================================
$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Script version
$SCRIPT_VERSION = "1.0.0"

# Colors for output
$COLORS = @{
    Header = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "White"
    Progress = "DarkCyan"
}

# Default configuration
$DEFAULTS = @{
    # Ports
    FRONTEND_PORT = "8080"
    API_PORT = "3001"
    POSTGRES_PORT = "5432"
    PGADMIN_PORT = "5050"
    
    # Database defaults
    POSTGRES_USER = "weavenote"
    POSTGRES_DB = "weavenote"
    
    # Admin defaults
    ADMIN_EMAIL = "admin@weavenote.local"
    ADMIN_USERNAME = "admin"
    
    # JWT defaults
    JWT_EXPIRES_IN = "7d"
    
    # Rate limiting
    RATE_LIMIT_WINDOW_MS = "900000"
    RATE_LIMIT_MAX = "100"
    
    # CORS
    CORS_ORIGINS = "http://localhost:8080,http://localhost:3000"
}

# Required environment variables
$REQUIRED_VARS = @(
    @{ Name = "POSTGRES_PASSWORD"; Description = "PostgreSQL database password"; Secret = $true; Generate = $true }
    @{ Name = "JWT_SECRET"; Description = "JWT signing secret (min 32 chars)"; Secret = $true; Generate = $true }
    @{ Name = "GEMINI_API_KEY"; Description = "Google Gemini API key"; Secret = $true; Generate = $false }
)

# Optional environment variables
$OPTIONAL_VARS = @(
    @{ Name = "VITE_FIREBASE_API_KEY"; Description = "Firebase API key"; Default = "" }
    @{ Name = "VITE_FIREBASE_AUTH_DOMAIN"; Description = "Firebase auth domain"; Default = "" }
    @{ Name = "VITE_FIREBASE_PROJECT_ID"; Description = "Firebase project ID"; Default = "" }
    @{ Name = "VITE_FIREBASE_STORAGE_BUCKET"; Description = "Firebase storage bucket"; Default = "" }
    @{ Name = "ADMIN_SETUP_PASS"; Description = "Admin setup password"; Default = "" }
    @{ Name = "ENCRYPTION_KEY"; Description = "Data encryption key"; Default = "" }
)

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "=" * 70 -ForegroundColor $COLORS.Header
    Write-Host "  $Message" -ForegroundColor $COLORS.Header
    Write-Host "=" * 70 -ForegroundColor $COLORS.Header
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [✓] $Message" -ForegroundColor $COLORS.Success
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  [!] $Message" -ForegroundColor $COLORS.Warning
}

function Write-Error {
    param([string]$Message)
    Write-Host "  [✗] $Message" -ForegroundColor $COLORS.Error
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [i] $Message" -ForegroundColor $COLORS.Info
}

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Message)
    $progress = [math]::Round(($Step / $Total) * 100)
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────┐" -ForegroundColor $COLORS.Progress
    Write-Host "  │ Step $Step/$Total - $Message".PadRight(61) -ForegroundColor $COLORS.Progress -NoNewline
    Write-Host "│" -ForegroundColor $COLORS.Progress
    Write-Host "  │ Progress: $progress%".PadRight(61) -ForegroundColor $COLORS.Progress -NoNewline
    Write-Host "│" -ForegroundColor $COLORS.Progress
    Write-Host "  └─────────────────────────────────────────────────────────────┘" -ForegroundColor $COLORS.Progress
    Write-Host ""
}

function Show-ProgressBar {
    param(
        [string]$Activity,
        [int]$PercentComplete,
        [string]$Status = ""
    )
    
    $progressBar = "[" + ("█" * [math]::Floor($PercentComplete / 5)) + ("░" * (20 - [math]::Floor($PercentComplete / 5))) + "]"
    $statusText = if ($Status) { " - $Status" } else { "" }
    
    Write-Host "`r  $Activity $progressBar $PercentComplete%$statusText" -NoNewline -ForegroundColor $COLORS.Progress
    
    if ($PercentComplete -eq 100) {
        Write-Host ""
    }
}

function Generate-SecurePassword {
    param([int]$Length = 32)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
    $secureString = New-Object System.Security.SecureString
    $random = New-Object System.Random
    
    for ($i = 0; $i -lt $Length; $i++) {
        $char = $chars[$random.Next($chars.Length)]
        $secureString.AppendChar($char)
    }
    
    $secureString.MakeReadOnly()
    
    # Convert to plain text for .env file
    $password = ""
    for ($i = 0; $i -lt $Length; $i++) {
        $password += $chars[$random.Next($chars.Length)]
    }
    
    return $password
}

function Generate-EncryptionKey {
    param([int]$Bytes = 32)
    $bytes = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return [BitConverter]::ToString($bytes).Replace("-", "").ToLower()
}

function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Invoke-SafeCommand {
    param(
        [scriptblock]$Command,
        [string]$ErrorMessage = "Command failed",
        [int]$Retries = 3,
        [int]$DelaySeconds = 5
    )
    
    $attempt = 0
    while ($attempt -lt $Retries) {
        try {
            $result = & $Command
            return $result
        }
        catch {
            $attempt++
            if ($attempt -lt $Retries) {
                Write-Warning "$ErrorMessage (Attempt $attempt/$Retries). Retrying in $DelaySeconds seconds..."
                Start-Sleep -Seconds $DelaySeconds
            }
            else {
                throw "$ErrorMessage after $Retries attempts: $_"
            }
        }
    }
}

# =============================================================================
# PREREQUISITE CHECKS
# =============================================================================

function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    $prerequisites = @()
    
    # Check Docker
    Write-Info "Checking Docker Desktop..."
    if (Test-Command "docker") {
        try {
            $dockerVersion = docker version --format "{{.Server.Version}}" 2>$null
            if ($dockerVersion) {
                Write-Success "Docker Desktop is installed (Version: $dockerVersion)"
                $prerequisites += $true
            }
            else {
                Write-Error "Docker Desktop is installed but not running"
                Write-Info "Please start Docker Desktop and try again"
                $prerequisites += $false
            }
        }
        catch {
            Write-Error "Docker Desktop is not running"
            $prerequisites += $false
        }
    }
    else {
        Write-Error "Docker Desktop is not installed"
        Write-Info "Download from: https://www.docker.com/products/docker-desktop"
        $prerequisites += $false
    }
    
    # Check Docker Compose
    Write-Info "Checking Docker Compose..."
    if (Test-Command "docker-compose") {
        $composeVersion = docker-compose version --short 2>$null
        Write-Success "Docker Compose is installed (Version: $composeVersion)"
        $prerequisites += $true
    }
    elseif (docker compose version 2>$null) {
        Write-Success "Docker Compose (v2) is available"
        $prerequisites += $true
    }
    else {
        Write-Error "Docker Compose is not available"
        $prerequisites += $false
    }
    
    # Check Git
    Write-Info "Checking Git..."
    if (Test-Command "git") {
        $gitVersion = git --version 2>$null
        Write-Success "Git is installed ($gitVersion)"
        $prerequisites += $true
    }
    else {
        Write-Warning "Git is not installed (optional for cloning)"
        $prerequisites += $true
    }
    
    # Check available ports
    Write-Info "Checking required ports..."
    $ports = @($DEFAULTS.FRONTEND_PORT, $DEFAULTS.API_PORT, $DEFAULTS.POSTGRES_PORT)
    $portsAvailable = $true
    
    foreach ($port in $ports) {
        $connection = New-Object System.Net.Sockets.TcpClient
        try {
            $connection.Connect("localhost", [int]$port)
            $connection.Close()
            Write-Warning "Port $port is already in use"
            $portsAvailable = $false
        }
        catch {
            Write-Success "Port $port is available"
        }
    }
    
    $prerequisites += $portsAvailable
    
    return ($prerequisites -notcontains $false)
}

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

function Get-EnvironmentVariables {
    Write-Header "Configuring Environment Variables"
    
    $envVars = @{}
    
    # Set default values
    Write-Info "Setting default configuration values..."
    $envVars["FRONTEND_PORT"] = $DEFAULTS.FRONTEND_PORT
    $envVars["API_PORT"] = $DEFAULTS.API_PORT
    $envVars["POSTGRES_PORT"] = $DEFAULTS.POSTGRES_PORT
    $envVars["PGADMIN_PORT"] = $DEFAULTS.PGADMIN_PORT
    $envVars["POSTGRES_USER"] = $DEFAULTS.POSTGRES_USER
    $envVars["POSTGRES_DB"] = $DEFAULTS.POSTGRES_DB
    $envVars["JWT_EXPIRES_IN"] = $DEFAULTS.JWT_EXPIRES_IN
    $envVars["RATE_LIMIT_WINDOW_MS"] = $DEFAULTS.RATE_LIMIT_WINDOW_MS
    $envVars["RATE_LIMIT_MAX"] = $DEFAULTS.RATE_LIMIT_MAX
    $envVars["CORS_ORIGINS"] = $DEFAULTS.CORS_ORIGINS
    $envVars["VITE_API_URL"] = "/api"
    
    Write-Success "Default values configured"
    
    # Process required variables
    Write-Info "Processing required environment variables..."
    
    foreach ($var in $REQUIRED_VARS) {
        Write-Host ""
        Write-Host "  ┌─────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
        Write-Host "  │ Required: $($var.Name)".PadRight(62) -ForegroundColor Yellow -NoNewline
        Write-Host "│" -ForegroundColor Yellow
        Write-Host "  │ $($var.Description)".PadRight(62) -ForegroundColor Yellow -NoNewline
        Write-Host "│" -ForegroundColor Yellow
        Write-Host "  └─────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
        
        if ($var.Generate) {
            Write-Host ""
            $generate = Read-Host "  Generate secure random value? (Y/n)"
            
            if ($generate -ne "n" -and $generate -ne "N") {
                if ($var.Name -eq "JWT_SECRET" -or $var.Name -eq "POSTGRES_PASSWORD") {
                    $value = Generate-SecurePassword -Length 32
                }
                else {
                    $value = Generate-EncryptionKey -Bytes 32
                }
                Write-Success "Generated secure value for $($var.Name)"
                $envVars[$var.Name] = $value
            }
            else {
                $value = Read-Host "  Enter value for $($var.Name)"
                while ([string]::IsNullOrWhiteSpace($value)) {
                    Write-Error "Value cannot be empty"
                    $value = Read-Host "  Enter value for $($var.Name)"
                }
                $envVars[$var.Name] = $value
            }
        }
        else {
            $value = Read-Host "  Enter value for $($var.Name)"
            while ([string]::IsNullOrWhiteSpace($value)) {
                Write-Error "Value cannot be empty - $($var.Name) is required"
                $value = Read-Host "  Enter value for $($var.Name)"
            }
            $envVars[$var.Name] = $value
        }
    }
    
    # Process optional variables
    Write-Host ""
    Write-Info "Optional environment variables (press Enter to skip)..."
    
    foreach ($var in $OPTIONAL_VARS) {
        Write-Host ""
        $value = Read-Host "  $($var.Name) [$($var.Description)]"
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $envVars[$var.Name] = $value
        }
        elseif ($var.Default) {
            $envVars[$var.Name] = $var.Default
        }
    }
    
    # Generate encryption key if not provided
    if (-not $envVars.ContainsKey("ENCRYPTION_KEY")) {
        $envVars["ENCRYPTION_KEY"] = Generate-EncryptionKey -Bytes 32
        Write-Success "Generated encryption key for secure storage"
    }
    
    return $envVars
}

function New-EnvFile {
    param([hashtable]$EnvVars, [string]$Path)
    
    Write-Header "Creating Environment File"
    
    $content = @"
# =============================================================================
# Weavenote Environment Configuration
# Generated by install-weavenote.ps1 on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# =============================================================================

# -----------------------------------------------------------------------------
# Ports Configuration
# -----------------------------------------------------------------------------
FRONTEND_PORT=$($EnvVars['FRONTEND_PORT'])
API_PORT=$($EnvVars['API_PORT'])
POSTGRES_PORT=$($EnvVars['POSTGRES_PORT'])
PGADMIN_PORT=$($EnvVars['PGADMIN_PORT'])

# -----------------------------------------------------------------------------
# PostgreSQL Database Configuration
# -----------------------------------------------------------------------------
POSTGRES_USER=$($EnvVars['POSTGRES_USER'])
POSTGRES_PASSWORD=$($EnvVars['POSTGRES_PASSWORD'])
POSTGRES_DB=$($EnvVars['POSTGRES_DB'])

# -----------------------------------------------------------------------------
# Backend API Configuration
# -----------------------------------------------------------------------------
JWT_SECRET=$($EnvVars['JWT_SECRET'])
JWT_EXPIRES_IN=$($EnvVars['JWT_EXPIRES_IN'])

# -----------------------------------------------------------------------------
# AI Configuration (Google Gemini)
# -----------------------------------------------------------------------------
GEMINI_API_KEY=$($EnvVars['GEMINI_API_KEY'])
API_KEY=$($EnvVars['GEMINI_API_KEY'])

# -----------------------------------------------------------------------------
# Security Configuration
# -----------------------------------------------------------------------------
ENCRYPTION_KEY=$($EnvVars['ENCRYPTION_KEY'])
CORS_ORIGINS=$($EnvVars['CORS_ORIGINS'])
RATE_LIMIT_WINDOW_MS=$($EnvVars['RATE_LIMIT_WINDOW_MS'])
RATE_LIMIT_MAX=$($EnvVars['RATE_LIMIT_MAX'])

# -----------------------------------------------------------------------------
# Frontend Configuration
# -----------------------------------------------------------------------------
VITE_API_URL=$($EnvVars['VITE_API_URL'])

# -----------------------------------------------------------------------------
# Admin Configuration
# -----------------------------------------------------------------------------
ADMIN_EMAIL=$($EnvVars['ADMIN_EMAIL'])
ADMIN_USERNAME=$($EnvVars['ADMIN_USERNAME'])
"@
    
    # Add optional Firebase vars if present
    if ($EnvVars.ContainsKey('VITE_FIREBASE_API_KEY')) {
        $content += @"

# -----------------------------------------------------------------------------
# Firebase Configuration (Optional)
# -----------------------------------------------------------------------------
VITE_FIREBASE_API_KEY=$($EnvVars['VITE_FIREBASE_API_KEY'])
"@
    }
    if ($EnvVars.ContainsKey('VITE_FIREBASE_AUTH_DOMAIN')) {
        $content += "VITE_FIREBASE_AUTH_DOMAIN=$($EnvVars['VITE_FIREBASE_AUTH_DOMAIN'])"
    }
    if ($EnvVars.ContainsKey('VITE_FIREBASE_PROJECT_ID')) {
        $content += "VITE_FIREBASE_PROJECT_ID=$($EnvVars['VITE_FIREBASE_PROJECT_ID'])"
    }
    if ($EnvVars.ContainsKey('VITE_FIREBASE_STORAGE_BUCKET')) {
        $content += "VITE_FIREBASE_STORAGE_BUCKET=$($EnvVars['VITE_FIREBASE_STORAGE_BUCKET'])"
    }
    
    try {
        $content | Out-File -FilePath $Path -Encoding UTF8 -Force
        Write-Success "Environment file created at: $Path"
        return $true
    }
    catch {
        Write-Error "Failed to create environment file: $_"
        return $false
    }
}

# =============================================================================
# DOCKER OPERATIONS
# =============================================================================

function Stop-ExistingContainers {
    Write-Header "Stopping Existing Containers"
    
    $containers = @("weavenote-frontend", "weavenote-api", "weavenote-postgres", "weavenote-pgadmin")
    
    foreach ($container in $containers) {
        try {
            $exists = docker ps -a --filter "name=$container" --format "{{.Names}}" 2>$null
            if ($exists) {
                Write-Info "Stopping $container..."
                docker stop $container 2>$null
                docker rm $container 2>$null
                Write-Success "Stopped and removed $container"
            }
        }
        catch {
            Write-Warning "Could not stop $container"
        }
    }
}

function Build-DockerImages {
    Write-Header "Building Docker Images"
    
    $buildSteps = @(
        @{ Name = "Pulling base images"; Progress = 10 }
        @{ Name = "Building frontend"; Progress = 40 }
        @{ Name = "Building backend API"; Progress = 70 }
        @{ Name = "Building database"; Progress = 90 }
        @{ Name = "Finalizing"; Progress = 100 }
    )
    
    try {
        # Check for docker-compose or docker compose
        $composeCmd = "docker-compose"
        if (-not (Test-Command "docker-compose")) {
            $composeCmd = "docker compose"
        }
        
        Write-Info "Using: $composeCmd"
        
        foreach ($step in $buildSteps) {
            Show-ProgressBar -Activity "Building images" -PercentComplete $step.Progress -Status $step.Name
        }
        
        # Actual build command
        Write-Info "Executing build command..."
        $buildOutput = Invoke-Expression "$composeCmd build --no-cache 2>&1"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker images built successfully"
            return $true
        }
        else {
            Write-Error "Build failed with exit code: $LASTEXITCODE"
            Write-Host $buildOutput
            return $false
        }
    }
    catch {
        Write-Error "Failed to build Docker images: $_"
        return $false
    }
}

function Start-DockerContainers {
    Write-Header "Starting Docker Containers"
    
    $steps = @(
        @{ Name = "Creating network"; Progress = 10 }
        @{ Name = "Starting PostgreSQL"; Progress = 30 }
        @{ Name = "Running database migrations"; Progress = 50 }
        @{ Name = "Starting API server"; Progress = 70 }
        @{ Name = "Starting frontend"; Progress = 90 }
        @{ Name = "Health checks"; Progress = 100 }
    )
    
    try {
        # Check for docker-compose or docker compose
        $composeCmd = "docker-compose"
        if (-not (Test-Command "docker-compose")) {
            $composeCmd = "docker compose"
        }
        
        foreach ($step in $steps) {
            Show-ProgressBar -Activity "Starting services" -PercentComplete $step.Progress -Status $step.Name
        }
        
        Write-Info "Executing start command..."
        $startOutput = Invoke-Expression "$composeCmd up -d 2>&1"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Containers started successfully"
            return $true
        }
        else {
            Write-Error "Start failed with exit code: $LASTEXITCODE"
            Write-Host $startOutput
            return $false
        }
    }
    catch {
        Write-Error "Failed to start containers: $_"
        return $false
    }
}

function Wait-ForDatabase {
    Write-Header "Waiting for Database"
    
    $maxAttempts = 30
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        $attempt++
        Show-ProgressBar -Activity "Database ready" -PercentComplete ([math]::Round(($attempt / $maxAttempts) * 100)) -Status "Attempt $attempt/$maxAttempts"
        
        try {
            $result = docker exec weavenote-postgres pg_isready -U $DEFAULTS.POSTGRES_USER 2>$null
            if ($result -match "accepting connections") {
                Write-Success "Database is ready"
                return $true
            }
        }
        catch {
            # Continue waiting
        }
        
        Start-Sleep -Seconds 2
    }
    
    Write-Error "Database failed to start within timeout"
    return $false
}

function Initialize-Database {
    Write-Header "Initializing Database"
    
    try {
        # Check if prisma migrate is available
        Write-Info "Running database migrations..."
        
        $migrateOutput = docker exec weavenote-api npx prisma migrate deploy 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database migrations completed"
        }
        else {
            Write-Warning "Migrations may have warnings (this is normal for first run)"
        }
        
        # Generate Prisma client
        Write-Info "Generating Prisma client..."
        docker exec weavenote-api npx prisma generate 2>$null
        
        Write-Success "Database initialized successfully"
        return $true
    }
    catch {
        Write-Warning "Database initialization had issues: $_"
        Write-Info "This may be normal if tables already exist"
        return $true
    }
}

function Test-ServiceHealth {
    Write-Header "Running Health Checks"
    
    $services = @(
        @{ Name = "Frontend"; Url = "http://localhost:$($DEFAULTS.FRONTEND_PORT)/health" }
        @{ Name = "API"; Url = "http://localhost:$($DEFAULTS.API_PORT)/api/health" }
    )
    
    $allHealthy = $true
    
    foreach ($service in $services) {
        Write-Info "Checking $($service.Name)..."
        
        $attempt = 0
        $maxAttempts = 15
        $healthy = $false
        
        while ($attempt -lt $maxAttempts -and -not $healthy) {
            $attempt++
            try {
                $response = Invoke-WebRequest -Uri $service.Url -TimeoutSec 5 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    $healthy = $true
                    Write-Success "$($service.Name) is healthy"
                }
            }
            catch {
                Start-Sleep -Seconds 2
            }
        }
        
        if (-not $healthy) {
            Write-Warning "$($service.Name) health check timed out"
            $allHealthy = $false
        }
    }
    
    return $allHealthy
}

# =============================================================================
# DISPLAY FUNCTIONS
# =============================================================================

function Show-InstallationSummary {
    param([hashtable]$EnvVars)
    
    Write-Header "Installation Complete!"
    
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Green
    Write-Host "  │                                                                     │" -ForegroundColor Green
    Write-Host "  │   🎉 WEAVERNOTE IS NOW RUNNING! 🎉                                  │" -ForegroundColor Green
    Write-Host "  │                                                                     │" -ForegroundColor Green
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "  Access Points:" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  📱 Frontend:     " -NoNewline; Write-Host "http://localhost:$($EnvVars['FRONTEND_PORT'])" -ForegroundColor White
    Write-Host "  🔌 API:          " -NoNewline; Write-Host "http://localhost:$($EnvVars['API_PORT'])/api" -ForegroundColor White
    Write-Host "  🗄️  Database:     " -NoNewline; Write-Host "localhost:$($EnvVars['POSTGRES_PORT'])" -ForegroundColor White
    Write-Host ""
    
    Write-Host "  Credentials:" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  👤 Database User:     " -NoNewline; Write-Host $EnvVars['POSTGRES_USER'] -ForegroundColor White
    Write-Host "  🔐 Database Password: " -NoNewline; Write-Host "******** (saved in .env)" -ForegroundColor Yellow
    Write-Host "  🗄️  Database Name:    " -NoNewline; Write-Host $EnvVars['POSTGRES_DB'] -ForegroundColor White
    Write-Host ""
    
    Write-Host "  Quick Commands:" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  View logs:        docker-compose logs -f" -ForegroundColor White
    Write-Host "  Stop services:    docker-compose down" -ForegroundColor White
    Write-Host "  Restart:          docker-compose restart" -ForegroundColor White
    Write-Host "  Open shell:       docker exec -it weavenote-api sh" -ForegroundColor White
    Write-Host ""
    
    Write-Host "  Settings:" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  ⚙️  Click the gear icon (⚙️) in the top-right corner to access settings" -ForegroundColor White
    Write-Host "  🔐 Admin users can configure ENV variables in Settings → ENV Settings" -ForegroundColor White
    Write-Host ""
    
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
    Write-Host "  │ ⚠️  IMPORTANT: Save your credentials securely!                      │" -ForegroundColor Yellow
    Write-Host "  │     Your .env file contains sensitive information.                 │" -ForegroundColor Yellow
    Write-Host "  │     Never commit .env files to version control.                    │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
    Write-Host ""
}

function Show-Logs {
    param([int]$Lines = 50)
    
    Write-Header "Recent Container Logs"
    
    Write-Info "API Logs (last $Lines lines):"
    Write-Host "───────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    docker logs weavenote-api --tail $Lines 2>&1
    Write-Host ""
    
    Write-Info "Frontend Logs (last $Lines lines):"
    Write-Host "───────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    docker logs weavenote-frontend --tail $Lines 2>&1
    Write-Host ""
    
    Write-Info "Database Logs (last $Lines lines):"
    Write-Host "───────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    docker logs weavenote-postgres --tail $Lines 2>&1
    Write-Host ""
}

function Show-DockerStatus {
    Write-Header "Docker Container Status"
    
    docker ps --filter "name=weavenote" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    Write-Host ""
}

# =============================================================================
# ERROR HANDLING
# =============================================================================

function Write-ErrorLog {
    param([string]$Message, [Exception]$Error)
    
    $logFile = "weavenote-install-error.log"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    $logEntry = @"
[$timestamp] ERROR: $Message
Exception: $($Error.Message)
StackTrace: $($Error.StackTrace)
"@
    
    $logEntry | Out-File -FilePath $logFile -Append -Encoding UTF8
    
    Write-Error "Error: $Message"
    Write-Info "Error details saved to: $logFile"
}

function Invoke-Cleanup {
    Write-Header "Cleaning Up Failed Installation"
    
    Write-Info "Stopping containers..."
    docker-compose down -v 2>$null
    
    Write-Info "Removing orphaned resources..."
    docker system prune -f 2>$null
    
    Write-Warning "Installation was rolled back due to errors"
}

# =============================================================================
# MAIN INSTALLATION SCRIPT
# =============================================================================

function Main {
    $totalSteps = 8
    $currentStep = 0
    
    Clear-Host
    
    # Display banner
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║                                                                   ║" -ForegroundColor Cyan
    Write-Host "  ║   🧶 WEAVERNOTE DOCKER INSTALLER v$SCRIPT_VERSION                          ║" -ForegroundColor Cyan
    Write-Host "  ║                                                                   ║" -ForegroundColor Cyan
    Write-Host "  ║   AI-powered note workspace with PostgreSQL backend               ║" -ForegroundColor Cyan
    Write-Host "  ║                                                                   ║" -ForegroundColor Cyan
    Write-Host "  ╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        # Step 1: Check prerequisites
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Checking Prerequisites"
        
        if (-not (Test-Prerequisites)) {
            Write-Error "Prerequisites check failed. Please install missing components."
            Write-Info "Press any key to exit..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
        
        # Step 2: Configure environment
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Configuring Environment"
        
        $envVars = Get-EnvironmentVariables
        
        # Add admin defaults
        $envVars["ADMIN_EMAIL"] = $DEFAULTS.ADMIN_EMAIL
        $envVars["ADMIN_USERNAME"] = $DEFAULTS.ADMIN_USERNAME
        
        # Step 3: Create .env file
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Creating Configuration Files"
        
        if (-not (New-EnvFile -EnvVars $envVars -Path ".env")) {
            throw "Failed to create environment file"
        }
        
        # Also create backend .env
        $backendEnv = @"
DATABASE_URL=postgresql://$($envVars['POSTGRES_USER']):$($envVars['POSTGRES_PASSWORD'])@postgres:5432/$($envVars['POSTGRES_DB'])?schema=public
JWT_SECRET=$($envVars['JWT_SECRET'])
GEMINI_API_KEY=$($envVars['GEMINI_API_KEY'])
ENCRYPTION_KEY=$($envVars['ENCRYPTION_KEY'])
"@
        $backendEnv | Out-File -FilePath "backend/.env" -Encoding UTF8 -Force
        Write-Success "Backend environment file created"
        
        # Step 4: Stop existing containers
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Cleaning Up Existing Containers"
        
        Stop-ExistingContainers
        
        # Step 5: Build Docker images
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Building Docker Images"
        
        if (-not (Build-DockerImages)) {
            throw "Failed to build Docker images"
        }
        
        # Step 6: Start containers
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Starting Docker Containers"
        
        if (-not (Start-DockerContainers)) {
            throw "Failed to start Docker containers"
        }
        
        # Step 7: Initialize database
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Initializing Database"
        
        if (-not (Wait-ForDatabase)) {
            throw "Database failed to start"
        }
        
        Start-Sleep -Seconds 5  # Give DB extra time
        Initialize-Database
        
        # Step 8: Health checks
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Running Health Checks"
        
        Test-ServiceHealth
        
        # Show status
        Show-DockerStatus
        
        # Show summary
        Show-InstallationSummary -EnvVars $envVars
        
        # Ask to show logs
        Write-Host ""
        $showLogs = Read-Host "  Show container logs? (y/N)"
        if ($showLogs -eq "y" -or $showLogs -eq "Y") {
            Show-Logs
        }
        
        # Ask to open browser
        Write-Host ""
        $openBrowser = Read-Host "  Open Weavenote in browser? (Y/n)"
        if ($openBrowser -ne "n" -and $openBrowser -ne "N") {
            Start-Process "http://localhost:$($envVars['FRONTEND_PORT'])"
        }
        
        Write-Host ""
        Write-Success "Installation completed successfully!"
        Write-Info "Run 'docker-compose logs -f' to view live logs"
        
    }
    catch {
        Write-ErrorLog -Message "Installation failed" -Error $_
        
        Write-Host ""
        $cleanup = Read-Host "  Attempt to cleanup failed installation? (Y/n)"
        if ($cleanup -ne "n" -and $cleanup -ne "N") {
            Invoke-Cleanup
        }
        
        Write-Host ""
        Write-Error "Installation failed. Check weavenote-install-error.log for details."
        Write-Info "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# =============================================================================
# ENTRY POINT
# =============================================================================

# Check if running as administrator (recommended but not required)
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Warning "Running without administrator privileges"
    Write-Info "Some operations may require elevated permissions"
    Write-Host ""
}

# Run main function
Main
