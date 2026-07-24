@echo off
pushd %~dp0
call bun install --no-save --no-audit --no-fund --loglevel=error --no-progress --omit=dev --ignore-scripts
bun run start server.js %*
pause
popd
