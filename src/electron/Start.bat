@echo off
pushd %~dp0
call npm install --no-save --no-audit --no-fund --loglevel=error --no-progress --omit=dev --ignore-scripts
npm run start server.js %*
pause
popd
