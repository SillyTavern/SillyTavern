# SillyTavern Mobile - APK Build Script
# 
# Usage: powershell -File mobile/build-apk.ps1 [release|debug]
#
# Prerequisites:
#   - Node.js >= 20 installed
#   - Java 17+ (JDK)
#   - Android SDK with NDK (API 34+, build tools 34+)
#   - Gradle (via Android Studio or standalone)
#
# This script:
#   1. Installs production dependencies
#   2. Pre-compiles webpack bundle
#   3. Prepares assets for bundling
#   4. Downloads Node.js ARM64 binary
#   5. Builds the APK with Gradle

param(
    [ValidateSet("debug", "release")]
    [string] = "debug"
)

Continue = "Stop"
 = Split-Path -Parent (Split-Path -Parent System.Management.Automation.InvocationInfo.MyCommand.Path)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " SillyTavern Mobile APK Builder" -ForegroundColor Cyan  
Write-Host " Build type: " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Set-Location 

# Step 1: Install dependencies
Write-Host "
[1/6] Installing production dependencies..." -ForegroundColor Yellow
npm ci --omit=dev --ignore-scripts --no-save --no-audit --no-fund 2>&1 | Write-Host
if ( -ne 0) {
    Write-Host "npm ci failed. Trying npm install..." -ForegroundColor Red
    npm install --omit=dev --ignore-scripts --no-save --no-audit --no-fund 2>&1 | Write-Host
}

# Step 2: Pre-compile webpack bundle
Write-Host "
[2/6] Pre-compiling webpack bundle..." -ForegroundColor Yellow
node -e "const wp = require('webpack'); const config = require('./webpack.config.js'); wp(config, (err, stats) => { if (err) { console.error(err); process.exit(1); } if (stats.hasErrors()) { console.error(stats.toString()); process.exit(1); } console.log('Webpack bundle compiled successfully'); });"
if ( -ne 0) {
    Write-Host "Webpack compilation failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Prepare assets directory
Write-Host "
[3/6] Preparing assets..." -ForegroundColor Yellow
 = Join-Path  "android\app\src\main\assets\sillytavern"
if (Test-Path ) {
    Remove-Item  -Recurse -Force
}
New-Item -ItemType Directory -Path  -Force | Out-Null

# Copy server files
 = @("src", "public", "default", "node_modules", "data")
 = @("server.js", "package.json", "jsconfig.json")

foreach ( in ) {
     = Join-Path  
     = Join-Path  
    if (Test-Path ) {
        Write-Host "  Copying ..." -ForegroundColor Gray
        Copy-Item   -Recurse -Force
    }
}

# Copy mobile entry point
 = Join-Path  "mobile"
if (-not (Test-Path )) {
    New-Item -ItemType Directory -Path  -Force | Out-Null
}
Copy-Item (Join-Path  "mobile\start-mobile.js")  -Force

foreach ( in ) {
     = Join-Path  
     = Join-Path  
    if (Test-Path ) {
        Copy-Item   -Force
    }
}

# Copy config.mobile.yaml as the active default
Copy-Item (Join-Path  "default\config.mobile.yaml") (Join-Path  "default\config.yaml") -Force

# Remove unnecessary files
 = @("*.md", "*.bat", "*.cmd", "*.sh", "Dockerfile", ".dockerignore",
    ".editorconfig", ".eslintrc.cjs", ".gitignore", ".npmignore", ".npmrc",
    ".replit", "replit.nix", "index.d.ts", "tests", ".github", ".vscode", ".gemini",
    "docker", "colab", "plugins.js", "recover.js", "Remote-Link.cmd",
    "UpdateAndStart.bat", "UpdateForkAndStart.bat", "webpack.config.js")

foreach ( in ) {
    Get-ChildItem  -Filter  -Recurse -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Shrink node_modules
 = @("*.md", "LICENSE", "CHANGELOG*", "README*", ".travis*", "Makefile",
    "gulpfile*", "Gruntfile*", ".eslintrc*", ".jscsrc", ".jshintrc", "tsconfig.json",
    ".github", "test", "tests", "__tests__", "docs", "coverage", ".nyc_output")

foreach ( in ) {
    Get-ChildItem (Join-Path  "node_modules") -Filter  -Recurse -Force |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 4: Download Node.js binary for ARM64
Write-Host "
[4/6] Setting up Node.js binary..." -ForegroundColor Yellow
 = Join-Path  "node"
 = Join-Path  "arm64-v8a"
New-Item -ItemType Directory -Path  -Force | Out-Null

 = Join-Path  "node"
 = Join-Path  "mobile\node-bin\node-arm64"

if (Test-Path ) {
    Copy-Item   -Force
    Write-Host "  Using pre-downloaded Node.js binary" -ForegroundColor Green
} else {
    Write-Host "  WARNING: No pre-downloaded Node.js binary found." -ForegroundColor Red
    Write-Host "  Place the Node.js ARM64 binary at: mobile/node-bin/node-arm64" -ForegroundColor Yellow
    Write-Host "  Download from: https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-arm64.tar.xz" -ForegroundColor Yellow
    Write-Host "  Or build from: https://github.com/nickelc/nodejs-mobile" -ForegroundColor Yellow
    
    # Check if we're in a CI environment with Android NDK
     = 
    if (-not  -and ) {
         = Join-Path  "ndk"
    }
    
    if (-not (Test-Path )) {
        Write-Host "
  Attempting to download Node.js for ARM64..." -ForegroundColor Yellow
         = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-arm64.tar.xz"
         = Join-Path C:\Users\ciel\AppData\Local\Temp "nodejs-mobile-download"
        New-Item -ItemType Directory -Path  -Force | Out-Null
        
        try {
            Write-Host "  Downloading from ..." -ForegroundColor Gray
             = Join-Path  "node.tar.xz"
            Invoke-WebRequest -Uri  -OutFile  -UseBasicParsing
            
            Write-Host "  NOTE: This downloads the stock Node.js Linux ARM64 binary." -ForegroundColor Yellow
            Write-Host "  For production, use a nodejs-mobile compiled binary." -ForegroundColor Yellow
            
            # Extract using tar (available on Windows 10+)
             = Join-Path  "extracted"
            New-Item -ItemType Directory -Path  -Force | Out-Null
            tar -xf  -C 
            
            # Find the node binary
             = Get-ChildItem  -Filter "node" -Recurse | 
                Where-Object { -not .PSIsContainer } | Select-Object -First 1
            
            if () {
                Copy-Item .FullName  -Force
                Write-Host "  Node.js binary extracted successfully!" -ForegroundColor Green
            }
            
            Remove-Item  -Recurse -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host "  Failed to download Node.js: " -ForegroundColor Red
            Write-Host "  Please manually place the Node.js ARM64 binary at: " -ForegroundColor Red
            Remove-Item  -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Step 5: Sync Capacitor
Write-Host "
[5/6] Syncing Capacitor..." -ForegroundColor Yellow
npx cap sync android 2>&1 | Write-Host

# Step 6: Build APK
Write-Host "
[6/6] Building APK..." -ForegroundColor Yellow
 = if ( -eq "release") { "assembleRelease" } else { "assembleDebug" }
Set-Location (Join-Path  "android")

# Try gradlew first, fall back to gradle
if (Test-Path ".\gradlew.bat") {
    .\gradlew.bat  2>&1 | Write-Host
} elseif (Test-Path ".\gradlew") {
    bash ./gradlew  2>&1 | Write-Host
} else {
    gradle  2>&1 | Write-Host
}

if ( -eq 0) {
     = Join-Path  "android\app\build\outputs\apk\"
     = Get-ChildItem  -Filter "*.apk" | Select-Object -First 1
    
    Write-Host "
========================================" -ForegroundColor Green
    Write-Host " Build Successful!" -ForegroundColor Green
    Write-Host " APK: " -ForegroundColor Green
    Write-Host " Size: 0 MB" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "
========================================" -ForegroundColor Red
    Write-Host " Build Failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}

Set-Location 
