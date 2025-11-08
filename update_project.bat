@echo off
setlocal enabledelayedexpansion
title 🚀 Update Project from Git

echo =====================================================
echo 🔄 Starting Project Update from Git...
echo =====================================================
echo.

:: --- STEP 1: Detect project folder (this .bat file's location) ---
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"
echo 📂 Working directory: %PROJECT_DIR%

:: --- STEP 2: Set your Git repo URL (change if needed) ---
set "GIT_REPO=https://github.com/UmerYasir718/sngpl"

:: --- STEP 3: Verify Git availability ---
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git is not installed or not in PATH.
    echo Please install Git first.
    pause
    exit /b
)

:: --- STEP 4: Ensure it's a valid Git repo ---
if not exist ".git" (
    echo 📁 .git folder not found. Cloning fresh copy into current folder...
    rmdir /s /q "%PROJECT_DIR%"
    git clone "%GIT_REPO%" "%PROJECT_DIR%"
    if %errorlevel% neq 0 (
        echo ❌ Failed to clone repository. Check your URL or network.
        pause
        exit /b
    )
)

:: --- STEP 5: Fetch latest code ---
echo.
echo 🔍 Fetching latest changes from Git...
git fetch --all
if %errorlevel% neq 0 (
    echo ❌ Git fetch failed.
    pause
    exit /b
)

:: --- STEP 6: Pull updates ---
echo.
echo ⬇️ Pulling latest changes...
git pull origin main
if %errorlevel% neq 0 (
    echo ❌ Git pull failed. Please resolve manually.
    pause
    exit /b
)

:: --- STEP 7: Install dependencies if package.json exists ---
if exist "package.json" (
    echo.
    echo 📦 Installing npm dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ npm install failed.
        pause
        exit /b
    )
)

:: --- STEP 8: Done ---
echo.
echo =====================================================
echo ✅ Code updated successfully and dependencies installed!
echo =====================================================
echo.
pause
endlocal
