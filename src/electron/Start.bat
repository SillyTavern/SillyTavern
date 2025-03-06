@echo off
pushd %~dp0
call npm install --no-audit --no-fund --loglevel=error --no-progress
npm run start server.js %*
pause
popd