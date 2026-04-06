@echo off
pushd %~dp0
set NODE_ENV=production
call npm ci --no-save --no-audit --no-fund --loglevel=error --no-progress --omit=dev --ignore-scripts
node server.js %*
pause
popd
