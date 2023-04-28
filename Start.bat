pushd %~dp0
call npm install
node server.js
pause
popd