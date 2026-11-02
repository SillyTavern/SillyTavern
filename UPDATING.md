# Updating EasierTavern

Back up your user data before an update. The simplified settings page can create a downloadable backup; the default on-disk user data is stored under `data/`.

## Normal update

If you installed EasierTavern with Git and have not modified tracked files:

```bash
git pull --rebase
npm install --no-save --omit=dev --ignore-scripts
```

Restart the server after the commands finish. On Windows, `UpdateAndStart.bat` performs the pull, dependency installation, and startup. Review incoming changes before running an update in a sensitive deployment.

If Git reports local changes or conflicts, do not delete your `data` directory and do not use `git reset --hard` as a general fix. Commit or safely copy your changes, then resolve the conflict or reinstall the application in a new directory and move only the user data described below.

## Updating a source archive installation

Git installations are recommended. For an archive-based installation:

1. Download and extract the new EasierTavern revision into a new directory.
2. Run the normal dependency installation in that directory.
3. Stop the old server.
4. Copy the old installation's `data` directory into the new installation.
5. Copy intentional deployment configuration separately and review it against the new defaults.
6. Start the new installation and verify your chats, characters, personas, lorebooks, and provider settings before deleting the old directory.

Do not copy the entire old `public` directory over a new installation. Doing so can overwrite updated application files and remove fork features.

## Synchronizing with SillyTavern upstream

This section is for fork maintainers, not normal users. Keep the EasierTavern remote as `origin` and add SillyTavern as `upstream`:

```bash
git remote add upstream https://github.com/SillyTavern/SillyTavern.git
git fetch upstream
```

Integrate a reviewed upstream revision on a dedicated branch, resolve conflicts carefully, and run both upstream checks and `tests/simple-ui.e2e.js`. The simplified interface deliberately changes the root document, first-run flow, default auto-connect setting, localization list, and server routes; these areas require special attention during an upstream sync.

Do not point a normal EasierTavern installation at the upstream `release` branch. Pulling upstream directly can replace EasierTavern-specific files and behavior.
