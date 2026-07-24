@echo off
pushd %~dp0
set NODE_ENV=production
call bun install --no-save --no-audit --no-fund --loglevel=error --no-progress --omit=dev --ignore-scripts
bun server.js %*
pause
popd
