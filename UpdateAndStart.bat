@echo off
pushd %~dp0
git --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Git is not installed on this system. Skipping update.
) else (
    call git pull --rebase --autostash
    if %errorlevel% neq 0 (
        REM incase we get merge conflicts or something
        echo There were errors while updating. Please download the latest version manually.
    )
)
call npm install
node server.js
pause
popd