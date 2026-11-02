# Contributing to EasierTavern

Thank you for helping improve EasierTavern. This repository is an independent fork of [SillyTavern](https://github.com/SillyTavern/SillyTavern), so contributions should clearly distinguish fork-specific work from changes that belong upstream.

## Where should a change go?

Open an EasierTavern issue or pull request when the change concerns the simplified interface or compatibility between the simplified and advanced interfaces.

If a bug is reproducible in an unmodified SillyTavern installation, or a feature would benefit SillyTavern generally, consider contributing it to the upstream project first. Follow the upstream project's own contribution rules when doing so. Do not cross-post the same issue to both projects without explaining why.

## Before opening an issue

- Search [existing EasierTavern issues](https://github.com/YusufErenGoc/EasierTavern/issues).
- Update to the latest revision and reproduce the problem again.
- Check whether it occurs in simplified mode, advanced mode, or both.
- Disable third-party extensions when they may be involved.
- Remove API keys, personal chat content, and other secrets from logs and screenshots.

## Development setup

1. Install Git and Node.js 20 or newer.
2. Fork and clone this repository.
3. Install all development dependencies with `npm install`.
4. Create a focused branch for your change.
5. Make the change and add or update tests where practical.
6. Run the relevant checks before submitting:

   ```bash
   npm run lint
   npx playwright test tests/simple-ui.e2e.js
   ```

The Playwright test requires a compatible browser. Set `PLAYWRIGHT_EXECUTABLE_PATH` if the browser is installed in a non-default location.

## Pull-request guidelines

- Target the repository's default branch unless a maintainer requests another branch.
- Keep each pull request focused and explain the reason for the change, the implementation, and how it was tested.
- Preserve compatibility with the canonical SillyTavern runtime and data formats.
- Test both simplified and advanced modes when changing shared behavior.
- Do not commit user data, generated backups, secrets, logs, `node_modules`, or third-party extension data.
- Keep user-facing English copy and Turkish translations in sync when applicable.
- Avoid unrelated formatting or generated-file changes that make upstream synchronization harder.

English is the primary language for code, commit messages, pull requests, and issue discussions. Localization files may use their target language.

## Keeping the fork maintainable

EasierTavern periodically incorporates upstream SillyTavern changes. Fork-specific code should remain isolated where possible, and changes to upstream files should be minimal and documented. If a change intentionally diverges from upstream behavior, state that explicitly in the pull request.

## License

By contributing, you agree that your contribution will be licensed under the [GNU Affero General Public License v3.0](LICENSE). You are responsible for ensuring that you have the right to submit the code and assets you contribute.
