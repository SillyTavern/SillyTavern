@echo off
pushd %~dp0
call npm install --no-audit --no-fund --loglevel=error --no-progress --omit=dev
npm run start server.js %*
pause
popd
