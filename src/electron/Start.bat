@echo off
pushd %~dp0
call npm install --no-save --no-audit --no-fund --loglevel=error --no-progress --omit=dev
call npm run init
npm run start server.js %*
pause
popd
