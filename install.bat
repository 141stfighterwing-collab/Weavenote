@echo off
:: =============================================================================
:: Weavenote One-Click Installer for Windows
:: =============================================================================
:: Double-click this file to install Weavenote

title Weavenote Installer

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Run the PowerShell installer
powershell -ExecutionPolicy Bypass -File "%~dp0install-smart.ps1"

pause
