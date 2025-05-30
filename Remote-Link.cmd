@echo off
setlocal

set "CLOUDFLARED_VERSION=2025.5.0"
set "CLOUDFLARED_URL=https://github.com/cloudflare/cloudflared/releases/download/%CLOUDFLARED_VERSION%/cloudflared-windows-amd64.exe"
set "EXPECTED_CHECKSUM=27c8c4b706fbe12035eb55b4da208523928e91386c91fd89d1557fecb35cefe6"

echo ========================================================================================================================
echo WARNING: Cloudflare Tunnel!
echo ========================================================================================================================
echo This script will download cloudflared.exe version %CLOUDFLARED_VERSION%.
echo Using the randomly generated temporary tunnel URL, anyone can access your SillyTavern over the Internet while the tunnel
echo is active. Keep the URL safe and secure your SillyTavern installation by setting a username and password in config.yaml!
echo.
echo See https://docs.sillytavern.app/usage/remoteconnections/ for more details about how to secure your SillyTavern install.
echo.
echo By continuing you confirm that you're aware of the potential dangers of having a tunnel open and take all responsibility
echo to properly use and secure it!
echo.
echo To abort, press Ctrl+C or close this window now!
echo.
pause

REM Download cloudflared.exe
if exist cloudflared.exe (
    echo Deleting existing cloudflared.exe...
    del cloudflared.exe
)
echo Downloading cloudflared.exe version %CLOUDFLARED_VERSION% from %CLOUDFLARED_URL%
curl -Lo cloudflared.exe "%CLOUDFLARED_URL%"
if errorlevel 1 (
    echo ERROR: Failed to download cloudflared.exe. Curl errorlevel %errorlevel%.
    goto :cleanup_and_exit
)
if not exist cloudflared.exe (
    echo ERROR: cloudflared.exe not found after download attempt.
    goto :cleanup_and_exit
)

REM Compute SHA256 Hash
echo Computing SHA256 hash for downloaded cloudflared.exe...
set "COMPUTED_CHECKSUM="
for /f "skip=1 tokens=*" %%a in ('certutil -hashfile cloudflared.exe SHA256') do (
    if not defined COMPUTED_CHECKSUM set "COMPUTED_CHECKSUM=%%a"
)

REM Clean up spaces from COMPUTED_CHECKSUM if any (certutil output might have them)
if defined COMPUTED_CHECKSUM (
    set "COMPUTED_CHECKSUM=%COMPUTED_CHECKSUM: =%"
)

echo Expected SHA256: %EXPECTED_CHECKSUM%
echo Computed SHA256: %COMPUTED_CHECKSUM%

REM Compare Hashes
if not "%COMPUTED_CHECKSUM%"=="%EXPECTED_CHECKSUM%" (
    echo =================================================================
    echo ^!^!^! CHECKSUM VERIFICATION FAILED ^!^!^!
    echo The downloaded cloudflared.exe may be compromised or corrupted.
    echo Deleting the downloaded file. Please try again later or
    echo download cloudflared.exe (version %CLOUDFLARED_VERSION%) manually
    echo from the official Cloudflare releases page and verify its
    echo checksum yourself.
    echo =================================================================
    goto :cleanup_and_exit
)

echo Checksum verified successfully.
echo Starting Cloudflare tunnel...
cloudflared.exe tunnel --url localhost:8000
goto :eof

:cleanup_and_exit
if exist cloudflared.exe (
    echo Deleting downloaded cloudflared.exe due to error or failed verification...
    del cloudflared.exe
)

:eof
endlocal
