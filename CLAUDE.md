# CLAUDE.md — SillyTavern Codebase Guide

This file gives AI assistants (and humans) a fast, accurate mental model of the SillyTavern codebase so changes can be made confidently and consistently.

---

## Project Overview

SillyTavern is an **AI chat frontend** (v1.16.0, AGPL-3.0) that acts as a local web server. It connects to dozens of AI backend APIs (OpenAI, Claude, Gemini, KoboldAI, Ollama, etc.) and provides a rich, extensible chat UI for creative roleplay and AI interaction. There is no database — all data is stored as plain files (JSON, YAML, PNG metadata, etc.) under a configurable data directory.

---

## Repository Layout

```
SillyTavern/
├── server.js               # Entry point: parses CLI args, calls src/server-main.js
├── package.json            # Root package — Node ESM, "type": "module"
├── jsconfig.json           # TypeScript-style checking for server-side JS (checkJs)
├── webpack.config.js       # Bundles public/lib.js (third-party libs only)
├── post-install.js         # Runs after npm install
├── plugins.js              # CLI helper for managing server plugins
│
├── src/                    # Server-side Node.js code
│   ├── server-main.js      # Core: Express app setup, middleware, session, CSRF
│   ├── server-startup.js   # Registers all API endpoint routers; handles deprecated redirects
│   ├── server-directory.js # Resolves the server root directory
│   ├── server-events.js    # Server-wide EventEmitter (EVENT_NAMES constants)
│   ├── command-line.js     # CLI argument parser (CommandLineParser)
│   ├── constants.js        # Shared constants: CHAT_COMPLETION_SOURCES, TEXTGEN_TYPES, etc.
│   ├── util.js             # Server utilities: getConfig, color, logging, file helpers
│   ├── users.js            # Multi-user management, directory resolution, auth middleware
│   ├── fetch-patch.js      # Global fetch patching (proxy support)
│   ├── request-proxy.js    # HTTP/HTTPS proxy agent initialization
│   ├── plugin-loader.js    # Loads/unloads server-side plugins
│   ├── express-common.js   # Shared Express helpers (isFirefox detection, etc.)
│   ├── recover.js          # Data recovery utilities
│   │
│   ├── endpoints/          # One Express Router per domain
│   │   ├── backends/       # AI generation backends
│   │   │   ├── chat-completions.js  # OpenAI-style chat completions (Claude, GPT, Gemini, …)
│   │   │   ├── text-completions.js  # Text completion backends (ooba, vLLM, KoboldCPP, …)
│   │   │   └── kobold.js            # KoboldAI legacy API
│   │   ├── anthropic.js    # Anthropic-specific helpers (tokenize, model list)
│   │   ├── openai.js       # OpenAI-specific helpers (model list, image)
│   │   ├── google.js       # Google Gemini-specific helpers
│   │   ├── azure.js        # Azure OpenAI helpers
│   │   ├── characters.js   # Character card CRUD (with disk cache)
│   │   ├── chats.js        # Chat history CRUD
│   │   ├── groups.js       # Group chat management
│   │   ├── worldinfo.js    # World Info / lorebook management
│   │   ├── settings.js     # User settings read/write
│   │   ├── secrets.js      # API key storage (encrypted at rest)
│   │   ├── users-public.js # Public user endpoints (login, session)
│   │   ├── users-private.js# Authenticated user endpoints
│   │   ├── users-admin.js  # Admin-only user management
│   │   ├── extensions.js   # Extension install/update/list
│   │   ├── assets.js       # Character asset (sprite) management
│   │   ├── vectors.js      # Vector/embedding storage
│   │   ├── tokenizers.js   # Server-side tokenization
│   │   ├── translate.js    # Translation API proxies
│   │   ├── speech.js       # TTS/STT endpoints
│   │   ├── stable-diffusion.js  # Image generation proxy
│   │   ├── horde.js        # AI Horde integration
│   │   ├── content-manager.js   # Default content management
│   │   ├── stats.js        # Usage stats
│   │   ├── backups.js      # Chat backup management
│   │   └── ...             # Many more single-responsibility modules
│   │
│   ├── middleware/         # Express middleware
│   │   ├── basicAuth.js    # HTTP Basic Auth
│   │   ├── whitelist.js    # IP whitelist enforcement
│   │   ├── hostWhitelist.js# Host header validation
│   │   ├── corsProxy.js    # CORS proxy for client-side requests
│   │   ├── accessLogWriter.js  # Access log file writer
│   │   ├── cacheBuster.js  # Cache-busting headers
│   │   ├── multerMonkeyPatch.js # Multer upload security patch
│   │   ├── validateFileName.js  # Upload filename validation
│   │   └── webpack-serve.js    # Serves webpack-bundled lib.js
│   │
│   ├── tokenizers/         # Pre-bundled tokenizer model files (.model, .json)
│   └── types/              # JSDoc type definition files (.d.ts)
│
├── public/                 # Frontend (served statically)
│   ├── index.html          # Main SPA entry point
│   ├── login.html          # Login page
│   ├── script.js           # Main frontend script (~12 000 lines)
│   ├── style.css           # Global CSS
│   ├── lib.js              # Third-party library barrel (webpack bundles this → dist/)
│   ├── jsconfig.json       # TypeScript-style checking for frontend JS
│   ├── scripts/            # Frontend modules (one concern per file)
│   │   ├── extensions/     # Built-in extensions
│   │   │   ├── third-party/    # User-installed third-party extensions (git repos)
│   │   │   ├── caption/    # Image captioning
│   │   │   ├── expressions/# Character expression images
│   │   │   ├── memory/     # Long-term memory / summarization
│   │   │   ├── regex/      # Regex substitution rules
│   │   │   ├── tts/        # Text-to-speech
│   │   │   ├── vectors/    # Client-side vector search UI
│   │   │   └── ...
│   │   ├── PromptManager.js   # Chat prompt building and management
│   │   ├── openai.js          # OpenAI/Claude/Gemini client settings
│   │   ├── kai-settings.js    # KoboldAI client settings
│   │   ├── group-chats.js     # Group chat client logic
│   │   ├── world-info.js      # World Info client logic
│   │   ├── macros.js          # Template macro processing
│   │   ├── instruct-mode.js   # Instruct/template formatting
│   │   ├── popup.js           # Modal/popup system
│   │   ├── events.js          # Client-side EventEmitter (eventSource)
│   │   ├── i18n.js            # Internationalization
│   │   └── ...
│   ├── css/                # Component/feature CSS files
│   ├── img/                # Static images
│   └── locales/            # i18n JSON translation files
│
├── tests/                  # Test suite (separate package.json)
│   ├── package.json        # Jest + Playwright devDeps
│   ├── jest.config.json    # Jest config (Node env, no transforms)
│   ├── playwright.config.js# Playwright config (baseURL: localhost:8000)
│   ├── util.test.js        # Unit tests for server utilities
│   ├── mock-server.test.js # Mock server integration tests
│   └── sample.e2e.js       # Playwright E2E smoke test
│
├── default/                # Default/template files (DO NOT EDIT at runtime)
│   ├── config.yaml         # Template server config (copied to data/ on first run)
│   ├── content/            # Default character cards, backgrounds, etc.
│   └── public/             # Default UI assets (overridden by user data)
│
├── data/                   # Runtime data root (git-ignored, user-created)
│   └── default-user/       # Per-user data directory (see USER_DIRECTORY_TEMPLATE)
│
├── docker/                 # Docker support files
├── Dockerfile              # Multi-arch Docker image definition
├── plugins/                # Server plugin directory (git-ignored by default)
└── .github/                # GitHub Actions workflows, PR/issue templates
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18, ESM (`"type": "module"`) |
| Server framework | Express 4 |
| Frontend | Vanilla JS + jQuery (no framework, no transpilation) |
| Templating (frontend) | Handlebars |
| Markdown | Showdown |
| HTML sanitization | DOMPurify |
| Library bundling | Webpack 5 (only for `public/lib.js`) |
| Type checking | JSDoc + `checkJs: true` in jsconfig.json (no TypeScript) |
| Configuration | YAML (`config.yaml`) |
| Unit tests | Jest 29 (with `--experimental-vm-modules`) |
| E2E tests | Playwright |
| Linting | ESLint 8 |
| Image processing | Jimp |
| Git operations | simple-git |

---

## Development Commands

All commands run from the **repository root** unless noted.

```bash
# Install dependencies
npm install

# Start the server (default)
npm start                   # node server.js
npm run debug               # node --inspect server.js (Chrome DevTools)
npm run start:no-csrf       # disable CSRF (convenient during dev)
npm run start:global        # global install mode

# Linting
npm run lint                # ESLint check (src/**/*.js, public/**/*.js, ./*.js)
npm run lint:fix            # ESLint auto-fix

# Tests (run from the tests/ subdirectory)
cd tests && npm install     # install test dependencies (first time)
cd tests && npm test        # run unit + E2E tests
cd tests && npm run test:unit   # Jest unit tests only
cd tests && npm run test:e2e    # Playwright E2E tests only

# Plugin management
node plugins install <url>  # install a server plugin
node plugins update         # update all server plugins
```

> **Note:** E2E tests require a running server at `http://127.0.0.1:8000`.

---

## Configuration System

SillyTavern is configured via **`data/config.yaml`** (never committed). The template lives at `default/config.yaml`.

### Key config sections

| Section | Purpose |
|---|---|
| `dataRoot` | Path to user data directory (default: `./data`) |
| `listen` / `port` | Network binding (default: localhost only, port 8000) |
| `whitelistMode` | IP whitelist (default: enabled, localhost only) |
| `basicAuthMode` | HTTP Basic Auth (default: disabled) |
| `enableUserAccounts` | Multi-user mode (default: disabled) |
| `extensions.enabled` | UI extensions (default: enabled) |
| `enableServerPlugins` | Server-side plugins (default: disabled) |
| `claude` | Anthropic-specific options (prompt cache, TTL) |
| `gemini` | Google Gemini options (API version, safety) |
| `ollama` | Ollama keep-alive / batch size |
| `ssl` | HTTPS (default: disabled) |

### Accessing config in server code

```js
import { getConfigValue } from './util.js';

// getConfigValue(key, default, type)
const port = getConfigValue('port', 8000, 'number');
const listen = getConfigValue('listen', false, 'boolean');
```

### Environment variable overrides

Every config key can be overridden via an environment variable using the pattern:

```
SILLYTAVERN_<UPPERCASE_DOTTED_PATH_AS_UNDERSCORE>
# Example: SILLYTAVERN_PORT=9000
# Example: SILLYTAVERN_SSL_ENABLED=true
```

---

## Data Storage

No database — everything is plain files.

### Per-user directory structure (`data/<user-handle>/`)

Defined by `USER_DIRECTORY_TEMPLATE` in `src/constants.js`:

| Directory | Contents |
|---|---|
| `characters/` | Character card PNG/JSON files |
| `chats/` | Chat history JSON files (per character) |
| `groups/` | Group definitions |
| `group chats/` | Group chat history |
| `worlds/` | World Info / lorebook JSON files |
| `User Avatars/` | User persona avatar images |
| `backgrounds/` | Background images |
| `themes/` | UI theme JSON files |
| `instruct/` | Instruct template presets |
| `context/` | Context template presets |
| `OpenAI Settings/` | OpenAI/Claude/Gemini presets |
| `KoboldAI Settings/` | KoboldAI presets |
| `TextGen Settings/` | Text generation presets |
| `NovelAI Settings/` | NovelAI presets |
| `QuickReplies/` | Quick reply set JSON files |
| `vectors/` | Vectra vector database files |
| `assets/` | Character expression sprites |
| `extensions/` | Per-user third-party extensions |
| `thumbnails/` | Generated image thumbnails |
| `sysprompt/` | System prompt presets |
| `reasoning/` | Reasoning template presets |
| `user/files/` | User-uploaded files |
| `backups/` | Automatic chat backups |

### Global data files

- `data/config.yaml` — server configuration
- `data/cookie-secret.txt` — session cookie secret (auto-generated)
- `data/_uploads/` — temporary Multer upload staging directory

---

## Server Architecture

### Request lifecycle

```
client → [whitelist] → [basicAuth] → [CSRF] → [session] → [requireLogin?]
       → [router] → endpoint handler → file I/O → JSON response
```

### Endpoint pattern

Every endpoint module follows this pattern:

```js
import express from 'express';
export const router = express.Router();

router.post('/some-action', jsonParser, async (req, res) => {
    // req.user is the authenticated user object (from setUserDataMiddleware)
    // req.user.directories contains all per-user paths
    try {
        // ... do work ...
        res.json({ result });
    } catch (error) {
        console.error('Error in some-action:', error);
        res.status(500).send('Internal Server Error');
    }
});
```

### Adding a new endpoint module

1. Create `src/endpoints/your-feature.js` exporting `router`.
2. Import and mount it in `src/server-startup.js`:
   ```js
   import { router as yourFeatureRouter } from './endpoints/your-feature.js';
   // inside setupPrivateEndpoints():
   app.use('/api/your-feature', yourFeatureRouter);
   ```

### Key middleware (applied in order in `src/server-main.js`)

| Middleware | Purpose |
|---|---|
| `helmet` | Security headers |
| `compression` | gzip/brotli response compression |
| `hostWhitelistMiddleware` | Validates `Host` header |
| `accessLoggerMiddleware` | Writes access log to file |
| `basicAuthMiddleware` | Optional HTTP Basic Auth |
| `getWhitelistMiddleware` | IP whitelist check |
| `cors` | CORS headers |
| `cookieSession` | Session management |
| `csrfSync` | CSRF token enforcement |
| `setUserDataMiddleware` | Attaches user object to `req.user` |
| `requireLoginMiddleware` | Redirects unauthenticated requests |

---

## Frontend Architecture

The frontend is a **single-page application** using vanilla JS and jQuery. There is no build step for frontend JS — files are served directly. The exception is `public/lib.js`, which is a barrel file that Webpack bundles into the data directory at startup.

### Key frontend files

| File | Role |
|---|---|
| `public/script.js` | Main application (~12 000 lines): chat loop, character management, generation dispatch |
| `public/scripts/events.js` | Client EventEmitter (`eventSource`) — use instead of jQuery events for cross-module communication |
| `public/scripts/popup.js` | Modal/dialog system — use `Popup` class instead of `alert`/`confirm` |
| `public/scripts/macros.js` | Template macro substitution (`{{char}}`, `{{user}}`, `{{random::…}}`, etc.) |
| `public/scripts/instruct-mode.js` | Prompt formatting for instruct models |
| `public/scripts/PromptManager.js` | Builds the final prompt sent to the AI |
| `public/scripts/openai.js` | Settings and request building for chat-completion backends |
| `public/scripts/world-info.js` | World Info trigger evaluation and prompt injection |
| `public/lib.js` | Third-party library barrel (showdown, moment, DOMPurify, highlight.js, Handlebars, Popper, lodash, …) |

### Extension system

Extensions are self-contained JS modules loaded dynamically:

- **Built-in extensions**: `public/scripts/extensions/<name>/index.js`
- **Third-party extensions**: `public/scripts/extensions/third-party/<name>/index.js` (installed as git repos)
- Each extension calls `registerExtension()` / `addExtensionSettings()` from the extension API.
- Extensions communicate via `eventSource.emit(event_types.EVENT_NAME, ...)`.

---

## Supported AI Backends

### Chat completion backends (`CHAT_COMPLETION_SOURCES` in `src/constants.js`)

`openai`, `claude`, `openrouter`, `makersuite` (Gemini), `vertexai`, `mistralai`, `cohere`, `perplexity`, `groq`, `deepseek`, `xai`, `azure_openai`, `ai21`, `custom`, and many more.

### Text generation backends (`TEXTGEN_TYPES` in `src/constants.js`)

`ooba` (text-generation-webui), `koboldcpp`, `llamacpp`, `ollama`, `vllm`, `aphrodite`, `tabby`, `togetherai`, `huggingface`, `mancer`, and more.

### Other backends

- **Image generation**: Stable Diffusion (A1111/Forge), AUTOMATIC1111, ComfyUI, AI Horde
- **TTS**: ElevenLabs, Edge TTS, Kokoro, Coqui, AllTalk, and others via extension
- **STT**: Whisper (local via Transformers.js), OpenAI Whisper API
- **Embeddings/Vectors**: Local (Transformers.js), OpenAI, Cohere, Google

---

## Code Conventions

### Module system

The entire project uses **ESM** (`import`/`export`). Never use `require()`.

### JSDoc types

Types are documented with JSDoc `@typedef` — there is no TypeScript. Use `/** @type {TypeName} */` annotations. The `jsconfig.json` files enable `checkJs` for IDE support.

```js
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handler(req, res) { ... }
```

### File writes

Always use `write-file-atomic` for safe file writes (prevents corruption on crash):

```js
import { sync as writeFileAtomicSync } from 'write-file-atomic';
writeFileAtomicSync(filePath, JSON.stringify(data, null, 4), 'utf8');
```

### Console output (server)

Use the `color` helper from `src/util.js` for colored server-side log messages:

```js
import { color } from './util.js';
console.log(color.green('Server started'));
console.error(color.red('Something failed'));
```

### Config access

Never read `config.yaml` directly. Use `getConfigValue`:

```js
const value = getConfigValue('some.nested.key', defaultValue, 'string'|'number'|'boolean');
```

### User directories

Access per-user directories through `req.user.directories` in endpoints, or call `getUserDirectories(handle)` from `src/users.js`.

### Error handling in endpoints

Return appropriate HTTP status codes. Do not leak stack traces to clients:

```js
try {
    // ...
} catch (error) {
    console.error('Descriptive message:', error);
    return res.sendStatus(500);
}
```

### File naming

- Server modules: `kebab-case.js`
- Frontend modules: `kebab-case.js`
- Constants: `SCREAMING_SNAKE_CASE`
- Functions/variables: `camelCase`

---

## Security Considerations

- **IP whitelist** is enabled by default — only `127.0.0.1` and `::1` are allowed unless `listen: true` is set.
- **CSRF protection** is active on all state-changing endpoints. Disable only with `--disableCsrf` flag (dev only).
- **File uploads** are validated against `UNSAFE_EXTENSIONS` in `src/constants.js`. Never relax this list.
- **User input** in filenames must go through `sanitize-filename`. Do not construct file paths from raw user input.
- **HTML** from user/AI content must be sanitized with DOMPurify before insertion into the DOM.
- **API keys** are stored via the secrets system (`src/endpoints/secrets.js`), not in plain settings files.

---

## Testing

```bash
cd tests
npm install          # first time only

npm run test:unit    # Jest unit tests (Node environment)
npm run test:e2e     # Playwright E2E (requires server running on :8000)
npm test             # both
```

Unit tests live in `tests/util.test.js` and `tests/mock-server.test.js`.
E2E test entry is `tests/sample.e2e.js`. The Playwright base URL is `http://127.0.0.1:8000`.

---

## CI/CD and Branches

| Branch | Purpose |
|---|---|
| `release` | Stable releases — Docker image tagged `latest` |
| `staging` | Pre-release testing — Docker image tagged `staging` |

**PRs must target `staging`** (not `release`). The `release` branch is reserved for hotfixes, README updates, and GitHub Actions changes.

GitHub Actions:
- **Docker image**: built on push to `release`, daily cron from `staging`, and on GitHub releases. Multi-arch: `linux/amd64` + `linux/arm64`.
- **Issue/PR automation**: auto-labeling, auto-commenting via `.github/workflows/`.

---

## Docker

```bash
# Build image
docker build -t sillytavern .

# Run with docker-compose
docker compose -f docker/docker-compose.yml up

# The entrypoint script is docker/docker-entrypoint.sh
```

The Dockerfile pre-bakes the Webpack output into `/dist/` so the per-user Webpack build is skipped inside containers.

---

## Plugin System

### Server plugins

Node.js modules placed in the `plugins/` directory. Each plugin exports:
- `init(app)` — called with the Express app on startup
- `exit()` — called on server shutdown (optional)

Enable in config: `enableServerPlugins: true`.

### UI extensions

Placed in `public/scripts/extensions/third-party/<name>/`. Install via the Extensions panel in the UI or `node plugins install <git-url>`. Each extension's entry point is `index.js`.

---

## Common Pitfalls

1. **Do not edit files in `default/`** at runtime — they are templates. User data goes in `data/`.
2. **Webpack is only for `public/lib.js`** — don't add frontend JS to the Webpack bundle. Frontend files are served directly.
3. **ESM only** — no `require()`, no CommonJS. Use dynamic `import()` for conditional loading.
4. **`public/script.js` is monolithic** — new frontend features should be added as separate modules in `public/scripts/` and imported into `script.js`, not appended inline.
5. **Multi-user mode** — always resolve file paths through `req.user.directories` instead of hardcoded paths; the same endpoint serves all users.
6. **Character card images** carry embedded JSON metadata in PNG text chunks — use `src/character-card-parser.js` for reading/writing, not raw PNG libraries.
7. **The `staging` branch is for PRs**, not `release`. Keep PRs under ~200 lines; split larger changes.
