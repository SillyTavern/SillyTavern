@echo off
pushd %~dp0
set NODE_ENV=production
call npm install --no-audit --no-fund --quiet --omit=dev
node server.js %*
pause
popd
