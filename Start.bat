pushd %~dp0
call npm install --no-audit
node server.js --disableCsrf
pause
popd
