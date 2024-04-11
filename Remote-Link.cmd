@echo off
echo ========================================================================================================================
echo WARNING: Cloudflare Tunnel!
echo ========================================================================================================================
echo This script downloads and runs the latest cloudflared.exe from Cloudflare to set up an HTTPS tunnel to your SillyTavern!
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
if not exist cloudflared.exe curl -Lo cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
cloudflared.exe tunnel --url localhost:8000
