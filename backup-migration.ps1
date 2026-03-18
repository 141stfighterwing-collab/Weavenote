<#
.SYNOPSIS
    WeaveNote Backup & Migration Tool
.DESCRIPTION
    This script handles database backups and migrations from cloud services
    (Firebase, Supabase) to your local WeaveNote PostgreSQL instance.
.NOTES
    File Name      : backup-migration.ps1
    Author         : Weavenote Team
    Prerequisite   : Docker Desktop must be installed and running
    Version        : 1.0.0
#>

# =============================================================================
# CONFIGURATION
# =============================================================================
$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

$SCRIPT_VERSION = "1.0.0"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# Colors for output
$COLORS = @{
    Header = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "White"
    Progress = "DarkCyan"
}

# Default paths
$BACKUP_DIR = Join-Path $SCRIPT_DIR "backups"
$TEMP_DIR = Join-Path $SCRIPT_DIR "temp-migration"

# Minimum disk space required (in GB)
$MIN_DISK_SPACE_GB = 5

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
# PRE-FLIGHT CHECKS
# =============================================================================

function Test-DatabaseRunning {
    Write-Header "Checking Database Status"
    
    # Check if Docker is running
    Write-Info "Checking Docker status..."
    if (-not (Test-Command "docker")) {
        Write-Error "Docker is not installed or not in PATH"
        return $false
    }
    
    try {
        $dockerVersion = docker version --format "{{.Server.Version}}" 2>$null
        if (-not $dockerVersion) {
            Write-Error "Docker daemon is not running"
            Write-Info "Please start Docker Desktop and try again"
            return $false
        }
        Write-Success "Docker is running (Version: $dockerVersion)"
    }
    catch {
        Write-Error "Docker daemon is not running"
        return $false
    }
    
    # Check if weavenote containers are running
    Write-Info "Checking WeaveNote containers..."
    
    $containers = @("weavenote-postgres", "weavenote-api", "weavenote-frontend")
    $allRunning = $true
    
    foreach ($container in $containers) {
        $status = docker ps --filter "name=$container" --format "{{.Status}}" 2>$null
        if ($status) {
            Write-Success "$container is running ($status)"
        }
        else {
            $exists = docker ps -a --filter "name=$container" --format "{{.Names}}" 2>$null
            if ($exists) {
                Write-Warning "$container exists but is not running"
            }
            else {
                Write-Warning "$container does not exist"
            }
            $allRunning = $false
        }
    }
    
    if (-not $allRunning) {
        Write-Host ""
        Write-Info "Some containers are not running. Starting them..."
        
        # Try to start containers
        $composeCmd = "docker-compose"
        if (-not (Test-Command "docker-compose")) {
            $composeCmd = "docker compose"
        }
        
        try {
            Invoke-Expression "$composeCmd up -d 2>&1" | Out-Null
            Start-Sleep -Seconds 10
            
            # Re-check
            $postgresStatus = docker ps --filter "name=weavenote-postgres" --format "{{.Status}}" 2>$null
            if ($postgresStatus) {
                Write-Success "Containers started successfully"
                return $true
            }
            else {
                Write-Error "Failed to start containers"
                return $false
            }
        }
        catch {
            Write-Error "Failed to start containers: $_"
            return $false
        }
    }
    
    # Test database connectivity
    Write-Info "Testing database connectivity..."
    try {
        $result = docker exec weavenote-postgres pg_isready -U weavenote 2>$null
        if ($result -match "accepting connections") {
            Write-Success "Database is accepting connections"
            return $true
        }
        else {
            Write-Error "Database is not accepting connections"
            return $false
        }
    }
    catch {
        Write-Error "Failed to connect to database: $_"
        return $false
    }
}

function Test-DiskSpace {
    param([double]$RequiredGB = $MIN_DISK_SPACE_GB)
    
    Write-Header "Checking Disk Space"
    
    # Get the drive where the script is located
    $drive = (Get-Item $SCRIPT_DIR).PSDrive
    
    $freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
    $totalSpaceGB = [math]::Round($drive.Used / 1GB + $freeSpaceGB, 2)
    $usedPercent = [math]::Round(($drive.Used / ($drive.Used + $drive.Free)) * 100, 1)
    
    Write-Info "Drive: $($drive.Name):\"
    Write-Info "Total Space: $totalSpaceGB GB"
    Write-Info "Free Space: $freeSpaceGB GB"
    Write-Info "Used: $usedPercent%"
    Write-Host ""
    
    if ($freeSpaceGB -lt $RequiredGB) {
        Write-Error "Insufficient disk space. Required: $RequiredGB GB, Available: $freeSpaceGB GB"
        
        # Offer cleanup suggestions
        Write-Host ""
        Write-Warning "Suggestions to free up space:"
        Write-Host "  1. Run: docker system prune -a  (cleans unused Docker resources)"
        Write-Host "  2. Remove old backups from: $BACKUP_DIR"
        Write-Host "  3. Clean temporary files from: $TEMP_DIR"
        
        $cleanup = Read-Host "  Run Docker cleanup? (y/N)"
        if ($cleanup -eq "y" -or $cleanup -eq "Y") {
            Write-Info "Running Docker cleanup..."
            docker system prune -f 2>$null
            Write-Success "Docker cleanup completed"
            
            # Re-check
            $drive = (Get-Item $SCRIPT_DIR).PSDrive
            $freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
            
            if ($freeSpaceGB -ge $RequiredGB) {
                Write-Success "Sufficient disk space now available: $freeSpaceGB GB"
                return $true
            }
            else {
                return $false
            }
        }
        
        return $false
    }
    
    Write-Success "Sufficient disk space available: $freeSpaceGB GB"
    return $true
}

function Initialize-Directories {
    Write-Header "Initializing Directories"
    
    # Create backup directory
    if (-not (Test-Path $BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
        Write-Success "Created backup directory: $BACKUP_DIR"
    }
    else {
        Write-Success "Backup directory exists: $BACKUP_DIR"
    }
    
    # Create temp directory
    if (-not (Test-Path $TEMP_DIR)) {
        New-Item -ItemType Directory -Path $TEMP_DIR -Force | Out-Null
        Write-Success "Created temp directory: $TEMP_DIR"
    }
    else {
        Write-Success "Temp directory exists: $TEMP_DIR"
    }
    
    return $true
}

# =============================================================================
# BACKUP FUNCTIONS
# =============================================================================

function New-LocalBackup {
    Write-Header "Creating Local Database Backup"
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $BACKUP_DIR "weavenote_backup_$timestamp.sql"
    $backupDir = Join-Path $BACKUP_DIR "weavenote_backup_$timestamp"
    
    Write-Info "Backup location: $backupFile"
    
    # Create SQL dump
    Write-Info "Creating SQL dump..."
    try {
        $result = docker exec weavenote-postgres pg_dump -U weavenote -d weavenote --format=plain --no-owner --no-acl 2>&1
        $result | Out-File -FilePath $backupFile -Encoding UTF8
        Write-Success "SQL dump created: $backupFile"
    }
    catch {
        Write-Error "Failed to create SQL dump: $_"
        return $false
    }
    
    # Create custom format dump (more flexible for restore)
    $customBackupFile = Join-Path $BACKUP_DIR "weavenote_backup_$timestamp.dump"
    Write-Info "Creating custom format dump..."
    try {
        docker exec weavenote-postgres pg_dump -U weavenote -d weavenote --format=custom --no-owner --no-acl > $customBackupFile 2>$null
        Write-Success "Custom format dump created: $customBackupFile"
    }
    catch {
        Write-Warning "Could not create custom format dump (this is optional)"
    }
    
    # Export to JSON format
    Write-Info "Creating JSON export..."
    try {
        $composeCmd = "docker-compose"
        if (-not (Test-Command "docker-compose")) {
            $composeCmd = "docker compose"
        }
        
        # Get data via API
        $apiUrl = "http://localhost:8080/api"
        
        # Try to get all data
        $exportFile = Join-Path $BACKUP_DIR "weavenote_export_$timestamp.json"
        
        # Create a comprehensive export
        $export = @{
            timestamp = $timestamp
            version = "1.0.0"
            notes = @()
            folders = @()
            tags = @()
            users = @()
            settings = @()
        }
        
        # Export notes from database directly
        $notesJson = docker exec weavenote-postgres psql -U weavenote -d weavenote -t -A -c "SELECT json_agg(row_to_json(notes)) FROM notes WHERE \"isDeleted\" = false;" 2>$null
        if ($notesJson -and $notesJson -ne "null") {
            $export.notes = $notesJson | ConvertFrom-Json
        }
        
        # Export folders
        $foldersJson = docker exec weavenote-postgres psql -U weavenote -d weavenote -t -A -c "SELECT json_agg(row_to_json(folders)) FROM folders;" 2>$null
        if ($foldersJson -and $foldersJson -ne "null") {
            $export.folders = $foldersJson | ConvertFrom-Json
        }
        
        # Export tags
        $tagsJson = docker exec weavenote-postgres psql -U weavenote -d weavenote -t -A -c "SELECT json_agg(row_to_json(note_tags)) FROM note_tags;" 2>$null
        if ($tagsJson -and $tagsJson -ne "null") {
            $export.tags = $tagsJson | ConvertFrom-Json
        }
        
        $export | ConvertTo-Json -Depth 10 | Out-File -FilePath $exportFile -Encoding UTF8
        Write-Success "JSON export created: $exportFile"
    }
    catch {
        Write-Warning "Could not create JSON export: $_"
    }
    
    # Create CSV export for notes
    Write-Info "Creating CSV export..."
    try {
        $csvFile = Join-Path $BACKUP_DIR "weavenote_notes_$timestamp.csv"
        docker exec weavenote-postgres psql -U weavenote -d weavenote -c "COPY (SELECT id, title, content, type, tags, \"folderId\", \"createdAt\", \"updatedAt\" FROM notes WHERE \"isDeleted\" = false) TO STDOUT WITH CSV HEADER" > $csvFile 2>$null
        Write-Success "CSV export created: $csvFile"
    }
    catch {
        Write-Warning "Could not create CSV export"
    }
    
    # Create backup manifest
    $manifest = @{
        timestamp = $timestamp
        created = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        files = @(
            @{ name = "SQL Backup"; path = $backupFile; type = "sql" }
            @{ name = "Custom Format"; path = $customBackupFile; type = "dump" }
            @{ name = "JSON Export"; path = $exportFile; type = "json" }
            @{ name = "CSV Export"; path = $csvFile; type = "csv" }
        )
        database = @{
            name = "weavenote"
            user = "weavenote"
            host = "localhost"
            port = 5432
        }
    }
    
    $manifestFile = Join-Path $BACKUP_DIR "manifest_$timestamp.json"
    $manifest | ConvertTo-Json -Depth 5 | Out-File -FilePath $manifestFile -Encoding UTF8
    
    # Calculate total backup size
    $totalSize = (Get-ChildItem $BACKUP_DIR -Filter "*$timestamp*" | Measure-Object -Property Length -Sum).Sum
    $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
    
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Green
    Write-Host "  │                     BACKUP COMPLETED                                │" -ForegroundColor Green
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Backup Location: $BACKUP_DIR" -ForegroundColor Cyan
    Write-Host "  Total Size: $totalSizeMB MB" -ForegroundColor Cyan
    Write-Host "  Files Created:" -ForegroundColor Cyan
    Write-Host "    • SQL: $backupFile" -ForegroundColor White
    Write-Host "    • DUMP: $customBackupFile" -ForegroundColor White
    Write-Host "    • JSON: $exportFile" -ForegroundColor White
    Write-Host "    • CSV: $csvFile" -ForegroundColor White
    Write-Host "    • Manifest: $manifestFile" -ForegroundColor White
    Write-Host ""
    
    return $true
}

function New-CloudBackup {
    Write-Header "Cloud Backup Options"
    
    Write-Host "  Choose your cloud backup destination:" -ForegroundColor White
    Write-Host ""
    Write-Host "  [1] AWS S3" -ForegroundColor Yellow
    Write-Host "      • Requires AWS CLI configured" -ForegroundColor DarkGray
    Write-Host "      • Cost-effective long-term storage" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [2] Google Cloud Storage" -ForegroundColor Yellow
    Write-Host "      • Requires gcloud CLI configured" -ForegroundColor DarkGray
    Write-Host "      • Good for Google Workspace users" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [3] Azure Blob Storage" -ForegroundColor Yellow
    Write-Host "      • Requires Azure CLI configured" -ForegroundColor DarkGray
    Write-Host "      • Enterprise integration" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [4] Dropbox" -ForegroundColor Yellow
    Write-Host "      • Requires Dropbox access token" -ForegroundColor DarkGray
    Write-Host "      • Easy personal backup" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [5] SFTP/FTP Server" -ForegroundColor Yellow
    Write-Host "      • Requires server credentials" -ForegroundColor DarkGray
    Write-Host "      • Self-hosted option" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [0] Back to Main Menu" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "  Select cloud backup destination"
    
    # First create local backup
    Write-Info "Creating local backup first..."
    if (-not (New-LocalBackup)) {
        Write-Error "Failed to create local backup"
        return $false
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFiles = Get-ChildItem $BACKUP_DIR -Filter "*$timestamp*"
    
    switch ($choice) {
        "1" { Invoke-AWSBackup -Files $backupFiles -Timestamp $timestamp }
        "2" { Invoke-GCSBackup -Files $backupFiles -Timestamp $timestamp }
        "3" { Invoke-AzureBackup -Files $backupFiles -Timestamp $timestamp }
        "4" { Invoke-DropboxBackup -Files $backupFiles -Timestamp $timestamp }
        "5" { Invoke-SFTPBackup -Files $backupFiles -Timestamp $timestamp }
        "0" { return $true }
        default {
            Write-Warning "Invalid selection"
            return $false
        }
    }
    
    return $true
}

function Invoke-AWSBackup {
    param($Files, $Timestamp)
    
    Write-Header "AWS S3 Backup"
    
    # Check AWS CLI
    if (-not (Test-Command "aws")) {
        Write-Error "AWS CLI is not installed"
        Write-Info "Install from: https://aws.amazon.com/cli/"
        return $false
    }
    
    $bucket = Read-Host "  Enter S3 bucket name"
    if ([string]::IsNullOrWhiteSpace($bucket)) {
        Write-Error "Bucket name is required"
        return $false
    }
    
    $prefix = Read-Host "  Enter S3 prefix/folder (default: weavenote-backups)"
    if ([string]::IsNullOrWhiteSpace($prefix)) {
        $prefix = "weavenote-backups"
    }
    
    Write-Info "Uploading to S3..."
    
    foreach ($file in $Files) {
        $s3Path = "s3://$bucket/$prefix/$($file.Name)"
        Write-Info "Uploading $($file.Name)..."
        
        try {
            aws s3 cp $file.FullName $s3Path 2>$null
            Write-Success "Uploaded: $($file.Name)"
        }
        catch {
            Write-Error "Failed to upload $($file.Name): $_"
        }
    }
    
    Write-Success "AWS S3 backup completed"
    return $true
}

function Invoke-GCSBackup {
    param($Files, $Timestamp)
    
    Write-Header "Google Cloud Storage Backup"
    
    if (-not (Test-Command "gsutil")) {
        Write-Error "Google Cloud SDK is not installed"
        Write-Info "Install from: https://cloud.google.com/sdk/docs/install"
        return $false
    }
    
    $bucket = Read-Host "  Enter GCS bucket name"
    if ([string]::IsNullOrWhiteSpace($bucket)) {
        Write-Error "Bucket name is required"
        return $false
    }
    
    Write-Info "Uploading to GCS..."
    
    foreach ($file in $Files) {
        $gcsPath = "gs://$bucket/weavenote-backups/$($file.Name)"
        Write-Info "Uploading $($file.Name)..."
        
        try {
            gsutil cp $file.FullName $gcsPath 2>$null
            Write-Success "Uploaded: $($file.Name)"
        }
        catch {
            Write-Error "Failed to upload $($file.Name): $_"
        }
    }
    
    Write-Success "GCS backup completed"
    return $true
}

function Invoke-AzureBackup {
    param($Files, $Timestamp)
    
    Write-Header "Azure Blob Storage Backup"
    
    if (-not (Test-Command "az")) {
        Write-Error "Azure CLI is not installed"
        Write-Info "Install from: https://docs.microsoft.com/cli/azure/install-azure-cli"
        return $false
    }
    
    $account = Read-Host "  Enter storage account name"
    $container = Read-Host "  Enter container name"
    
    if ([string]::IsNullOrWhiteSpace($account) -or [string]::IsNullOrWhiteSpace($container)) {
        Write-Error "Storage account and container are required"
        return $false
    }
    
    Write-Info "Uploading to Azure..."
    
    foreach ($file in $Files) {
        Write-Info "Uploading $($file.Name)..."
        
        try {
            az storage blob upload --account-name $account --container-name $container --name "weavenote-backups/$($file.Name)" --file $file.FullName 2>$null
            Write-Success "Uploaded: $($file.Name)"
        }
        catch {
            Write-Error "Failed to upload $($file.Name): $_"
        }
    }
    
    Write-Success "Azure backup completed"
    return $true
}

function Invoke-DropboxBackup {
    param($Files, $Timestamp)
    
    Write-Header "Dropbox Backup"
    
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
    Write-Host "  │ Dropbox backup requires an access token.                           │" -ForegroundColor Yellow
    Write-Host "  │ To get one:                                                         │" -ForegroundColor Yellow
    Write-Host "  │ 1. Go to https://www.dropbox.com/developers/apps                   │" -ForegroundColor Yellow
    Write-Host "  │ 2. Create an app                                                    │" -ForegroundColor Yellow
    Write-Host "  │ 3. Generate an access token                                         │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
    Write-Host ""
    
    $token = Read-Host "  Enter Dropbox access token"
    if ([string]::IsNullOrWhiteSpace($token)) {
        Write-Error "Access token is required"
        return $false
    }
    
    Write-Info "Uploading to Dropbox..."
    
    foreach ($file in $Files) {
        Write-Info "Uploading $($file.Name)..."
        
        try {
            $headers = @{
                "Authorization" = "Bearer $token"
                "Content-Type" = "application/octet-stream"
                "Dropbox-API-Arg" = "{""path"":""/weavenote-backups/$($file.Name)"",""mode"":""add"",""autorename"":true,""mute"":false}"
            }
            
            Invoke-RestMethod -Uri "https://content.dropboxapi.com/2/files/upload" -Method Post -Headers $headers -Body ([System.IO.File]::ReadAllBytes($file.FullName)) | Out-Null
            Write-Success "Uploaded: $($file.Name)"
        }
        catch {
            Write-Error "Failed to upload $($file.Name): $_"
        }
    }
    
    Write-Success "Dropbox backup completed"
    return $true
}

function Invoke-SFTPBackup {
    param($Files, $Timestamp)
    
    Write-Header "SFTP Backup"
    
    $server = Read-Host "  Enter SFTP server address"
    $port = Read-Host "  Enter port (default: 22)"
    $username = Read-Host "  Enter username"
    $remotePath = Read-Host "  Enter remote path (default: /backups/weavenote)"
    
    if ([string]::IsNullOrWhiteSpace($port)) { $port = "22" }
    if ([string]::IsNullOrWhiteSpace($remotePath)) { $remotePath = "/backups/weavenote" }
    
    if ([string]::IsNullOrWhiteSpace($server) -or [string]::IsNullOrWhiteSpace($username)) {
        Write-Error "Server and username are required"
        return $false
    }
    
    # Check if we can use SCP (simpler than SFTP in PowerShell)
    if (Test-Command "scp") {
        Write-Info "Uploading via SCP..."
        
        foreach ($file in $Files) {
            Write-Info "Uploading $($file.Name)..."
            
            try {
                scp -P $port $file.FullName "$username@${server}:$remotePath/$($file.Name)" 2>$null
                Write-Success "Uploaded: $($file.Name)"
            }
            catch {
                Write-Error "Failed to upload $($file.Name): $_"
            }
        }
        
        Write-Success "SFTP backup completed"
        return $true
    }
    else {
        Write-Error "SCP is not available. Please install OpenSSH or WinSCP"
        Write-Info "Alternatively, manually copy files from: $BACKUP_DIR"
        return $false
    }
}

# =============================================================================
# MIGRATION FUNCTIONS
# =============================================================================

function Start-Migration {
    Write-Header "Migration Options"
    
    Write-Host "  Migrate from cloud service to your local WeaveNote:" -ForegroundColor White
    Write-Host ""
    Write-Host "  [1] Firebase Firestore → WeaveNote" -ForegroundColor Yellow
    Write-Host "      • Requires Firebase service account JSON" -ForegroundColor DarkGray
    Write-Host "      • Migrates notes, folders, and tags" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [2] Supabase → WeaveNote" -ForegroundColor Yellow
    Write-Host "      • Requires Supabase connection string or API key" -ForegroundColor DarkGray
    Write-Host "      • Full database migration" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [3] MongoDB → WeaveNote" -ForegroundColor Yellow
    Write-Host "      • Requires MongoDB connection string" -ForegroundColor DarkGray
    Write-Host "      • Document-based migration" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [4] Notion → WeaveNote" -ForegroundColor Yellow
    Write-Host "      • Requires Notion API integration token" -ForegroundColor DarkGray
    Write-Host "      • Page and database migration" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [5] Generic JSON Import" -ForegroundColor Yellow
    Write-Host "      • Import from JSON file" -ForegroundColor DarkGray
    Write-Host "      • Custom field mapping" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [0] Back to Main Menu" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "  Select migration source"
    
    # Pre-flight checks for migration
    Write-Info "Running pre-flight checks..."
    
    if (-not (Test-DatabaseRunning)) {
        Write-Error "Database is not running. Cannot proceed with migration."
        return $false
    }
    
    if (-not (Test-DiskSpace -RequiredGB 2)) {
        Write-Error "Insufficient disk space for migration."
        return $false
    }
    
    Initialize-Directories | Out-Null
    
    switch ($choice) {
        "1" { Invoke-FirebaseMigration }
        "2" { Invoke-SupabaseMigration }
        "3" { Invoke-MongoDBMigration }
        "4" { Invoke-NotionMigration }
        "5" { Invoke-JSONImport }
        "0" { return $true }
        default {
            Write-Warning "Invalid selection"
            return $false
        }
    }
    
    return $true
}

function Invoke-FirebaseMigration {
    Write-Header "Firebase Firestore Migration"
    
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "  │                    FIREBASE MIGRATION SETUP                         │" -ForegroundColor Cyan
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "  Required Information:" -ForegroundColor Yellow
    Write-Host "  1. Firebase Project ID" -ForegroundColor White
    Write-Host "  2. Service Account JSON file (for authentication)" -ForegroundColor White
    Write-Host ""
    Write-Host "  To get your Service Account JSON:" -ForegroundColor Cyan
    Write-Host "  1. Go to Firebase Console → Project Settings → Service Accounts" -ForegroundColor DarkGray
    Write-Host "  2. Click 'Generate new private key'" -ForegroundColor DarkGray
    Write-Host "  3. Save the JSON file securely" -ForegroundColor DarkGray
    Write-Host ""
    
    # Get Firebase project ID
    $projectId = Read-Host "  Enter Firebase Project ID"
    if ([string]::IsNullOrWhiteSpace($projectId)) {
        Write-Error "Project ID is required"
        return $false
    }
    
    # Get service account path
    $serviceAccountPath = Read-Host "  Enter path to Service Account JSON file"
    if ([string]::IsNullOrWhiteSpace($serviceAccountPath) -or -not (Test-Path $serviceAccountPath)) {
        Write-Error "Valid service account file is required"
        return $false
    }
    
    # Get collection names
    Write-Host ""
    Write-Info "Firebase Collection Names (leave empty for auto-detection):"
    $notesCollection = Read-Host "  Notes collection name (default: notes)"
    $foldersCollection = Read-Host "  Folders collection name (default: folders)"
    $tagsCollection = Read-Host "  Tags collection name (default: tags)"
    
    if ([string]::IsNullOrWhiteSpace($notesCollection)) { $notesCollection = "notes" }
    if ([string]::IsNullOrWhiteSpace($foldersCollection)) { $foldersCollection = "folders" }
    if ([string]::IsNullOrWhiteSpace($tagsCollection)) { $tagsCollection = "tags" }
    
    Write-Host ""
    Write-Info "Starting Firebase migration..."
    Write-Host ""
    
    # Create migration script
    $migrationScript = @"
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Client } = require('pg');

// Read service account
const serviceAccount = require('$($serviceAccountPath.Replace('\', '\\'))');

// Initialize Firebase
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const client = new Client({
    connectionString: 'postgresql://weavenote:weavenote@localhost:5432/weavenote'
});

async function migrate() {
    await client.connect();
    console.log('Connected to PostgreSQL');
    
    // Migrate folders first
    console.log('Migrating folders...');
    const foldersSnapshot = await db.collection('$foldersCollection').get();
    for (const doc of foldersSnapshot.docs) {
        const data = doc.data();
        await client.query(\`
            INSERT INTO folders (id, name, \"userId\", \"createdAt\", \"updatedAt\")
            VALUES (\$1, \$2, \$3, \$4, \$5)
            ON CONFLICT (id) DO UPDATE SET name = \$2
        \`, [doc.id, data.name || 'Untitled', data.userId || 'migrated', data.createdAt?.toDate() || new Date(), data.updatedAt?.toDate() || new Date()]);
    }
    console.log(\`Migrated \${foldersSnapshot.size} folders\`);
    
    // Migrate notes
    console.log('Migrating notes...');
    const notesSnapshot = await db.collection('$notesCollection').get();
    for (const doc of notesSnapshot.docs) {
        const data = doc.data();
        await client.query(\`
            INSERT INTO notes (id, title, content, type, tags, \"folderId\", \"userId\", \"createdAt\", \"updatedAt\", \"isDeleted\")
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10)
            ON CONFLICT (id) DO UPDATE SET title = \$2, content = \$3
        \`, [
            doc.id,
            data.title || 'Untitled',
            data.content || '',
            data.type || 'quick',
            JSON.stringify(data.tags || []),
            data.folderId || null,
            data.userId || 'migrated',
            data.createdAt?.toDate() || new Date(),
            data.updatedAt?.toDate() || new Date(),
            data.isDeleted || false
        ]);
    }
    console.log(\`Migrated \${notesSnapshot.size} notes\`);
    
    await client.end();
    console.log('Migration completed!');
}

migrate().catch(console.error);
"@

    $scriptPath = Join-Path $TEMP_DIR "firebase-migration.js"
    $migrationScript | Out-File -FilePath $scriptPath -Encoding UTF8
    
    Write-Info "Migration script created: $scriptPath"
    Write-Warning "This migration requires Node.js with firebase-admin and pg packages"
    Write-Host ""
    
    # Try to run migration
    if (Test-Command "node") {
        Write-Info "Running migration..."
        
        # Install dependencies
        Push-Location $TEMP_DIR
        npm init -y 2>$null
        npm install firebase-admin pg 2>&1 | Out-Null
        Pop-Location
        
        # Run migration
        try {
            node $scriptPath 2>&1
            Write-Success "Firebase migration completed"
        }
        catch {
            Write-Error "Migration failed: $_"
            Write-Info "You can manually run: node $scriptPath"
        }
    }
    else {
        Write-Warning "Node.js is not installed. Manual migration required."
        Write-Info "Migration script saved to: $scriptPath"
        Write-Info "To run manually:"
        Write-Host "  cd $TEMP_DIR"
        Write-Host "  npm init -y"
        Write-Host "  npm install firebase-admin pg"
        Write-Host "  node firebase-migration.js"
    }
    
    return $true
}

function Invoke-SupabaseMigration {
    Write-Header "Supabase Migration"
    
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "  │                    SUPABASE MIGRATION SETUP                         │" -ForegroundColor Cyan
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "  Required Information:" -ForegroundColor Yellow
    Write-Host "  1. Supabase Project URL" -ForegroundColor White
    Write-Host "  2. Supabase Service Role Key (for full access)" -ForegroundColor White
    Write-Host "     OR" -ForegroundColor DarkGray
    Write-Host "  3. Database Connection String" -ForegroundColor White
    Write-Host ""
    Write-Host "  To get your credentials:" -ForegroundColor Cyan
    Write-Host "  1. Go to Supabase Dashboard → Settings → API" -ForegroundColor DarkGray
    Write-Host "  2. Copy the Project URL and Service Role Key" -ForegroundColor DarkGray
    Write-Host "  3. Or go to Settings → Database for connection string" -ForegroundColor DarkGray
    Write-Host ""
    
    # Get migration method
    Write-Host "  Choose migration method:" -ForegroundColor White
    Write-Host "  [1] Direct Database Migration (recommended, faster)" -ForegroundColor Yellow
    Write-Host "  [2] API Migration (slower but works through firewalls)" -ForegroundColor Yellow
    Write-Host ""
    
    $method = Read-Host "  Select method"
    
    if ($method -eq "1") {
        # Direct database migration
        $connectionString = Read-Host "  Enter Supabase Database Connection String"
        if ([string]::IsNullOrWhiteSpace($connectionString)) {
            Write-Error "Connection string is required"
            return $false
        }
        
        Write-Host ""
        Write-Info "Starting direct database migration..."
        
        # Use pg_dump and pg_restore
        $dumpFile = Join-Path $TEMP_DIR "supabase_dump.sql"
        
        Write-Info "Exporting from Supabase..."
        try {
            # Parse connection string
            $env:PGPASSWORD = ($connectionString -replace '.*password=([^;]+).*', '$1')
            $host = ($connectionString -replace '.*host=([^;]+).*', '$1')
            $port = ($connectionString -replace '.*port=([^;]+).*', '$1')
            $user = ($connectionString -replace '.*user=([^;]+).*', '$1')
            $database = ($connectionString -replace '.*dbname=([^;]+).*', '$1')
            
            if ([string]::IsNullOrWhiteSpace($port)) { $port = "5432" }
            if ([string]::IsNullOrWhiteSpace($database)) { $database = "postgres" }
            
            # Check for pg_dump
            if (Test-Command "pg_dump") {
                pg_dump -h $host -p $port -U $user -d $database --format=plain --no-owner --no-acl -f $dumpFile 2>$null
                Write-Success "Exported Supabase database to: $dumpFile"
            }
            else {
                Write-Warning "pg_dump not found. Using Docker..."
                docker run --rm -e PGPASSWORD=$env:PGPASSWORD -v "${TEMP_DIR}:/dump" postgres:16 pg_dump -h $host -p $port -U $user -d $database --format=plain --no-owner --no-acl -f /dump/supabase_dump.sql 2>$null
                Write-Success "Exported Supabase database"
            }
            
            # Import to local
            Write-Info "Importing to local WeaveNote..."
            docker exec -i weavenote-postgres psql -U weavenote -d weavenote < $dumpFile 2>$null
            
            Write-Success "Supabase migration completed!"
        }
        catch {
            Write-Error "Migration failed: $_"
            Write-Info "Manual import: docker exec -i weavenote-postgres psql -U weavenote -d weavenote < $dumpFile"
        }
        finally {
            $env:PGPASSWORD = $null
        }
    }
    else {
        # API migration
        $projectUrl = Read-Host "  Enter Supabase Project URL (e.g., https://xxxxx.supabase.co)"
        $serviceKey = Read-Host "  Enter Supabase Service Role Key"
        
        if ([string]::IsNullOrWhiteSpace($projectUrl) -or [string]::IsNullOrWhiteSpace($serviceKey)) {
            Write-Error "Project URL and Service Key are required"
            return $false
        }
        
        Write-Host ""
        Write-Info "Starting API-based migration..."
        
        # Export data via API
        try {
            $headers = @{
                "apikey" = $serviceKey
                "Authorization" = "Bearer $serviceKey"
            }
            
            # Get notes
            Write-Info "Fetching notes from Supabase..."
            $notesResponse = Invoke-RestMethod -Uri "$projectUrl/rest/v1/notes?select=*" -Headers $headers -Method Get
            Write-Success "Fetched $($notesResponse.Count) notes"
            
            # Get folders
            Write-Info "Fetching folders from Supabase..."
            $foldersResponse = Invoke-RestMethod -Uri "$projectUrl/rest/v1/folders?select=*" -Headers $headers -Method Get
            Write-Success "Fetched $($foldersResponse.Count) folders"
            
            # Save to temp file for import
            $exportData = @{
                notes = $notesResponse
                folders = $foldersResponse
            }
            
            $exportFile = Join-Path $TEMP_DIR "supabase_export.json"
            $exportData | ConvertTo-Json -Depth 10 | Out-File -FilePath $exportFile -Encoding UTF8
            
            # Import to local database
            Write-Info "Importing to local WeaveNote..."
            Invoke-JSONImportInternal -FilePath $exportFile
            
            Write-Success "Supabase API migration completed!"
        }
        catch {
            Write-Error "API migration failed: $_"
        }
    }
    
    return $true
}

function Invoke-MongoDBMigration {
    Write-Header "MongoDB Migration"
    
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "  │                     MONGODB MIGRATION SETUP                         │" -ForegroundColor Cyan
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "  Required Information:" -ForegroundColor Yellow
    Write-Host "  • MongoDB Connection String" -ForegroundColor White
    Write-Host "  • Database Name" -ForegroundColor White
    Write-Host "  • Collection Names (notes, folders, tags)" -ForegroundColor White
    Write-Host ""
    
    $connectionString = Read-Host "  Enter MongoDB Connection String"
    $databaseName = Read-Host "  Enter Database Name"
    $notesCollection = Read-Host "  Enter Notes Collection Name (default: notes)"
    $foldersCollection = Read-Host "  Enter Folders Collection Name (default: folders)"
    
    if ([string]::IsNullOrWhiteSpace($notesCollection)) { $notesCollection = "notes" }
    if ([string]::IsNullOrWhiteSpace($foldersCollection)) { $foldersCollection = "folders" }
    
    if ([string]::IsNullOrWhiteSpace($connectionString) -or [string]::IsNullOrWhiteSpace($databaseName)) {
        Write-Error "Connection string and database name are required"
        return $false
    }
    
    Write-Host ""
    Write-Info "Starting MongoDB migration..."
    
    # Check for mongodump
    if (Test-Command "mongodump") {
        $dumpDir = Join-Path $TEMP_DIR "mongodb_dump"
        
        Write-Info "Exporting from MongoDB..."
        mongodump --uri $connectionString --db $databaseName --out $dumpDir 2>$null
        Write-Success "MongoDB export completed"
        
        # Convert BSON to JSON
        Write-Info "Converting BSON to JSON..."
        if (Test-Command "bsondump") {
            $notesBson = Join-Path $dumpDir "$databaseName\$notesCollection.bson"
            if (Test-Path $notesBson) {
                $notesJson = Join-Path $TEMP_DIR "mongodb_notes.json"
                bsondump $notesBson > $notesJson 2>$null
                Write-Success "Converted notes to JSON"
            }
        }
    }
    else {
        Write-Warning "mongodump not found. Attempting API migration..."
        Write-Info "Please ensure your MongoDB is accessible via API or install MongoDB tools"
    }
    
    return $true
}

function Invoke-NotionMigration {
    Write-Header "Notion Migration"
    
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "  │                      NOTION MIGRATION SETUP                         │" -ForegroundColor Cyan
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "  Required Information:" -ForegroundColor Yellow
    Write-Host "  • Notion API Integration Token" -ForegroundColor White
    Write-Host "  • Database/Page IDs to migrate" -ForegroundColor White
    Write-Host ""
    Write-Host "  To create an integration:" -ForegroundColor Cyan
    Write-Host "  1. Go to https://www.notion.so/my-integrations" -ForegroundColor DarkGray
    Write-Host "  2. Create a new integration and copy the token" -ForegroundColor DarkGray
    Write-Host "  3. Share your database/page with the integration" -ForegroundColor DarkGray
    Write-Host ""
    
    $token = Read-Host "  Enter Notion Integration Token"
    $databaseId = Read-Host "  Enter Database ID (or page ID for sub-pages)"
    
    if ([string]::IsNullOrWhiteSpace($token)) {
        Write-Error "Integration token is required"
        return $false
    }
    
    Write-Host ""
    Write-Info "Starting Notion migration..."
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
            "Notion-Version" = "2022-06-28"
        }
        
        if (-not [string]::IsNullOrWhiteSpace($databaseId)) {
            # Query database
            Write-Info "Querying Notion database..."
            $body = @{
                page_size = 100
            } | ConvertTo-Json
            
            $response = Invoke-RestMethod -Uri "https://api.notion.com/v1/databases/$databaseId/query" -Method Post -Headers $headers -Body $body
            
            Write-Success "Found $($response.results.Count) pages"
            
            # Convert to WeaveNote format
            $notes = @()
            foreach ($page in $response.results) {
                $title = ""
                $content = ""
                
                # Extract title and content from properties
                foreach ($prop in $page.properties.PSObject.Properties) {
                    if ($prop.Value.type -eq "title") {
                        $title = $prop.Value.title[0].plain_text
                    }
                    elseif ($prop.Value.type -eq "rich_text") {
                        $content += $prop.Value.rich_text[0].plain_text + " "
                    }
                }
                
                $notes += @{
                    id = $page.id
                    title = $title
                    content = $content
                    type = "quick"
                    tags = @()
                    createdAt = $page.created_time
                    updatedAt = $page.last_edited_time
                }
            }
            
            # Save and import
            $exportFile = Join-Path $TEMP_DIR "notion_export.json"
            @{ notes = $notes } | ConvertTo-Json -Depth 10 | Out-File -FilePath $exportFile -Encoding UTF8
            
            Invoke-JSONImportInternal -FilePath $exportFile
            
            Write-Success "Notion migration completed!"
        }
    }
    catch {
        Write-Error "Notion migration failed: $_"
    }
    
    return $true
}

function Invoke-JSONImport {
    Write-Header "JSON Import"
    
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "  │                        JSON IMPORT SETUP                            │" -ForegroundColor Cyan
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "  Import data from a JSON file into WeaveNote." -ForegroundColor White
    Write-Host ""
    Write-Host "  Expected JSON format:" -ForegroundColor Yellow
    Write-Host '  {
    "notes": [
        { "title": "...", "content": "...", "type": "quick", "tags": [] }
    ],
    "folders": [
        { "name": "...", "order": 1 }
    ]
}' -ForegroundColor DarkGray
    Write-Host ""
    
    $filePath = Read-Host "  Enter path to JSON file"
    
    if ([string]::IsNullOrWhiteSpace($filePath) -or -not (Test-Path $filePath)) {
        Write-Error "Valid file path is required"
        return $false
    }
    
    Invoke-JSONImportInternal -FilePath $filePath
    
    return $true
}

function Invoke-JSONImportInternal {
    param([string]$FilePath)
    
    Write-Info "Importing from: $FilePath"
    
    try {
        $data = Get-Content $FilePath | ConvertFrom-Json
        
        $notesCount = 0
        $foldersCount = 0
        
        # Import folders
        if ($data.folders) {
            Write-Info "Importing folders..."
            foreach ($folder in $data.folders) {
                $id = if ($folder.id) { $folder.id } else { [Guid]::NewGuid().ToString() }
                $name = $folder.name -replace "'", "''"
                
                $sql = "INSERT INTO folders (id, name, ""userId"", ""createdAt"", ""updatedAt"") VALUES ('$id', '$name', 'imported', NOW(), NOW()) ON CONFLICT (id) DO NOTHING"
                docker exec -i weavenote-postgres psql -U weavenote -d weavenote -c $sql 2>$null
                $foldersCount++
            }
            Write-Success "Imported $foldersCount folders"
        }
        
        # Import notes
        if ($data.notes) {
            Write-Info "Importing notes..."
            foreach ($note in $data.notes) {
                $id = if ($note.id) { $note.id } else { [Guid]::NewGuid().ToString() }
                $title = ($note.title -replace "'", "''").Substring(0, [Math]::Min($note.title.Length, 255))
                $content = $note.content -replace "'", "''"
                $type = if ($note.type) { $note.type } else { "quick" }
                $tags = if ($note.tags) { $note.tags | ConvertTo-Json -Compress } else { "[]" }
                $folderId = if ($note.folderId) { "'$($note.folderId)'" } else { "NULL" }
                
                $sql = "INSERT INTO notes (id, title, content, type, tags, ""folderId"", ""userId"", ""createdAt"", ""updatedAt"", ""isDeleted"") VALUES ('$id', '$title', '$content', '$type', '$tags'::jsonb, $folderId, 'imported', NOW(), NOW(), false) ON CONFLICT (id) DO NOTHING"
                docker exec -i weavenote-postgres psql -U weavenote -d weavenote -c $sql 2>$null
                $notesCount++
            }
            Write-Success "Imported $notesCount notes"
        }
        
        Write-Host ""
        Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor Green
        Write-Host "  │                     IMPORT COMPLETED                                 │" -ForegroundColor Green
        Write-Host "  │                                                                     │" -ForegroundColor Green
        Write-Host "  │  Folders: $foldersCount".PadRight(60) -ForegroundColor Green -NoNewline
        Write-Host "│" -ForegroundColor Green
        Write-Host "  │  Notes: $notesCount".PadRight(60) -ForegroundColor Green -NoNewline
        Write-Host "│" -ForegroundColor Green
        Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor Green
    }
    catch {
        Write-Error "Import failed: $_"
    }
}

# =============================================================================
# RESTORE FUNCTIONS
# =============================================================================

function Restore-Database {
    Write-Header "Database Restore"
    
    # List available backups
    Write-Info "Available backups:"
    $backups = Get-ChildItem $BACKUP_DIR -Filter "*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 10
    
    if ($backups.Count -eq 0) {
        Write-Warning "No backups found in: $BACKUP_DIR"
        return $false
    }
    
    Write-Host ""
    $i = 1
    foreach ($backup in $backups) {
        $sizeMB = [math]::Round($backup.Length / 1MB, 2)
        Write-Host "  [$i] $($backup.Name) ($sizeMB MB) - $($backup.LastWriteTime)" -ForegroundColor White
        $i++
    }
    Write-Host "  [0] Back to Main Menu" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "  Select backup to restore"
    
    if ($choice -eq "0") {
        return $true
    }
    
    $selectedIndex = [int]$choice - 1
    if ($selectedIndex -lt 0 -or $selectedIndex -ge $backups.Count) {
        Write-Error "Invalid selection"
        return $false
    }
    
    $selectedBackup = $backups[$selectedIndex]
    
    Write-Host ""
    Write-Warning "WARNING: This will replace ALL data in your database!"
    $confirm = Read-Host "  Are you sure you want to restore? (yes/N)"
    
    if ($confirm -ne "yes") {
        Write-Info "Restore cancelled"
        return $false
    }
    
    Write-Info "Restoring from: $($selectedBackup.FullName)"
    
    try {
        # Drop and recreate database
        Write-Info "Dropping existing connections..."
        docker exec weavenote-postgres psql -U weavenote -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'weavenote' AND pid <> pg_backend_pid();" 2>$null
        
        Write-Info "Dropping database..."
        docker exec weavenote-postgres psql -U weavenote -d postgres -c "DROP DATABASE IF EXISTS weavenote;" 2>$null
        
        Write-Info "Creating fresh database..."
        docker exec weavenote-postgres psql -U weavenote -d postgres -c "CREATE DATABASE weavenote;" 2>$null
        
        Write-Info "Restoring data..."
        Get-Content $selectedBackup.FullName | docker exec -i weavenote-postgres psql -U weavenote -d weavenote 2>$null
        
        # Run migrations if needed
        Write-Info "Running database migrations..."
        docker exec weavenote-api npx prisma migrate deploy 2>$null
        
        Write-Success "Database restored successfully!"
    }
    catch {
        Write-Error "Restore failed: $_"
        return $false
    }
    
    return $true
}

# =============================================================================
# MAIN MENU
# =============================================================================

function Show-MainMenu {
    Clear-Host
    
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║                                                                   ║" -ForegroundColor Cyan
    Write-Host "  ║   🧶 WEAVERNOTE BACKUP & MIGRATION TOOL v$SCRIPT_VERSION                  ║" -ForegroundColor Cyan
    Write-Host "  ║                                                                   ║" -ForegroundColor Cyan
    Write-Host "  ╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "  ┌─────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │                         MAIN MENU                                   │" -ForegroundColor DarkGray
    Write-Host "  └─────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host ""
    
    Write-Host "  BACKUP OPTIONS:" -ForegroundColor Cyan
    Write-Host "  [1] Create Local Backup" -ForegroundColor White
    Write-Host "      • SQL dump, JSON export, CSV export" -ForegroundColor DarkGray
    Write-Host "      • Fast and reliable" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [2] Create Cloud Backup" -ForegroundColor White
    Write-Host "      • AWS S3, Google Cloud, Azure, Dropbox, SFTP" -ForegroundColor DarkGray
    Write-Host "      • Offsite disaster recovery" -ForegroundColor DarkGray
    Write-Host ""
    
    Write-Host "  MIGRATION OPTIONS:" -ForegroundColor Cyan
    Write-Host "  [3] Migrate from Cloud Service" -ForegroundColor White
    Write-Host "      • Firebase, Supabase, MongoDB, Notion" -ForegroundColor DarkGray
    Write-Host "      • JSON import" -ForegroundColor DarkGray
    Write-Host ""
    
    Write-Host "  RESTORE OPTIONS:" -ForegroundColor Cyan
    Write-Host "  [4] Restore from Backup" -ForegroundColor White
    Write-Host "      • Restore from local backup files" -ForegroundColor DarkGray
    Write-Host "      • ⚠️ Will replace all data" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "  UTILITIES:" -ForegroundColor Cyan
    Write-Host "  [5] Pre-flight Checks" -ForegroundColor White
    Write-Host "      • Check database status" -ForegroundColor DarkGray
    Write-Host "      • Check disk space" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [6] Clean Old Backups" -ForegroundColor White
    Write-Host "      • Remove backups older than 30 days" -ForegroundColor DarkGray
    Write-Host ""
    
    Write-Host "  [0] Exit" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "  Select an option"
    
    return $choice
}

function Invoke-CleanupOldBackups {
    Write-Header "Cleaning Old Backups"
    
    $daysOld = 30
    $cutoffDate = (Get-Date).AddDays(-$daysOld)
    
    Write-Info "Removing backups older than $daysOld days (before $cutoffDate)..."
    
    $oldBackups = Get-ChildItem $BACKUP_DIR | Where-Object { $_.LastWriteTime -lt $cutoffDate }
    
    if ($oldBackups.Count -eq 0) {
        Write-Success "No old backups to remove"
        return $true
    }
    
    $totalSize = ($oldBackups | Measure-Object -Property Length -Sum).Sum
    $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
    
    Write-Host ""
    Write-Host "  Found $($oldBackups.Count) old backup(s) totaling $totalSizeMB MB" -ForegroundColor Yellow
    Write-Host ""
    
    $confirm = Read-Host "  Delete these backups? (y/N)"
    
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        foreach ($backup in $oldBackups) {
            Remove-Item $backup.FullName -Force
            Write-Success "Deleted: $($backup.Name)"
        }
        Write-Success "Cleanup completed"
    }
    else {
        Write-Info "Cleanup cancelled"
    }
    
    return $true
}

# =============================================================================
# MAIN FUNCTION
# =============================================================================

function Main {
    $running = $true
    
    while ($running) {
        $choice = Show-MainMenu
        
        switch ($choice) {
            "1" {
                if (Test-DatabaseRunning) {
                    if (Test-DiskSpace) {
                        Initialize-Directories
                        New-LocalBackup
                    }
                }
                Write-Host ""
                Read-Host "  Press Enter to continue..."
            }
            "2" {
                if (Test-DatabaseRunning) {
                    if (Test-DiskSpace) {
                        Initialize-Directories
                        New-CloudBackup
                    }
                }
                Write-Host ""
                Read-Host "  Press Enter to continue..."
            }
            "3" {
                Start-Migration
                Write-Host ""
                Read-Host "  Press Enter to continue..."
            }
            "4" {
                if (Test-DatabaseRunning) {
                    Restore-Database
                }
                Write-Host ""
                Read-Host "  Press Enter to continue..."
            }
            "5" {
                Test-DatabaseRunning
                Test-DiskSpace
                Write-Host ""
                Read-Host "  Press Enter to continue..."
            }
            "6" {
                Invoke-CleanupOldBackups
                Write-Host ""
                Read-Host "  Press Enter to continue..."
            }
            "0" {
                $running = $false
                Write-Host ""
                Write-Success "Thank you for using WeaveNote Backup & Migration Tool!"
                Write-Host ""
            }
            default {
                Write-Warning "Invalid option. Please try again."
                Start-Sleep -Seconds 1
            }
        }
    }
}

# =============================================================================
# ENTRY POINT
# =============================================================================

Main
