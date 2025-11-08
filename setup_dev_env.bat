@echo off
setlocal enabledelayedexpansion
title Developer Environment Setup (NVM + Node.js + Git)

echo =====================================================
echo 🚀 Starting Developer Environment Setup...
echo =====================================================
echo.

:: --- STEP 1: Check for Administrator privileges ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Please run this script as Administrator.
    pause
    exit /b
)

:: --- STEP 2: Install NVM (Windows) ---
echo 🔍 Checking NVM installation...
where nvm >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installing NVM for Windows...
    powershell -Command "Invoke-WebRequest https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.exe -OutFile nvm-setup.exe"
    start /wait nvm-setup.exe
) else (
    echo ✅ NVM is already installed.
)

:: --- STEP 3: Ensure NVM is available ---
set "NVM_HOME=%ProgramFiles%\nvm"
set "NVM_SYMLINK=%SystemDrive%\Program Files\nodejs"
setx NVM_HOME "%NVM_HOME%" >nul
setx NVM_SYMLINK "%NVM_SYMLINK%" >nul
set "PATH=%NVM_HOME%;%NVM_SYMLINK%;%PATH%"
echo ✅ NVM environment variables set.

:: --- STEP 4: Install Node.js 20 ---
echo 🔍 Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installing Node.js v20 using NVM...
    nvm install 20
    nvm use 20
) else (
    echo ✅ Node.js already installed.
)

:: --- STEP 5: Verify Node and NPM versions ---
echo.
echo 🔎 Verifying Node and NPM versions...
node -v
npm -v

:: --- STEP 6: Install Git ---
echo.
echo 🔍 Checking Git installation...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installing Git...
    powershell -Command "Invoke-WebRequest https://github.com/git-for-windows/git/releases/latest/download/Git-2.47.0-64-bit.exe -OutFile git-setup.exe"
    start /wait git-setup.exe /VERYSILENT /NORESTART
) else (
    echo ✅ Git is already installed.
)

:: --- STEP 7: Verify Git version ---
echo.
echo 🔎 Verifying Git version...
git --version

:: --- STEP 8: Clone or update project repository ---
echo.
set "TARGET_DIR=%~dp0sngpl_automate"
set "REPO_URL=https://github.com/UmerYasir718/sngpl"

echo 📁 Checking for project folder...
if exist "%TARGET_DIR%" (
    echo ⚙️ Project folder already exists: %TARGET_DIR%
    echo 🔄 Updating existing repository...
    cd /d "%TARGET_DIR%"
    git fetch --all
    git pull origin main
) else (
    echo 📦 Cloning repository into: %TARGET_DIR%
    git clone "%REPO_URL%" "%TARGET_DIR%"
    if %errorlevel% neq 0 (
        echo ❌ Failed to clone repository. Check your network or repo URL.
        pause
        exit /b
    )
    cd /d "%TARGET_DIR%"
)

:: --- STEP 9: Install npm dependencies if package.json exists ---
echo.
if exist "package.json" (
    echo 📦 Installing npm dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ npm install failed. Please check for issues.
        pause
        exit /b
    )
    echo ✅ npm install completed successfully!
) else (
    echo ⚠️ No package.json found — skipping npm install.
)

:: --- STEP 10: Final Confirmation ---
echo.
echo =====================================================
echo ✅ Everything is OK and good to go! 🎉
echo 📂 Project location: %TARGET_DIR%
echo =====================================================
echo.
pause
endlocal
