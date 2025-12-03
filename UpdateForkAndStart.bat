@echo off
@setlocal enabledelayedexpansion
pushd %~dp0

echo Checking Git installation
git --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [91mGit is not installed on this system.[0m
    echo Install it from https://git-scm.com/downloads
    goto end
)

if not exist .git (
    echo [91mNot running from a Git repository. Reinstall using an officially supported method to get updates.[0m
    echo See: https://docs.sillytavern.app/installation/windows/
    goto end
)

REM Checking current branch
FOR /F "tokens=*" %%i IN ('git rev-parse --abbrev-ref HEAD') DO SET CURRENT_BRANCH=%%i
echo Current branch: %CURRENT_BRANCH%

REM Checking for automatic branch switching configuration
set AUTO_SWITCH=
FOR /F "tokens=*" %%j IN ('git config --local script.autoSwitch') DO SET AUTO_SWITCH=%%j

SET TARGET_BRANCH=%CURRENT_BRANCH%

if NOT "!AUTO_SWITCH!"=="" (
    if "!AUTO_SWITCH!"=="s" (
        goto autoswitch-staging
    )
    if "!AUTO_SWITCH!"=="r" (
        goto autoswitch-release
    )

    if "!AUTO_SWITCH!"=="staging" (
        :autoswitch-staging
        echo Auto-switching to staging branch
        git checkout staging
        SET TARGET_BRANCH=staging
        goto update
    )
    if "!AUTO_SWITCH!"=="release" (
        :autoswitch-release
        echo Auto-switching to release branch
        git checkout release
        SET TARGET_BRANCH=release
        goto update
    )

    echo Auto-switching defined to stay on current branch
    goto update
)

if "!CURRENT_BRANCH!"=="staging" (
    echo Staying on the current branch
    goto update
)
if "!CURRENT_BRANCH!"=="release" (
    echo Staying on the current branch
    goto update
)

echo You are not on 'staging' or 'release'. You are on '!CURRENT_BRANCH!'.
set /p "CHOICE=Do you want to switch to 'staging' (s), 'release' (r), or stay (any other key)? "
if /i "!CHOICE!"=="s" (
    echo Switching to staging branch
    git checkout staging
    SET TARGET_BRANCH=staging
    goto update
)
if /i "!CHOICE!"=="r" (
    echo Switching to release branch
    git checkout release
    SET TARGET_BRANCH=release
    goto update
)

echo Staying on the current branch

:update
REM Checking for 'upstream' remote
git remote | findstr "upstream" > nul
if %errorlevel% equ 0 (
    echo Updating and rebasing against 'upstream'
    git fetch upstream
    git rebase upstream/%TARGET_BRANCH% --autostash
    goto install
)

echo Updating and rebasing against 'origin'
git pull --rebase --autostash origin %TARGET_BRANCH%


:install
if %errorlevel% neq 0 (
    echo [91mThere were errors while updating.[0m
    echo See the update FAQ at https://docs.sillytavern.app/usage/update/#common-update-problems
    goto end
)

echo Installing npm packages and starting server
set NODE_ENV=production
call npm install --no-audit --no-fund --loglevel=error --no-progress --omit=dev
node server.js %*

:end
pause
popd
