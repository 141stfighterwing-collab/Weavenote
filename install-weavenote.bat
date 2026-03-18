@echo off
:: Weavenote One-Click Installer Launcher
:: This batch file launches the PowerShell installer

title Weavenote Installer

echo.
echo  ===============================================================
echo   Weavenote Docker Installer Launcher
echo  ===============================================================
echo.
echo  This will start the PowerShell installer...
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
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0install-weavenote.ps1"

pause
