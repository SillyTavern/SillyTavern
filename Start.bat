@echo off
pushd %~dp0
set NODE_ENV=production
node server.js --files--noSandbox %*
pause
popd
