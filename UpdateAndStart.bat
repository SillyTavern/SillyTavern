@echo off
pushd %~dp0
git --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Git is not installed on this system. Skipping update.
    echo If you installed with a zip file, you will need to download the new zip and install it manually.
) else (
    call git pull --rebase --autostash
    if %errorlevel% neq 0 (
        REM incase there is still something wrong
        echo There were errors while updating. Please download the latest version manually.
    )
)
call npm install
node server.js %*
pause
popd
