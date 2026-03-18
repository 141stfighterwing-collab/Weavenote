@echo off
:: WeaveNote Backup & Migration Tool Launcher
:: This script launches the PowerShell backup and migration tool

title WeaveNote Backup & Migration Tool

echo.
echo  Starting WeaveNote Backup & Migration Tool...
echo.

:: Check if PowerShell is available
where powershell >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] PowerShell is not installed or not in PATH
    echo  Please install PowerShell and try again.
    pause
    exit /b 1
)

:: Run the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0backup-migration.ps1"

exit /b %ERRORLEVEL%
