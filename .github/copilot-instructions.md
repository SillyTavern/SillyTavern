# Copilot Instructions for SillyTavern

## Project Overview

SillyTavern is a self-hosted AI chat interface (LLM frontend) built with Node.js (Express) on the server and vanilla JavaScript (ES modules) with jQuery on the client. It is licensed under AGPL-3.0.

## Architecture

- **Server** (`server.js`, `src/`): Node.js + Express. Entry point is `server.js`, which delegates to `src/server-main.js`.
  - `src/endpoints/` — Express route handlers, each file exports a `router`.
  - `src/middleware/` — Express middleware functions.
  - `src/util.js` — Shared server-side utility functions.
  - `src/constants.js` — Shared server-side constants.
  - `src/users.js` — User management and authentication.
  - `src/types/` — TypeScript type declarations for server types.
- **Client** (`public/`): Browser-side vanilla JS with jQuery.
  - `public/script.js` — Main client entry point.
  - `public/scripts/` — Client-side modules (ES modules).
  - `public/scripts/extensions/` — Built-in UI extensions; `third-party/` for user-installed ones.
  - `public/lib.js` — Webpack-bundled shared libraries (lodash, DOMPurify, moment, etc.).
  - `public/global.d.ts` — Global TypeScript type declarations for the client.
- **Plugins** (`plugins/`): Optional server plugins loaded at startup when enabled in `config.yaml`.
- **Tests** (`tests/`): Jest unit tests and Playwright E2E tests.
- **Webpack** (`webpack.config.js`): Bundles `public/lib.js` only (not the whole frontend).
- **Config**: Runtime config via `config.yaml` (not committed); default settings in `default/`.

## JavaScript & Code Style

### General Rules

- Use **ES module** syntax (`import`/`export`) everywhere. The project has `"type": "module"` in `package.json`.
- Use **single quotes** for strings.
- Use **semicolons** at the end of statements.
- Use **4-space indentation** (no tabs).
- Use **trailing commas** in multiline structures (objects, arrays, function parameters).
- End files with a **newline**.
- Use **LF** line endings.
- Use **`node:` prefix** for Node.js built-in imports (e.g., `import path from 'node:path'`).
- No trailing whitespace.
- Use **spaces inside object curly braces**: `{ key: value }`.
- Use **spaces around infix operators**: `a + b`, not `a+b`.

### Naming Conventions

- **Variables and functions**: `camelCase` (e.g., `getConfigValue`, `readSecret`).
- **Constants**: `UPPER_SNAKE_CASE` for true constants and enum-like objects (e.g., `SECRET_KEYS`, `PUBLIC_DIRECTORIES`, `EVENT_NAMES`).
- **Client-side legacy**: Some older client code uses `snake_case` for variables (e.g., `power_user`, `event_types`, `this_chid`). Follow the convention of the file you are editing — do not introduce `snake_case` in new code unless extending an existing `snake_case` API.
- **CSS classes and HTML IDs**: `kebab-case`.
- **File names**: `kebab-case` for multi-word names (e.g., `server-main.js`, `content-manager.js`). Some legacy files use `camelCase` — match the surrounding convention.

### Functions & Documentation

- Use **JSDoc** comments for all exported functions, including `@param`, `@returns`, and `@type` annotations. The project uses `eslint-plugin-jsdoc` and has `checkJs: true` in `jsconfig.json` for type checking.
- Use **JSDoc type imports** (`@type {import('express').Request}`) for type annotations.
- Keep functions small and focused. Prefer pure utility functions in `util.js` or `public/scripts/utils.js`.
- Use `async`/`await` for asynchronous code; avoid raw `.then()` chains where possible.

### Error Handling

- Server endpoints: wrap handlers in `try/catch`, send appropriate HTTP error responses with `response.status(code).send(message)`.
- Use `console.error` or the `color` helper from `src/util.js` for server-side error logging.
- Client-side: use `toastr` for user-facing error notifications; `console.error` for developer logging.

### Imports

- Group imports: Node.js built-ins first, then third-party packages, then local modules — separated by blank lines.
- Use named exports/imports where possible. Default exports are used for middleware and some configuration.
- Client-side: prefer **absolute imports** for new files and new code (e.g., `import { ... } from '/script.js'`). The `/` path is aliased to `public/`. Use relative imports only in existing modules that already use relative paths.

## Server-Side Patterns

- Each route module in `src/endpoints/` should export `const router = express.Router()` and register routes on it.
- Use `request.user.directories` to access user-scoped file paths.
- Read secrets with `readSecret(request.user.directories, SECRET_KEYS.*)`.
- Read config values with `getConfigValue(key, defaultValue)` from `src/util.js`.
- Use `sanitize-filename` for any user-provided file names.
- Use `write-file-atomic` for safe file writes.

## Client-Side Patterns

- Import app context values directly from their source modules (e.g., `import { chat, characters } from '/script.js'`). The `SillyTavern.getContext()` API is intended for third-party extensions, not core contributions.
- Import shared npm libraries from `/lib.js` (e.g., `import { lodash, DOMPurify, moment } from '/lib.js'`). The `SillyTavern.libs` object is for bundled extensions, not core code.
- Prefer **vanilla JS** for all new code. Use jQuery only when fixing legacy code that already uses it. Do not rewrite existing jQuery to vanilla unless explicitly instructed.
- Use the `event_types` enum and the `eventSource` (EventEmitter) in `public/scripts/events.js` to subscribe to and emit application events.
- Debounce user input handlers using the `debounce_timeout` enum values from `public/scripts/constants.js`.
- Use `getRequestHeaders()` from `public/script.js` for authenticated API calls to the server.

## Extensions

- UI extensions live in `public/scripts/extensions/` with a `manifest.json` and a JS entry point.
- Server plugins live in `plugins/` and export `init(router)`, `exit()`, and an `info` object with `id`, `name`, `description`.
- Extensions store persistent settings via `extensionSettings[MODULE_NAME]` and call `saveSettingsDebounced()`.
- Use `data-i18n` HTML attributes and the `t` tagged template for translatable strings.

## Linting & Testing

- **Lint**: `npm run lint` (ESLint). Fix with `npm run lint:fix`. Must pass before submitting changes.
- **Tests**: Jest for unit tests (`tests/`), Playwright for E2E tests. Run with the test infrastructure in the `tests/` directory.
Example of correctly formatted code:

```js
import path from 'node:path';

import express from 'express';

import { getConfigValue } from '../util.js';

const MAX_RETRIES = 3;

/**
 * Gets something by its name.
 * @param {import('express').Request} request Express request object
 * @param {string} name The name to look up
 * @returns {object} The result object
 */
function getSomethingByName(request, name) {
    const { directories } = request.user;
    const filePath = path.join(directories.root, name);
    return { name, filePath, isValid: true };
}

export const router = express.Router();

router.post('/something', async (request, response) => {
    try {
        const result = getSomethingByName(request, request.body.name);
        return response.json(result);
    } catch (error) {
        console.error('Something went wrong:', error);
        return response.status(500).send('Internal server error');
    }
});
```
