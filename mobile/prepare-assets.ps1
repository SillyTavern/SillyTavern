# SillyTavern Mobile - Asset Preparation Script
# This script prepares the SillyTavern server files for bundling into the APK
#
# Usage: powershell -File mobile/prepare-assets.ps1
#
# Steps:
# 1. Installs production dependencies
# 2. Pre-compiles the webpack bundle (lib.js)
# 3. Copies server files to android/app/src/main/assets/sillytavern/
# 4. Strips unnecessary files (tests, .git, dev files)

param(
    [string] = "android\app\src\main\assets\sillytavern",
    [string] = "."
)

\Continue = "Stop"

\ = Join-Path  

Write-Host "=== SillyTavern Mobile Asset Preparation ===" -ForegroundColor Cyan

# Step 1: Install production dependencies
Write-Host "
[1/5] Installing production dependencies..." -ForegroundColor Yellow
Set-Location 
npm ci --omit=dev --ignore-scripts --no-save --no-audit --no-fund

# Step 2: Pre-compile webpack bundle
Write-Host "
[2/5] Pre-compiling webpack bundle..." -ForegroundColor Yellow
node -e "const wp = require('webpack'); const config = require('./webpack.config.js'); wp(config, (err, stats) => { if (err) { console.error(err); process.exit(1); } if (stats.hasErrors()) { console.error(stats.toString()); process.exit(1); } console.log('Webpack bundle compiled'); });"

# Step 3: Create target directory
Write-Host "
[3/5] Creating target directory..." -ForegroundColor Yellow
if (Test-Path ) {
    Remove-Item  -Recurse -Force
}
New-Item -ItemType Directory -Path  -Force | Out-Null

# Step 4: Copy server files
Write-Host "
[4/5] Copying server files..." -ForegroundColor Yellow

\ = @(
    "src",
    "public",
    "default",
    "node_modules",
    "data"
)

\ = @(
    "server.js",
    "package.json",
    "jsconfig.json"
)

foreach ( in ) {
     = Join-Path  
     = Join-Path  
    if (Test-Path ) {
        Write-Host "  Copying ..."
        Copy-Item   -Recurse -Force
    }
}

foreach ( in ) {
     = Join-Path  
     = Join-Path  
    if (Test-Path ) {
        Copy-Item   -Force
    }
}

# Step 5: Remove unnecessary files
Write-Host "
[5/5] Removing unnecessary files from target..." -ForegroundColor Yellow

\ = @(
    ".git",
    ".github",
    "tests",
    "colab",
    "docker",
    ".vscode",
    ".gemini",
    "*.md",
    "*.bat",
    "*.cmd",
    "*.sh",
    "Dockerfile",
    ".dockerignore",
    ".editorconfig",
    ".eslintrc.cjs",
    ".npmignore",
    ".npmrc",
    ".replit",
    "replit.nix",
    "index.d.ts",
    "plugins.js",
    "recover.js",
    "Remote-Link.cmd",
    "UpdateAndStart.bat",
    "UpdateForkAndStart.bat",
    "Start.bat",
    "webpack.config.js"
)

foreach ( in ) {
    Get-ChildItem  -Filter  -Recurse -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Remove dev files from node_modules
\ = @("*.md", "LICENSE", "CHANGELOG*", "README*", ".travis*", "Makefile", "gulpfile*", "Gruntfile*", ".eslintrc*", ".jscsrc", ".jshintrc", "tsconfig.json", ".github")
foreach ( in ) {
    Get-ChildItem (Join-Path  "node_modules") -Filter  -Recurse -Force | Remove-Item -Force -ErrorAction SilentlyContinue
}

Write-Host "
=== Asset preparation complete! ===" -ForegroundColor Green
Write-Host "Assets copied to: " -ForegroundColor Green

# Calculate size
 = (Get-ChildItem  -Recurse | Measure-Object -Property Length -Sum).Sum
 = [math]::Round( / 1MB, 2)
Write-Host "Total size:  MB" -ForegroundColor Green
