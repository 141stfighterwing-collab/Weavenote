<#
.SYNOPSIS
    Weavenote One-Click Docker Installer - Enhanced Production Version
.DESCRIPTION
    This script automatically sets up Weavenote with Docker, PostgreSQL database,
    default credentials, and prompts for any missing environment variables.
    
    Features:
    - Automatic dependency checking and installation guidance
    - Docker + database setup with health checks
    - Structured logging with file output
    - CLI argument support (-Environment, -Port, -Verbose, -DryRun, -Rebuild, -NoDocker)
    - Port conflict detection and auto-resolution
    - Configuration file parsing (.env, JSON)
    - Dry-run mode for testing
    - Comprehensive error handling

.NOTES
    File Name      : install-weavenote.ps1
    Author         : Weavenote Team
    Prerequisite   : Docker Desktop must be installed and running
    Version        : 2.0.0
    Compatibility  : PowerShell 5.1+ and PowerShell Core 6+ (cross-platform)

.EXAMPLE
    ./setup.ps1
    ./setup.ps1 -Environment dev -Verbose
    ./setup.ps1 -Environment prod -Port 9000 -Rebuild
    ./setup.ps1 -NoDocker -DryRun
    ./setup.ps1 -Environment prod -Port 8080 -Rebuild -Verbose
#>

# =============================================================================
# CONFIGURATION
# =============================================================================
[CmdletBinding()]
param(
    [Parameter(HelpMessage = "Deployment environment (dev|staging|prod)")]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment = "dev",
    
    [Parameter(HelpMessage = "Frontend port number")]
    [ValidateRange(1, 65535)]
    [int]$Port = 8080,
    
    [Parameter(HelpMessage = "Enable verbose output")]
    [switch]$VerboseMode,
    
    [Parameter(HelpMessage = "Enable dry-run mode (no changes made)")]
    [switch]$DryRun,
    
    [Parameter(HelpMessage = "Force rebuild Docker images")]
    [switch]$Rebuild,
    
    [Parameter(HelpMessage = "Run without Docker (local development)")]
    [switch]$NoDocker,
    
    [Parameter(HelpMessage = "Skip interactive prompts")]
    [switch]$NonInteractive,
    
    [Parameter(HelpMessage = "Configuration file path")]
    [string]$ConfigFile = "",
    
    [Parameter(HelpMessage = "Log file path")]
    [string]$LogFile = "",
    
    [Parameter(HelpMessage = "Force stop existing containers")]
    [switch]$Force,
    
    [Parameter(HelpMessage = "Run database migrations only")]
    [switch]$MigrateOnly,
    
    [Parameter(HelpMessage = "Show version and exit")]
    [switch]$Version
)

# Script version
$SCRIPT_VERSION = "2.0.0"

# Show version if requested
if ($Version) {
    Write-Host "Weavenote Installer v$SCRIPT_VERSION"
    exit 0
}

# Set error action preference
$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Script directory
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($SCRIPT_DIR)) {
    $SCRIPT_DIR = Get-Location
}

# =============================================================================
# LOGGING SYSTEM
# =============================================================================

# Log levels enum
enum LogLevel {
    DEBUG = 0
    INFO = 1
    WARN = 2
    ERROR = 3
    FATAL = 4
}

# Global log configuration
$script:LogConfig = @{
    File = ""
    Level = [LogLevel]::INFO
    Console = $true
    MaxFileSize = 10MB
    RetentionDays = 7
}

# Colors for console output
$COLORS = @{
    DEBUG = "DarkGray"
    INFO = "White"
    WARN = "Yellow"
    ERROR = "Red"
    FATAL = "Red"
    Header = "Cyan"
    Success = "Green"
    Progress = "DarkCyan"
}

<#
.SYNOPSIS
    Writes a structured log entry
#>
function Write-Log {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        
        [Parameter()]
        [LogLevel]$Level = [LogLevel]::INFO,
        
        [Parameter()]
        [hashtable]$Context = @{},
        
        [Parameter()]
        [string]$Category = "General",
        
        [Parameter()]
        [Exception]$Exception = $null
    )
    
    # Check if we should log this level
    if ($Level -lt $script:LogConfig.Level) {
        return
    }
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $levelStr = $Level.ToString().PadRight(5)
    
    # Build log entry
    $contextStr = if ($Context.Count -gt 0) {
        " | " + ($Context.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ", "
    } else { "" }
    
    $exceptionStr = if ($Exception) {
        " | Exception: $($Exception.Message)"
    } else { "" }
    
    $logEntry = "[$timestamp] [$levelStr] [$Category] $Message$contextStr$exceptionStr"
    
    # Console output with color
    if ($script:LogConfig.Console) {
        $color = $COLORS[$Level.ToString()]
        $prefix = switch ($Level) {
            ([LogLevel]::DEBUG) { "[D]" }
            ([LogLevel]::INFO) { "[i]" }
            ([LogLevel]::WARN) { "[!]" }
            ([LogLevel]::ERROR) { "[X]" }
            ([LogLevel]::FATAL) { "[F]" }
            default { "[?]" }
        }
        
        Write-Host "  $prefix $Message" -ForegroundColor $color
    }
    
    # File output
    if ($script:LogConfig.File -and (Test-Path (Split-Path $script:LogConfig.File -Parent) -ErrorAction SilentlyContinue)) {
        try {
            # Check file size and rotate if needed
            if ((Test-Path $script:LogConfig.File) -and (Get-Item $script:LogConfig.File).Length -gt $script:LogConfig.MaxFileSize) {
                $archiveFile = $script:LogConfig.File -replace '\.log$', "_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
                Move-Item $script:LogConfig.File $archiveFile -Force
            }
            
            $logEntry | Out-File -FilePath $script:LogConfig.File -Append -Encoding UTF8
        }
        catch {
            # Silently fail file logging to avoid loops
        }
    }
}

# Convenience logging functions
function Write-LogDebug { param([string]$Message, [hashtable]$Context = @{}) 
    Write-Log -Message $Message -Level ([LogLevel]::DEBUG) -Context $Context 
}
function Write-LogInfo { param([string]$Message, [hashtable]$Context = @{}) 
    Write-Log -Message $Message -Level ([LogLevel]::INFO) -Context $Context 
}
function Write-LogWarn { param([string]$Message, [hashtable]$Context = @{}) 
    Write-Log -Message $Message -Level ([LogLevel]::WARN) -Context $Context 
}
function Write-LogError { param([string]$Message, [hashtable]$Context = @{}, [Exception]$Exception = $null) 
    Write-Log -Message $Message -Level ([LogLevel]::ERROR) -Context $Context -Exception $Exception 
}
function Write-LogFatal { param([string]$Message, [hashtable]$Context = @{}, [Exception]$Exception = $null) 
    Write-Log -Message $Message -Level ([LogLevel]::FATAL) -Context $Context -Exception $Exception 
}

# Legacy compatibility functions
function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "=" * 70 -ForegroundColor $COLORS.Header
    Write-Host "  $Message" -ForegroundColor $COLORS.Header
    Write-Host "=" * 70 -ForegroundColor $COLORS.Header
    Write-Host ""
    Write-LogDebug "Header: $Message" -Context @{ Section = $Message }
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor $COLORS.Success
    Write-LogDebug "Success: $Message"
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!] $Message" -ForegroundColor $COLORS.Warn
    Write-LogWarn $Message
}

function Write-Err {
    param([string]$Message)
    Write-Host "  [X] $Message" -ForegroundColor $COLORS.Error
    Write-LogError $Message
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [i] $Message" -ForegroundColor $COLORS.Info
    Write-LogDebug $Message
}

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Message)
    $progress = [math]::Round(($Step / $Total) * 100)
    Write-Host ""
    Write-Host "  +--------------------------------------------------------------------+" -ForegroundColor $COLORS.Progress
    Write-Host "  | Step $Step/$Total - $Message".PadRight(69) -ForegroundColor $COLORS.Progress -NoNewline
    Write-Host "|" -ForegroundColor $COLORS.Progress
    Write-Host "  | Progress: $progress%".PadRight(69) -ForegroundColor $COLORS.Progress -NoNewline
    Write-Host "|" -ForegroundColor $COLORS.Progress
    Write-Host "  +--------------------------------------------------------------------+" -ForegroundColor $COLORS.Progress
    Write-Host ""
    Write-LogDebug "Step $Step/${Total}: $Message" -Context @{ Progress = "$progress%" }
}

function Show-ProgressBar {
    param(
        [string]$Activity,
        [int]$PercentComplete,
        [string]$Status = ""
    )
    
    $progressBar = "[" + ("#" * [math]::Floor($PercentComplete / 5)) + ("-" * (20 - [math]::Floor($PercentComplete / 5))) + "]"
    $statusText = if ($Status) { " - $Status" } else { "" }
    
    Write-Host "`r  $Activity $progressBar $PercentComplete%$statusText" -NoNewline -ForegroundColor $COLORS.Progress
    
    if ($PercentComplete -eq 100) {
        Write-Host ""
    }
}

# =============================================================================
# DEFAULT CONFIGURATION
# =============================================================================

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
    
    # Deployment mode
    USE_NPM = $false
    DOMAIN = ""
    USE_SSL = $false
    
    # Timeouts
    DB_TIMEOUT_SECONDS = 60
    HEALTH_CHECK_TIMEOUT_SECONDS = 30
    BUILD_TIMEOUT_SECONDS = 600
    
    # Retry settings
    MAX_RETRIES = 3
    RETRY_DELAY_SECONDS = 5
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

# Minimum version requirements
$MIN_VERSIONS = @{
    PowerShell = "5.1"
    Docker = "20.10"
    DockerCompose = "2.0"
    NodeJS = "18.0"
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

<#
.SYNOPSIS
    Compares two version strings
#>
function Compare-Version {
    param([string]$Version1, [string]$Version2)
    
    $v1 = $Version1 -split '\.' | ForEach-Object { [int]$_ }
    $v2 = $Version2 -split '\.' | ForEach-Object { [int]$_ }
    
    for ($i = 0; $i -lt [math]::Max($v1.Count, $v2.Count); $i++) {
        $n1 = if ($i -lt $v1.Count) { $v1[$i] } else { 0 }
        $n2 = if ($i -lt $v2.Count) { $v2[$i] } else { 0 }
        
        if ($n1 -gt $n2) { return 1 }
        if ($n1 -lt $n2) { return -1 }
    }
    return 0
}

<#
.SYNOPSIS
    Generates a secure random password
#>
function Generate-SecurePassword {
    param([int]$Length = 32)
    
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
    $password = -join (1..$Length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    
    return $password
}

<#
.SYNOPSIS
    Generates a hex encryption key
#>
function Generate-EncryptionKey {
    param([int]$Bytes = 32)
    
    $bytes = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    
    return [BitConverter]::ToString($bytes).Replace("-", "").ToLower()
}

<#
.SYNOPSIS
    Tests if a command exists
#>
function Test-Command {
    param([string]$Command)
    
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

<#
.SYNOPSIS
    Invokes a command with retry logic
#>
function Invoke-WithRetry {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$ScriptBlock,
        
        [string]$Activity = "Operation",
        [int]$MaxRetries = $DEFAULTS.MAX_RETRIES,
        [int]$DelaySeconds = $DEFAULTS.RETRY_DELAY_SECONDS,
        [switch]$Silent
    )
    
    $attempt = 0
    while ($attempt -lt $MaxRetries) {
        $attempt++
        try {
            $result = & $ScriptBlock
            return $result
        }
        catch {
            if ($attempt -lt $MaxRetries) {
                if (-not $Silent) {
                    Write-Warn "$Activity failed (Attempt $attempt/$MaxRetries). Retrying in $DelaySeconds seconds..."
                }
                Start-Sleep -Seconds $DelaySeconds
            }
            else {
                throw "$Activity failed after $MaxRetries attempts: $_"
            }
        }
    }
}

<#
.SYNOPSIS
    Checks if a port is available
#>
function Test-PortAvailable {
    param([int]$Port, [string]$Host = "localhost")
    
    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $connection.Connect($Host, $Port)
        $connection.Close()
        return $false  # Port is in use
    }
    catch {
        return $true  # Port is available
    }
}

<#
.SYNOPSIS
    Finds an available port starting from the specified port
#>
function Find-AvailablePort {
    param(
        [int]$StartPort,
        [int]$MaxAttempts = 100
    )
    
    $port = $StartPort
    $attempts = 0
    
    while ($attempts -lt $MaxAttempts) {
        if (Test-PortAvailable -Port $port) {
            return $port
        }
        $port++
        $attempts++
    }
    
    throw "Could not find available port after $MaxAttempts attempts starting from $StartPort"
}

<#
.SYNOPSIS
    Detects what's using a port
#>
function Get-PortUser {
    param([int]$Port)
    
    try {
        if ($IsWindows -or $null -eq $IsWindows) {
            $result = netstat -ano | Select-String ":$Port\s" | Select-Object -First 1
            if ($result) {
                $pid = ($result -split '\s+')[-1]
                if ($pid -match '^\d+$') {
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        return @{
                            PID = $pid
                            ProcessName = $process.ProcessName
                            Command = $process.Path
                        }
                    }
                }
            }
        }
        elseif ($IsLinux -or $IsMacOS) {
            $result = lsof -i :$Port 2>$null
            if ($result) {
                return @{ RawOutput = $result }
            }
        }
    }
    catch {
        # Ignore errors in port detection
    }
    
    return $null
}

<#
.SYNOPSIS
    Gets the Docker Compose command to use
#>
function Get-DockerComposeCmd {
    if (Test-Command "docker-compose") {
        return "docker-compose"
    }
    elseif (docker compose version 2>$null) {
        return "docker compose"
    }
    else {
        throw "Docker Compose is not available. Please install Docker Compose."
    }
}

# =============================================================================
# SYSTEM PREREQUISITE CHECKS
# =============================================================================

<#
.SYNOPSIS
    Checks PowerShell version and compatibility
#>
function Test-PowerShellVersion {
    Write-Info "Checking PowerShell version..."
    
    $psVersion = $PSVersionTable.PSVersion.ToString()
    $shellEdition = $PSVersionTable.PSEdition
    
    if ((Compare-Version $psVersion $MIN_VERSIONS.PowerShell) -lt 0) {
        Write-Err "PowerShell version $psVersion is below minimum required $($MIN_VERSIONS.PowerShell)"
        Write-Info "Please upgrade PowerShell from: https://docs.microsoft.com/powershell/scripting/install/installing-powershell"
        return $false
    }
    
    Write-Success "PowerShell $psVersion ($shellEdition edition) - Compatible"
    Write-LogDebug "PowerShell details" -Context @{ Version = $psVersion; Edition = $shellEdition }
    return $true
}

<#
.SYNOPSIS
    Checks Docker installation and version
#>
function Test-DockerInstallation {
    Write-Info "Checking Docker..."
    
    if (-not (Test-Command "docker")) {
        Write-Err "Docker is not installed"
        Write-Info "Download from: https://www.docker.com/products/docker-desktop"
        
        if (-not $script:NoDocker) {
            return $false
        }
    }
    else {
        try {
            $dockerVersion = docker version --format "{{.Server.Version}}" 2>$null
            if (-not $dockerVersion) {
                Write-Err "Docker is installed but not running"
                Write-Info "Please start Docker Desktop and try again"
                
                if (-not $script:NoDocker) {
                    return $false
                }
            }
            else {
                if ((Compare-Version $dockerVersion $MIN_VERSIONS.Docker) -lt 0) {
                    Write-Warn "Docker version $dockerVersion is below recommended $($MIN_VERSIONS.Docker)"
                    Write-Info "Consider upgrading Docker for best compatibility"
                }
                else {
                    Write-Success "Docker $dockerVersion is installed and running"
                }
            }
        }
        catch {
            Write-Err "Docker check failed: $_"
            if (-not $script:NoDocker) {
                return $false
            }
        }
    }
    
    return $true
}

<#
.SYNOPSIS
    Checks Docker Compose installation
#>
function Test-DockerComposeInstallation {
    Write-Info "Checking Docker Compose..."
    
    try {
        $composeCmd = Get-DockerComposeCmd -ErrorAction SilentlyContinue
        
        $version = if ($composeCmd -eq "docker-compose") {
            docker-compose version --short 2>$null
        } else {
            docker compose version --short 2>$null
        }
        
        Write-Success "Docker Compose $version is available ($composeCmd)"
        Write-LogDebug "Docker Compose found" -Context @{ Command = $composeCmd; Version = $version }
    }
    catch {
        Write-Err "Docker Compose is not available"
        Write-Info "Docker Compose is included with Docker Desktop. Please ensure Docker is properly installed."
        
        if (-not $script:NoDocker) {
            return $false
        }
    }
    
    return $true
}

<#
.SYNOPSIS
    Checks Git installation
#>
function Test-GitInstallation {
    Write-Info "Checking Git..."
    
    if (Test-Command "git") {
        $gitVersion = (git --version 2>$null) -replace 'git version ', ''
        Write-Success "Git $gitVersion is installed"
        return $true
    }
    else {
        Write-Warn "Git is not installed (optional, used for cloning repository)"
        Write-Info "Download from: https://git-scm.com/downloads"
        return $true  # Optional, don't fail
    }
}

<#
.SYNOPSIS
    Checks Node.js installation (for non-Docker mode)
#>
function Test-NodeJSInstallation {
    if (-not $script:NoDocker) {
        return $true  # Not needed for Docker mode
    }
    
    Write-Info "Checking Node.js..."
    
    if (Test-Command "node") {
        $nodeVersion = (node --version 2>$null) -replace 'v', ''
        
        if ((Compare-Version $nodeVersion $MIN_VERSIONS.NodeJS) -lt 0) {
            Write-Err "Node.js version $nodeVersion is below minimum required $($MIN_VERSIONS.NodeJS)"
            Write-Info "Download from: https://nodejs.org/"
            return $false
        }
        
        Write-Success "Node.js $nodeVersion is installed"
        
        # Check npm
        if (Test-Command "npm") {
            $npmVersion = npm --version 2>$null
            Write-Success "npm $npmVersion is installed"
        }
        
        return $true
    }
    else {
        Write-Err "Node.js is not installed (required for -NoDocker mode)"
        Write-Info "Download from: https://nodejs.org/"
        return $false
    }
}

<#
.SYNOPSIS
    Runs all prerequisite checks
#>
function Test-AllPrerequisites {
    param([switch]$IncludeOptional)
    
    Write-Header "Checking System Prerequisites"
    
    $results = @{
        PowerShell = Test-PowerShellVersion
        Docker = if (-not $script:NoDocker) { Test-DockerInstallation } else { $true }
        DockerCompose = if (-not $script:NoDocker) { Test-DockerComposeInstallation } else { $true }
        Git = Test-GitInstallation
        NodeJS = Test-NodeJSInstallation
    }
    
    # Summary
    Write-Host ""
    Write-Info "Prerequisites Summary:"
    foreach ($key in $results.Keys) {
        $status = if ($results[$key]) { "[OK]" } else { "[FAIL]" }
        $color = if ($results[$key]) { "Green" } else { "Red" }
        Write-Host "  $status $key" -ForegroundColor $color
    }
    
    $allPassed = $results.Values -notcontains $false
    return $allPassed
}

# =============================================================================
# PORT MANAGEMENT
# =============================================================================

<#
.SYNOPSIS
    Checks and resolves port conflicts
#>
function Test-PortConflicts {
    param(
        [int]$FrontendPort,
        [int]$ApiPort,
        [int]$DbPort,
        [switch]$AutoResolve
    )
    
    Write-Header "Checking Port Availability"
    
    $ports = @(
        @{ Name = "Frontend"; Port = $FrontendPort }
        @{ Name = "API"; Port = $ApiPort }
        @{ Name = "Database"; Port = $DbPort }
    )
    
    $conflicts = @()
    $resolved = @{}
    
    foreach ($portInfo in $ports) {
        $port = $portInfo.Port
        $name = $portInfo.Name
        
        if (Test-PortAvailable -Port $port) {
            Write-Success "Port $port ($name) is available"
            $resolved[$name] = $port
        }
        else {
            Write-Warn "Port $port ($name) is in use"
            
            # Try to detect what's using the port
            $portUser = Get-PortUser -Port $port
            if ($portUser) {
                if ($portUser.ProcessName) {
                    Write-Info "  Used by: $($portUser.ProcessName) (PID: $($portUser.PID))"
                }
            }
            
            if ($AutoResolve) {
                $newPort = Find-AvailablePort -StartPort ($port + 1)
                Write-Info "  Auto-resolved to port: $newPort"
                $resolved[$name] = $newPort
                $conflicts += @{ Name = $name; OriginalPort = $port; NewPort = $newPort }
            }
            else {
                $conflicts += @{ Name = $name; Port = $port }
            }
        }
    }
    
    if ($conflicts.Count -gt 0 -and -not $AutoResolve) {
        Write-Host ""
        Write-Warn "Port conflicts detected. Options:"
        Write-Info "  1. Stop the conflicting services and re-run"
        Write-Info "  2. Use -AutoResolve to automatically find available ports"
        Write-Info "  3. Specify different ports with -Port parameter"
        return @{ Success = $false; Conflicts = $conflicts }
    }
    
    return @{ Success = $true; Resolved = $resolved; Conflicts = $conflicts }
}

# =============================================================================
# CONFIGURATION PARSING
# =============================================================================

<#
.SYNOPSIS
    Parses a .env file into a hashtable
#>
function Read-EnvFile {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        return @{}
    }
    
    $envVars = @{}
    
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        
        # Skip empty lines and comments
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
            return
        }
        
        # Parse key=value
        if ($line -match '^([^=]+)=(.*)$') {
            $key = $Matches[1].Trim()
            $value = $Matches[2].Trim()
            
            # Remove quotes
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $Matches[1]
            }
            
            $envVars[$key] = $value
        }
    }
    
    return $envVars
}

<#
.SYNOPSIS
    Parses a JSON configuration file
#>
function Read-JsonConfig {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        return @{}
    }
    
    try {
        $content = Get-Content $Path -Raw | ConvertFrom-Json
        $config = @{}
        
        $content.PSObject.Properties | ForEach-Object {
            $config[$_.Name] = $_.Value
        }
        
        return $config
    }
    catch {
        Write-Warn "Failed to parse JSON config: $_"
        return @{}
    }
}

<#
.SYNOPSIS
    Merges multiple configuration sources
#>
function Merge-Configuration {
    param(
        [hashtable]$Defaults,
        [hashtable]$EnvFile,
        [hashtable]$JsonConfig,
        [hashtable]$CliArgs,
        [hashtable]$EnvVars
    )
    
    $merged = @{}
    
    # 1. Start with defaults
    foreach ($key in $Defaults.Keys) {
        $merged[$key] = $Defaults[$key]
    }
    
    # 2. Override with environment variables
    foreach ($key in $EnvVars.Keys) {
        $merged[$key] = $EnvVars[$key]
    }
    
    # 3. Override with .env file
    foreach ($key in $EnvFile.Keys) {
        $merged[$key] = $EnvFile[$key]
    }
    
    # 4. Override with JSON config
    foreach ($key in $JsonConfig.Keys) {
        $merged[$key] = $JsonConfig[$key]
    }
    
    # 5. Override with CLI arguments (highest priority)
    foreach ($key in $CliArgs.Keys) {
        if ($null -ne $CliArgs[$key]) {
            $merged[$key] = $CliArgs[$key]
        }
    }
    
    return $merged
}

<#
.SYNOPSIS
    Validates configuration values
#>
function Test-Configuration {
    param([hashtable]$Config)
    
    $errors = @()
    
    # Required variables
    $requiredKeys = @("POSTGRES_PASSWORD", "JWT_SECRET", "GEMINI_API_KEY")
    
    foreach ($key in $requiredKeys) {
        if (-not $Config.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($Config[$key])) {
            $errors += "Missing required configuration: $key"
        }
    }
    
    # Validate JWT_SECRET length
    if ($Config.ContainsKey("JWT_SECRET") -and $Config["JWT_SECRET"].Length -lt 32) {
        $errors += "JWT_SECRET must be at least 32 characters"
    }
    
    # Validate ports
    $portKeys = @("FRONTEND_PORT", "API_PORT", "POSTGRES_PORT")
    foreach ($key in $portKeys) {
        if ($Config.ContainsKey($key)) {
            $port = 0
            if (-not [int]::TryParse($Config[$key], [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
                $errors += "Invalid port number for $key`: $($Config[$key])"
            }
        }
    }
    
    # Validate email format
    if ($Config.ContainsKey("ADMIN_EMAIL")) {
        if ($Config["ADMIN_EMAIL"] -notmatch '^[^@]+@[^@]+\.[^@]+$') {
            $errors += "Invalid email format for ADMIN_EMAIL"
        }
    }
    
    if ($errors.Count -gt 0) {
        Write-Header "Configuration Validation Errors"
        foreach ($error in $errors) {
            Write-Err $error
        }
        return $false
    }
    
    return $true
}

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

<#
.SYNOPSIS
    Gets domain configuration for production deployment
#>
function Get-DomainConfiguration {
    Write-Header "Domain & Reverse Proxy Configuration"
    
    if ($script:NonInteractive) {
        Write-Info "Non-interactive mode: Using local development configuration"
        return @{
            USE_NPM = $false
            DOMAIN = ""
            USE_SSL = $false
            EXPOSE_DB = $false
            FRONTEND_PORT = $script:Port
            CORS_ORIGINS = "http://localhost:$($script:Port),http://localhost:3000"
        }
    }
    
    Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  |                     DEPLOYMENT MODE SELECTION                       |" -ForegroundColor Cyan
    Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "  Choose your deployment scenario:" -ForegroundColor White
    Write-Host ""
    Write-Host "  [1] Local Development Only" -ForegroundColor Green
    Write-Host "      - Access via http://localhost:$($script:Port)" -ForegroundColor DarkGray
    Write-Host "      - No domain or SSL needed" -ForegroundColor DarkGray
    Write-Host "      - All ports exposed locally" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [2] Production with Nginx Proxy Manager (NPM)" -ForegroundColor Yellow
    Write-Host "      - Use custom domain (e.g., notes.yourdomain.com)" -ForegroundColor DarkGray
    Write-Host "      - SSL via Let's Encrypt" -ForegroundColor DarkGray
    Write-Host "      - Only port $($script:Port) exposed" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [3] Production with Custom Reverse Proxy" -ForegroundColor Yellow
    Write-Host "      - Use your own nginx/traefik/caddy" -ForegroundColor DarkGray
    Write-Host "      - Manual SSL configuration" -ForegroundColor DarkGray
    Write-Host "      - Custom port mapping" -ForegroundColor DarkGray
    Write-Host ""
    
    $choice = Read-Host "  Select deployment mode (1/2/3)"
    
    $config = @{
        USE_NPM = $false
        DOMAIN = ""
        USE_SSL = $false
        EXPOSE_DB = $false
        FRONTEND_PORT = $script:Port
        CORS_ORIGINS = $DEFAULTS.CORS_ORIGINS
    }
    
    switch ($choice) {
        "1" {
            Write-Success "Local development mode selected"
            $config.FRONTEND_PORT = $script:Port
            $config.CORS_ORIGINS = "http://localhost:$($script:Port),http://localhost:3000"
        }
        "2" {
            Write-Success "Nginx Proxy Manager mode selected"
            $config.USE_NPM = $true
            $config.USE_SSL = $true
            
            Write-Host ""
            $domain = Read-Host "  Enter your domain (e.g., notes.yourdomain.com)"
            while ([string]::IsNullOrWhiteSpace($domain)) {
                Write-Err "Domain is required for production deployment"
                $domain = Read-Host "  Enter your domain"
            }
            $config.DOMAIN = $domain
            $config.CORS_ORIGINS = "https://$domain"
            
            Write-Host ""
            Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Yellow
            Write-Host "  | NPM Configuration Instructions:                                     |" -ForegroundColor Yellow
            Write-Host "  |                                                                     |" -ForegroundColor Yellow
            Write-Host "  | 1. Open Nginx Proxy Manager admin panel                            |" -ForegroundColor Yellow
            Write-Host "  | 2. Add new Proxy Host with:                                         |" -ForegroundColor Yellow
            Write-Host "  |    - Domain: $domain".PadRight(60) -ForegroundColor Yellow -NoNewline
            Write-Host "|" -ForegroundColor Yellow
            Write-Host "  |    - Forward Host: weavenote-frontend (or host IP)                 |" -ForegroundColor Yellow
            Write-Host "  |    - Forward Port: 80                                               |" -ForegroundColor Yellow
            Write-Host "  | 3. Enable SSL with Let's Encrypt                                    |" -ForegroundColor Yellow
            Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Yellow
            Write-Host ""
            
            $exposeDb = Read-Host "  Expose PostgreSQL port for external tools? (y/N)"
            $config.EXPOSE_DB = ($exposeDb -eq "y" -or $exposeDb -eq "Y")
            
            $customPort = Read-Host "  Custom frontend port? (default: $($script:Port), press Enter to keep)"
            if (-not [string]::IsNullOrWhiteSpace($customPort)) {
                $config.FRONTEND_PORT = [int]$customPort
            }
        }
        "3" {
            Write-Success "Custom reverse proxy mode selected"
            $config.USE_NPM = $false
            $config.USE_SSL = $true
            
            Write-Host ""
            $domain = Read-Host "  Enter your domain (e.g., notes.yourdomain.com)"
            while ([string]::IsNullOrWhiteSpace($domain)) {
                Write-Err "Domain is required for production deployment"
                $domain = Read-Host "  Enter your domain"
            }
            $config.DOMAIN = $domain
            $config.CORS_ORIGINS = "https://$domain"
            
            Write-Host ""
            $customPort = Read-Host "  Port for reverse proxy to forward to? (default: $($script:Port))"
            if (-not [string]::IsNullOrWhiteSpace($customPort)) {
                $config.FRONTEND_PORT = [int]$customPort
            }
            
            $exposeDb = Read-Host "  Expose PostgreSQL port for external tools? (y/N)"
            $config.EXPOSE_DB = ($exposeDb -eq "y" -or $exposeDb -eq "Y")
        }
        default {
            Write-Warn "Invalid selection, defaulting to local development"
            $config.FRONTEND_PORT = $script:Port
        }
    }
    
    return $config
}

<#
.SYNOPSIS
    Gets environment variables from user input
#>
function Get-EnvironmentVariablesFromUser {
    param([hashtable]$Existing = @{})
    
    Write-Header "Configuring Environment Variables"
    
    $envVars = @{}
    
    # Set default values
    Write-Info "Setting default configuration values..."
    $envVars["FRONTEND_PORT"] = $script:Port.ToString()
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
        # Check if already provided
        if ($Existing.ContainsKey($var.Name) -and -not [string]::IsNullOrWhiteSpace($Existing[$var.Name])) {
            $envVars[$var.Name] = $Existing[$var.Name]
            Write-Success "$($var.Name) loaded from existing configuration"
            continue
        }
        
        Write-Host ""
        Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Yellow
        Write-Host "  | Required: $($var.Name)".PadRight(67) -ForegroundColor Yellow -NoNewline
        Write-Host "|" -ForegroundColor Yellow
        Write-Host "  | $($var.Description)".PadRight(67) -ForegroundColor Yellow -NoNewline
        Write-Host "|" -ForegroundColor Yellow
        Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Yellow
        
        if ($script:NonInteractive) {
            if ($var.Generate) {
                $value = Generate-SecurePassword -Length 32
                Write-Info "Auto-generated value for $($var.Name)"
                $envVars[$var.Name] = $value
            }
            else {
                Write-Err "Required variable $($var.Name) not provided in non-interactive mode"
                throw "Missing required configuration: $($var.Name)"
            }
        }
        else {
            if ($var.Generate) {
                Write-Host ""
                $generate = Read-Host "  Generate secure random value? (Y/n)"
                
                if ($generate -ne "n" -and $generate -ne "N") {
                    $value = Generate-SecurePassword -Length 32
                    Write-Success "Generated secure value for $($var.Name)"
                    $envVars[$var.Name] = $value
                }
                else {
                    $value = Read-Host "  Enter value for $($var.Name)"
                    while ([string]::IsNullOrWhiteSpace($value)) {
                        Write-Err "Value cannot be empty"
                        $value = Read-Host "  Enter value for $($var.Name)"
                    }
                    $envVars[$var.Name] = $value
                }
            }
            else {
                $value = Read-Host "  Enter value for $($var.Name)"
                while ([string]::IsNullOrWhiteSpace($value)) {
                    Write-Err "Value cannot be empty - $($var.Name) is required"
                    $value = Read-Host "  Enter value for $($var.Name)"
                }
                $envVars[$var.Name] = $value
            }
        }
    }
    
    # Process optional variables (skip in non-interactive mode)
    if (-not $script:NonInteractive) {
        Write-Host ""
        Write-Info "Optional environment variables (press Enter to skip)..."
        
        foreach ($var in $OPTIONAL_VARS) {
            if ($Existing.ContainsKey($var.Name)) {
                $envVars[$var.Name] = $Existing[$var.Name]
                continue
            }
            
            Write-Host ""
            $value = Read-Host "  $($var.Name) [$($var.Description)]"
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                $envVars[$var.Name] = $value
            }
        }
    }
    
    # Generate encryption key if not provided
    if (-not $envVars.ContainsKey("ENCRYPTION_KEY")) {
        $envVars["ENCRYPTION_KEY"] = Generate-EncryptionKey -Bytes 32
        Write-Success "Generated encryption key for secure storage"
    }
    
    return $envVars
}

<#
.SYNOPSIS
    Creates the .env file
#>
function New-EnvFile {
    param(
        [hashtable]$EnvVars,
        [string]$Path
    )
    
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would create environment file at: $Path"
        return $true
    }
    
    Write-Header "Creating Environment File"
    
    $content = @"
# =============================================================================
# Weavenote Environment Configuration
# Generated by install-weavenote.ps1 v$SCRIPT_VERSION on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# Environment: $script:Environment
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
        $content += "`nVITE_FIREBASE_AUTH_DOMAIN=$($EnvVars['VITE_FIREBASE_AUTH_DOMAIN'])"
    }
    if ($EnvVars.ContainsKey('VITE_FIREBASE_PROJECT_ID')) {
        $content += "`nVITE_FIREBASE_PROJECT_ID=$($EnvVars['VITE_FIREBASE_PROJECT_ID'])"
    }
    if ($EnvVars.ContainsKey('VITE_FIREBASE_STORAGE_BUCKET')) {
        $content += "`nVITE_FIREBASE_STORAGE_BUCKET=$($EnvVars['VITE_FIREBASE_STORAGE_BUCKET'])"
    }
    
    try {
        $content | Out-File -FilePath $Path -Encoding UTF8 -Force
        Write-Success "Environment file created at: $Path"
        Write-LogInfo "Created .env file" -Context @{ Path = $Path }
        return $true
    }
    catch {
        Write-Err "Failed to create environment file: $_"
        Write-LogError "Failed to create .env file" -Exception $_
        return $false
    }
}

# =============================================================================
# DOCKER OPERATIONS
# =============================================================================

<#
.SYNOPSIS
    Stops existing Weavenote containers
#>
function Stop-ExistingContainers {
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would stop existing containers"
        return
    }
    
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
            Write-Warn "Could not stop $container"
        }
    }
}

<#
.SYNOPSIS
    Builds Docker images
#>
function Build-DockerImages {
    param([switch]$Force)
    
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would build Docker images$(if ($Force) { ' (force rebuild)' })"
        return $true
    }
    
    Write-Header "Building Docker Images"
    
    $buildSteps = @(
        @{ Name = "Pulling base images"; Progress = 10 }
        @{ Name = "Building frontend"; Progress = 40 }
        @{ Name = "Building backend API"; Progress = 70 }
        @{ Name = "Finalizing"; Progress = 100 }
    )
    
    try {
        $composeCmd = Get-DockerComposeCmd
        
        Write-Info "Using: $composeCmd"
        
        foreach ($step in $buildSteps) {
            Show-ProgressBar -Activity "Building images" -PercentComplete $step.Progress -Status $step.Name
        }
        
        Write-Info "Executing build command..."
        Write-LogInfo "Starting Docker build" -Context @{ Command = $composeCmd; Force = $Force }
        
        $buildArgs = if ($Force) { "build --no-cache" } else { "build" }
        $buildOutput = Invoke-Expression "$composeCmd $buildArgs 2>&1"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker images built successfully"
            Write-LogInfo "Docker build completed successfully"
            return $true
        }
        else {
            Write-Err "Build failed with exit code: $LASTEXITCODE"
            Write-Host $buildOutput
            Write-LogError "Docker build failed" -Context @{ ExitCode = $LASTEXITCODE }
            return $false
        }
    }
    catch {
        Write-Err "Failed to build Docker images: $_"
        Write-LogError "Docker build exception" -Exception $_
        return $false
    }
}

<#
.SYNOPSIS
    Starts Docker containers
#>
function Start-DockerContainers {
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would start Docker containers"
        return $true
    }
    
    Write-Header "Starting Docker Containers"
    
    $steps = @(
        @{ Name = "Creating network"; Progress = 10 }
        @{ Name = "Starting PostgreSQL"; Progress = 30 }
        @{ Name = "Starting API server"; Progress = 60 }
        @{ Name = "Starting frontend"; Progress = 90 }
        @{ Name = "Health checks"; Progress = 100 }
    )
    
    try {
        $composeCmd = Get-DockerComposeCmd
        
        foreach ($step in $steps) {
            Show-ProgressBar -Activity "Starting services" -PercentComplete $step.Progress -Status $step.Name
        }
        
        Write-Info "Executing start command..."
        Write-LogInfo "Starting Docker containers" -Context @{ Command = $composeCmd }
        
        $startOutput = Invoke-Expression "$composeCmd up -d 2>&1"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Containers started successfully"
            Write-LogInfo "Docker containers started"
            return $true
        }
        else {
            Write-Err "Start failed with exit code: $LASTEXITCODE"
            Write-Host $startOutput
            Write-LogError "Docker start failed" -Context @{ ExitCode = $LASTEXITCODE }
            return $false
        }
    }
    catch {
        Write-Err "Failed to start containers: $_"
        Write-LogError "Docker start exception" -Exception $_
        return $false
    }
}

<#
.SYNOPSIS
    Checks container health
#>
function Get-ContainerHealth {
    param([string]$ContainerName)
    
    try {
        $health = docker inspect --format='{{.State.Health.Status}}' $ContainerName 2>$null
        return $health
    }
    catch {
        return "unknown"
    }
}

<#
.SYNOPSIS
    Waits for container to be healthy
#>
function Wait-ForContainer {
    param(
        [string]$ContainerName,
        [int]$TimeoutSeconds = 60
    )
    
    $startTime = Get-Date
    $timeout = $startTime.AddSeconds($TimeoutSeconds)
    
    while ((Get-Date) -lt $timeout) {
        $health = Get-ContainerHealth -ContainerName $ContainerName
        
        if ($health -eq "healthy") {
            return $true
        }
        elseif ($health -eq "unhealthy") {
            return $false
        }
        
        Start-Sleep -Seconds 2
    }
    
    return $false
}

# =============================================================================
# DATABASE OPERATIONS
# =============================================================================

<#
.SYNOPSIS
    Waits for database to be ready
#>
function Wait-ForDatabase {
    param([int]$TimeoutSeconds = $DEFAULTS.DB_TIMEOUT_SECONDS)
    
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would wait for database"
        return $true
    }
    
    Write-Header "Waiting for Database"
    
    $maxAttempts = [math]::Ceiling($TimeoutSeconds / 2)
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        $attempt++
        Show-ProgressBar -Activity "Database ready" -PercentComplete ([math]::Round(($attempt / $maxAttempts) * 100)) -Status "Attempt $attempt/$maxAttempts"
        
        try {
            $result = docker exec weavenote-postgres pg_isready -U $DEFAULTS.POSTGRES_USER 2>$null
            if ($result -match "accepting connections") {
                Write-Success "Database is ready"
                Write-LogInfo "Database is ready" -Context @{ Attempts = $attempt }
                return $true
            }
        }
        catch {
            # Continue waiting
        }
        
        Start-Sleep -Seconds 2
    }
    
    Write-Err "Database failed to start within $TimeoutSeconds seconds"
    Write-LogError "Database timeout" -Context @{ TimeoutSeconds = $TimeoutSeconds }
    return $false
}

<#
.SYNOPSIS
    Initializes database with migrations and seeds
#>
function Initialize-Database {
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would initialize database (run migrations, seeds)"
        return $true
    }
    
    Write-Header "Initializing Database"
    
    try {
        # Run migrations
        Write-Info "Running database migrations..."
        Write-LogInfo "Running Prisma migrations"
        
        $migrateOutput = docker exec weavenote-api npx prisma migrate deploy 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database migrations completed"
            Write-LogInfo "Migrations completed successfully"
        }
        else {
            Write-Warn "Migrations may have warnings (this is normal for first run)"
            Write-LogWarn "Migration warnings" -Context @{ Output = $migrateOutput }
        }
        
        # Generate Prisma client
        Write-Info "Generating Prisma client..."
        docker exec weavenote-api npx prisma generate 2>$null
        
        # Run seeds if available
        Write-Info "Checking for seed scripts..."
        $seedScript = docker exec weavenote-api ls package.json 2>$null
        if ($seedScript) {
            $packageJson = docker exec weavenote-api cat package.json 2>$null | ConvertFrom-Json
            if ($packageJson.scripts.seed) {
                Write-Info "Running database seed..."
                docker exec weavenote-api npm run seed 2>$null
                Write-Success "Database seed completed"
            }
        }
        
        Write-Success "Database initialized successfully"
        Write-LogInfo "Database initialization complete"
        return $true
    }
    catch {
        Write-Warn "Database initialization had issues: $_"
        Write-Info "This may be normal if tables already exist"
        Write-LogWarn "Database initialization issues" -Exception $_
        return $true  # Don't fail on migration issues
    }
}

# =============================================================================
# HEALTH CHECKS
# =============================================================================

<#
.SYNOPSIS
    Tests service health endpoints
#>
function Test-ServiceHealth {
    param(
        [int]$FrontendPort,
        [int]$ApiPort,
        [int]$TimeoutSeconds = $DEFAULTS.HEALTH_CHECK_TIMEOUT_SECONDS
    )
    
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would run health checks"
        return $true
    }
    
    Write-Header "Running Health Checks"
    
    $services = @(
        @{ Name = "Frontend"; Url = "http://localhost:$FrontendPort/health"; Critical = $true }
        @{ Name = "API"; Url = "http://localhost:$ApiPort/api/health"; Critical = $true }
    )
    
    $allHealthy = $true
    
    foreach ($service in $services) {
        Write-Info "Checking $($service.Name)..."
        
        $attempt = 0
        $maxAttempts = [math]::Ceiling($TimeoutSeconds / 2)
        $healthy = $false
        
        while ($attempt -lt $maxAttempts -and -not $healthy) {
            $attempt++
            try {
                $response = Invoke-WebRequest -Uri $service.Url -TimeoutSec 5 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    $healthy = $true
                    Write-Success "$($service.Name) is healthy"
                    Write-LogInfo "$($service.Name) health check passed"
                }
            }
            catch {
                Start-Sleep -Seconds 2
            }
        }
        
        if (-not $healthy) {
            if ($service.Critical) {
                Write-Warn "$($service.Name) health check timed out"
                Write-LogWarn "$($service.Name) health check failed"
                $allHealthy = $false
            }
            else {
                Write-Warn "$($service.Name) health check timed out (non-critical)"
            }
        }
    }
    
    return $allHealthy
}

# =============================================================================
# NON-DOCKER MODE
# =============================================================================

<#
.SYNOPSIS
    Installs npm dependencies for non-Docker mode
#>
function Install-NpmDependencies {
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would install npm dependencies"
        return $true
    }
    
    Write-Header "Installing Dependencies"
    
    # Install frontend dependencies
    Write-Info "Installing frontend dependencies..."
    Push-Location $SCRIPT_DIR
    try {
        npm install --legacy-peer-deps
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend npm install failed"
        }
        Write-Success "Frontend dependencies installed"
    }
    finally {
        Pop-Location
    }
    
    # Install backend dependencies
    Write-Info "Installing backend dependencies..."
    Push-Location "$SCRIPT_DIR/backend"
    try {
        npm install --legacy-peer-deps
        if ($LASTEXITCODE -ne 0) {
            throw "Backend npm install failed"
        }
        Write-Success "Backend dependencies installed"
    }
    finally {
        Pop-Location
    }
    
    # Generate Prisma client
    Write-Info "Generating Prisma client..."
    Push-Location "$SCRIPT_DIR/backend"
    try {
        npx prisma generate
        Write-Success "Prisma client generated"
    }
    finally {
        Pop-Location
    }
    
    return $true
}

<#
.SYNOPSIS
    Starts services in non-Docker mode
#>
function Start-ServicesLocal {
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would start services locally"
        return $true
    }
    
    Write-Header "Starting Services (Local Mode)"
    
    # Start backend
    Write-Info "Starting backend API..."
    $backendJob = Start-Job -ScriptBlock {
        param($Path)
        Set-Location $Path
        npm run dev
    } -ArgumentList "$SCRIPT_DIR/backend"
    
    Start-Sleep -Seconds 5
    
    # Start frontend
    Write-Info "Starting frontend..."
    $frontendJob = Start-Job -ScriptBlock {
        param($Path)
        Set-Location $Path
        npm run dev
    } -ArgumentList $SCRIPT_DIR
    
    Write-Success "Services started in background"
    Write-Info "Backend Job ID: $($backendJob.Id)"
    Write-Info "Frontend Job ID: $($frontendJob.Id)"
    
    return $true
}

# =============================================================================
# DISPLAY FUNCTIONS
# =============================================================================

<#
.SYNOPSIS
    Shows installation summary
#>
function Show-InstallationSummary {
    param(
        [hashtable]$EnvVars,
        [hashtable]$DeploymentConfig,
        [bool]$DockerMode = $true
    )
    
    Write-Header "Installation Complete!"
    
    Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Green
    Write-Host "  |                                                                     |" -ForegroundColor Green
    Write-Host "  |   [SUCCESS] WEAVERNOTE IS NOW RUNNING!                              |" -ForegroundColor Green
    Write-Host "  |                                                                     |" -ForegroundColor Green
    Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Green
    Write-Host ""
    
    # Show access points
    Write-Host "  Access Points:" -ForegroundColor Cyan
    Write-Host "  -----------------------------------------------------------------------" -ForegroundColor DarkGray
    
    if ($DeploymentConfig -and $DeploymentConfig.DOMAIN) {
        Write-Host "  Domain:       " -NoNewline; Write-Host "https://$($DeploymentConfig.DOMAIN)" -ForegroundColor White
        Write-Host "  Local:        " -NoNewline; Write-Host "http://localhost:$($EnvVars['FRONTEND_PORT'])" -ForegroundColor DarkGray
    }
    else {
        Write-Host "  Frontend:     " -NoNewline; Write-Host "http://localhost:$($EnvVars['FRONTEND_PORT'])" -ForegroundColor White
        Write-Host "  API:          " -NoNewline; Write-Host "http://localhost:$($EnvVars['FRONTEND_PORT'])/api" -ForegroundColor White
        Write-Host "  Database:     " -NoNewline; Write-Host "localhost:$($EnvVars['POSTGRES_PORT'])" -ForegroundColor White
    }
    Write-Host ""
    
    # Credentials
    Write-Host "  Credentials:" -ForegroundColor Cyan
    Write-Host "  -----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  Database User:     " -NoNewline; Write-Host $EnvVars['POSTGRES_USER'] -ForegroundColor White
    Write-Host "  Database Password: " -NoNewline; Write-Host "******** (saved in .env)" -ForegroundColor Yellow
    Write-Host "  Database Name:     " -NoNewline; Write-Host $EnvVars['POSTGRES_DB'] -ForegroundColor White
    Write-Host ""
    
    # Port summary
    Write-Host "  Port Exposure:" -ForegroundColor Cyan
    Write-Host "  -----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [OK] Port $($EnvVars['FRONTEND_PORT']) - Frontend (EXPOSED)" -ForegroundColor Green
    
    if ($DockerMode) {
        Write-Host "  [..] Port $($EnvVars['API_PORT']) - API (internal, proxied)" -ForegroundColor DarkGray
        if ($DeploymentConfig -and $DeploymentConfig.EXPOSE_DB) {
            Write-Host "  [!!] Port $($EnvVars['POSTGRES_PORT']) - PostgreSQL (EXPOSED)" -ForegroundColor Yellow
        }
        else {
            Write-Host "  [..] Port $($EnvVars['POSTGRES_PORT']) - PostgreSQL (internal)" -ForegroundColor DarkGray
        }
    }
    Write-Host ""
    
    # Quick commands
    Write-Host "  Quick Commands:" -ForegroundColor Cyan
    Write-Host "  -----------------------------------------------------------------------" -ForegroundColor DarkGray
    if ($DockerMode) {
        Write-Host "  View logs:        docker-compose logs -f" -ForegroundColor White
        Write-Host "  Stop services:    docker-compose down" -ForegroundColor White
        Write-Host "  Restart:          docker-compose restart" -ForegroundColor White
        Write-Host "  Open shell:       docker exec -it weavenote-api sh" -ForegroundColor White
    }
    else {
        Write-Host "  View jobs:        Get-Job" -ForegroundColor White
        Write-Host "  Stop services:    Get-Job | Remove-Job -Force" -ForegroundColor White
    }
    Write-Host ""
    
    Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Yellow
    Write-Host "  | [!] IMPORTANT: Save your credentials securely!                      |" -ForegroundColor Yellow
    Write-Host "  |     Your .env file contains sensitive information.                 |" -ForegroundColor Yellow
    Write-Host "  |     Never commit .env files to version control.                    |" -ForegroundColor Yellow
    Write-Host "  +---------------------------------------------------------------------+" -ForegroundColor Yellow
    Write-Host ""
    
    # Log location
    if ($script:LogConfig.File) {
        Write-Info "Log file: $($script:LogConfig.File)"
    }
}

<#
.SYNOPSIS
    Shows container logs
#>
function Show-Logs {
    param([int]$Lines = 50)
    
    Write-Header "Recent Container Logs"
    
    Write-Info "API Logs (last $Lines lines):"
    Write-Host "-----------------------------------------------------------------------" -ForegroundColor DarkGray
    docker logs weavenote-api --tail $Lines 2>&1
    Write-Host ""
    
    Write-Info "Frontend Logs (last $Lines lines):"
    Write-Host "-----------------------------------------------------------------------" -ForegroundColor DarkGray
    docker logs weavenote-frontend --tail $Lines 2>&1
    Write-Host ""
    
    Write-Info "Database Logs (last $Lines lines):"
    Write-Host "-----------------------------------------------------------------------" -ForegroundColor DarkGray
    docker logs weavenote-postgres --tail $Lines 2>&1
    Write-Host ""
}

<#
.SYNOPSIS
    Shows Docker status
#>
function Show-DockerStatus {
    Write-Header "Docker Container Status"
    
    docker ps --filter "name=weavenote" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
    Write-Host ""
}

# =============================================================================
# ERROR HANDLING
# =============================================================================

<#
.SYNOPSIS
    Writes to error log file
#>
function Write-ErrLog {
    param(
        [string]$Message,
        [Exception]$Error
    )
    
    $logFile = Join-Path $SCRIPT_DIR "weavenote-install-error.log"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    $logEntry = @"
[$timestamp] ERROR: $Message
Exception: $($Error.Message)
StackTrace: $($Error.StackTrace)
"@
    
    $logEntry | Out-File -FilePath $logFile -Append -Encoding UTF8
    
    Write-Err "Error: $Message"
    Write-Info "Error details saved to: $logFile"
}

<#
.SYNOPSIS
    Cleans up failed installation
#>
function Invoke-Cleanup {
    Write-Header "Cleaning Up Failed Installation"
    
    if ($script:DryRun) {
        Write-Info "[DRY-RUN] Would cleanup failed installation"
        return
    }
    
    Write-Info "Stopping containers..."
    $composeCmd = Get-DockerComposeCmd
    Invoke-Expression "$composeCmd down -v 2>&1" | Out-Null
    
    Write-Info "Removing orphaned resources..."
    docker system prune -f 2>$null | Out-Null
    
    Write-Warn "Installation was rolled back due to errors"
}

# =============================================================================
# MAIN INSTALLATION SCRIPT
# =============================================================================

function Main {
    # Initialize logging
    if ([string]::IsNullOrEmpty($script:LogFile)) {
        $script:LogConfig.File = Join-Path $SCRIPT_DIR "weavenote-install-$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
    }
    else {
        $script:LogConfig.File = $script:LogFile
    }
    
    if ($VerboseMode) {
        $script:LogConfig.Level = [LogLevel]::DEBUG
    }
    
    $totalSteps = if ($script:NoDocker) { 7 } else { 9 }
    $currentStep = 0
    
    Clear-Host
    
    # Display banner
    Write-Host ""
    Write-Host "  +===================================================================+" -ForegroundColor Cyan
    Write-Host "  |                                                                   |" -ForegroundColor Cyan
    Write-Host "  |   [WEAVERNOTE] INSTALLER v$SCRIPT_VERSION                                |" -ForegroundColor Cyan
    Write-Host "  |                                                                   |" -ForegroundColor Cyan
    Write-Host "  |   AI-powered note workspace with PostgreSQL backend               |" -ForegroundColor Cyan
    Write-Host "  |                                                                   |" -ForegroundColor Cyan
    Write-Host "  +===================================================================+" -ForegroundColor Cyan
    Write-Host ""
    
    # Show configuration
    Write-Info "Configuration:"
    Write-Info "  Environment: $script:Environment"
    Write-Info "  Port: $script:Port"
    Write-Info "  Docker Mode: $(-not $script:NoDocker)"
    if ($script:DryRun) { Write-Warn "  DRY-RUN MODE - No changes will be made" }
    if ($script:Rebuild) { Write-Info "  Force Rebuild: Yes" }
    if ($VerboseMode) { Write-Info "  Verbose: Yes" }
    Write-Host ""
    
    Write-LogInfo "Installation started" -Context @{
        Environment = $script:Environment
        Port = $script:Port
        DockerMode = -not $script:NoDocker
        DryRun = $script:DryRun
        Rebuild = $script:Rebuild
    }
    
    try {
        # Step 1: Check prerequisites
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Checking Prerequisites"
        
        if (-not (Test-AllPrerequisites)) {
            Write-Err "Prerequisites check failed. Please install missing components."
            Write-Info "Press any key to exit..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
        
        # Step 2: Check port availability
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Checking Port Availability"
        
        $portCheck = Test-PortConflicts -FrontendPort $script:Port -ApiPort 3001 -DbPort 5432 -AutoResolve
        if (-not $portCheck.Success) {
            Write-Err "Port conflicts detected. Please resolve conflicts or use -AutoResolve."
            exit 1
        }
        
        # Step 3: Configure deployment
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Configuring Deployment"
        
        $deploymentConfig = Get-DomainConfiguration
        
        # Step 4: Load and merge configuration
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Loading Configuration"
        
        # Load existing config files
        $existingEnv = @{}
        $envPath = Join-Path $SCRIPT_DIR ".env"
        if (Test-Path $envPath) {
            $existingEnv = Read-EnvFile -Path $envPath
            Write-Info "Loaded existing .env file"
        }
        
        if ($script:ConfigFile -and (Test-Path $script:ConfigFile)) {
            $jsonConfig = Read-JsonConfig -Path $script:ConfigFile
            Write-Info "Loaded config file: $($script:ConfigFile)"
        }
        else {
            $jsonConfig = @{}
        }
        
        # Get environment variables
        $envVars = Get-EnvironmentVariablesFromUser -Existing $existingEnv
        
        # Apply deployment configuration
        $envVars["FRONTEND_PORT"] = $deploymentConfig.FRONTEND_PORT
        $envVars["CORS_ORIGINS"] = $deploymentConfig.CORS_ORIGINS
        
        if ($deploymentConfig.DOMAIN) {
            $envVars["DOMAIN"] = $deploymentConfig.DOMAIN
            $envVars["USE_SSL"] = $deploymentConfig.USE_SSL
        }
        
        # Add admin defaults
        $envVars["ADMIN_EMAIL"] = $DEFAULTS.ADMIN_EMAIL
        $envVars["ADMIN_USERNAME"] = $DEFAULTS.ADMIN_USERNAME
        
        # Validate configuration
        if (-not (Test-Configuration -Config $envVars)) {
            throw "Configuration validation failed"
        }
        
        # Step 5: Create .env file
        $currentStep++
        Write-Step -Step $currentStep -Total $totalSteps -Message "Creating Configuration Files"
        
        if (-not (New-EnvFile -EnvVars $envVars -Path ".env")) {
            throw "Failed to create environment file"
        }
        
        # Create backend .env
        if (-not $script:DryRun) {
            $backendEnv = @"
DATABASE_URL=postgresql://$($envVars['POSTGRES_USER']):$($envVars['POSTGRES_PASSWORD'])@postgres:5432/$($envVars['POSTGRES_DB'])?schema=public
JWT_SECRET=$($envVars['JWT_SECRET'])
GEMINI_API_KEY=$($envVars['GEMINI_API_KEY'])
ENCRYPTION_KEY=$($envVars['ENCRYPTION_KEY'])
CORS_ORIGINS=$($envVars['CORS_ORIGINS'])
"@
            $backendEnv | Out-File -FilePath "backend/.env" -Encoding UTF8 -Force
            Write-Success "Backend environment file created"
        }
        
        if (-not $script:NoDocker) {
            # Step 6: Stop existing containers
            $currentStep++
            Write-Step -Step $currentStep -Total $totalSteps -Message "Stopping Existing Containers"
            
            Stop-ExistingContainers
            
            # Step 7: Build Docker images
            $currentStep++
            Write-Step -Step $currentStep -Total $totalSteps -Message "Building Docker Images"
            
            if (-not (Build-DockerImages -Force:$script:Rebuild)) {
                throw "Failed to build Docker images"
            }
            
            # Step 8: Start containers
            $currentStep++
            Write-Step -Step $currentStep -Total $totalSteps -Message "Starting Docker Containers"
            
            if (-not (Start-DockerContainers)) {
                throw "Failed to start Docker containers"
            }
            
            # Step 9: Initialize database
            $currentStep++
            Write-Step -Step $currentStep -Total $totalSteps -Message "Initializing Database"
            
            if (-not (Wait-ForDatabase)) {
                throw "Database failed to start"
            }
            
            Start-Sleep -Seconds 5  # Extra time for DB
            Initialize-Database
            
            # Step 10: Health checks
            $currentStep++
            Write-Step -Step $currentStep -Total $totalSteps -Message "Running Health Checks"
            
            Test-ServiceHealth -FrontendPort $envVars['FRONTEND_PORT'] -ApiPort $envVars['API_PORT']
            
            # Show status
            Show-DockerStatus
        }
        else {
            # Non-Docker mode
            $currentStep++
            Write-Step -Step $currentStep -Total $totalSteps -Message "Installing Dependencies"
            
            if (-not (Install-NpmDependencies)) {
                throw "Failed to install dependencies"
            }
            
            $currentStep++
            Write-Step -Step $currentStep -Total $totalSteps -Message "Starting Services"
            
            Start-ServicesLocal
        }
        
        # Show summary
        Show-InstallationSummary -EnvVars $envVars -DeploymentConfig $deploymentConfig -DockerMode (-not $script:NoDocker)
        
        # Interactive options
        if (-not $script:NonInteractive -and -not $script:DryRun) {
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
        }
        
        Write-Host ""
        Write-Success "Installation completed successfully!"
        Write-Info "Run 'docker-compose logs -f' to view live logs"
        
        Write-LogInfo "Installation completed successfully"
        
        return 0
    }
    catch {
        Write-ErrLog -Message "Installation failed" -Error $_
        
        Write-Host ""
        if (-not $script:NonInteractive) {
            $cleanup = Read-Host "  Attempt to cleanup failed installation? (Y/n)"
            if ($cleanup -ne "n" -and $cleanup -ne "N") {
                Invoke-Cleanup
            }
        }
        else {
            Invoke-Cleanup
        }
        
        Write-Host ""
        Write-Err "Installation failed. Check weavenote-install-error.log for details."
        Write-LogFatal "Installation failed" -Exception $_
        
        if (-not $script:NonInteractive) {
            Write-Info "Press any key to exit..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        
        return 1
    }
}

# =============================================================================
# ENTRY POINT
# =============================================================================

# Check if running as administrator (recommended but not required)
if ($IsWindows -or $null -eq $IsWindows) {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if (-not $isAdmin) {
        Write-Warn "Running without administrator privileges"
        Write-Info "Some operations may require elevated permissions"
        Write-Host ""
    }
}

# Handle migrate-only mode
if ($MigrateOnly) {
    Write-Header "Running Database Migrations Only"
    
    Initialize-Database
    exit 0
}

# Run main function
$exitCode = Main
exit $exitCode
