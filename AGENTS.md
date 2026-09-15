# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

SillyTavern is an LLM (Large Language Model) frontend for power users. It provides a web-based interface for interacting with various LLM backends (OpenAI, Codex, local models via KoboldAI/Text Generation WebUI, etc.) with extensive customization, character cards, world info, extensions, and multi-user support.

**Key Technologies:**
- Backend: Node.js (ES modules), Express.js
- Frontend: Vanilla JavaScript (ES6), jQuery, Handlebars templates
- Build: Webpack (for bundling public/lib.js)
- Package Manager: npm
- License: AGPL-3.0

## Development Commands

### Starting the Server
```bash
npm start                    # Start server (localhost only)
npm run start:global         # Start server accessible on network
npm run debug                # Start with Node debugger
npm run start:no-csrf        # Start without CSRF protection (NOT recommended)
```

### Code Quality
```bash
npm run lint                 # Run ESLint on all JavaScript files
npm run lint:fix             # Auto-fix ESLint errors where possible
```

**Note:** Always run `npm run lint` before committing. The project uses ESLint with specific rules (4-space indentation, single quotes, semicolons required, trailing commas in multiline).

### Plugin Management
```bash
npm run plugins:update       # Update all installed plugins
npm run plugins:install      # Install plugins
```

### Alternative Runtimes
```bash
npm run start:deno           # Run with Deno
npm run start:bun            # Run with Bun
npm run start:electron       # Run Electron desktop app
```

## Architecture Overview

### Backend Structure (src/)

**Entry Points:**
- `server.js` - CLI entry point, parses command-line args, sets globals
- `src/server-main.js` - Core Express app setup, middleware registration, server startup

**Key Backend Modules:**
- `src/endpoints/` - API route handlers organized by feature (characters, chats, groups, settings, etc.)
- `src/users.js` - Multi-user system, authentication, user directory management
- `src/middleware/` - Express middleware (auth, CSRF, whitelist, rate limiting, etc.)
- `src/util.js` - Common utilities (file operations, logging, version checks)
- `src/constants.js` - System constants and directory structures
- `src/plugin-loader.js` - Server plugin system
- `src/vectors/` - Vector database integration for RAG
- `src/tokenizers/` - Text tokenization for various model formats

**Backend Patterns:**
- RESTful API endpoints under `/api/*`
- Express routers in endpoint files export `router` object
- Multi-user isolation via user handle in paths
- File-based persistence (characters as PNGs, chats as JSONL)
- Extensive middleware stack for security (CSRF, rate limiting, whitelist)

### Frontend Structure (public/)

**Entry Points:**
- `public/index.html` - Main application page
- `public/script.js` - Main application logic (~5000+ lines, bundled by Webpack)
- `public/lib.js` - Third-party library aggregation (lodash, Fuse, DOMPurify, etc.)

**Key Frontend Modules:**
- `public/scripts/openai.js`, `public/scripts/textgen-settings.js` - API backend integrations
- `public/scripts/extensions.js` - Client-side extension loading and management
- `public/scripts/slash-commands.js` - Command parser and executor
- `public/scripts/world-info.js` - Lorebook/world info system
- `public/scripts/events.js` - Event bus (EventEmitter) with 150+ event types
- `public/scripts/st-context.js` - Context object factory (unified API for extensions)
- `public/scripts/custom-request.js` - API request service layer

**Frontend Patterns:**
- Event-driven architecture via `eventSource` (EventEmitter singleton)
- Context object pattern: `getContext()` returns unified API surface
- Modular ES6 modules with explicit imports/exports
- Extension system with manifest-based loading
- API communication via `fetch()` with `getRequestHeaders()` for auth

### Character and Chat System

**Characters:**
- Stored as PNG files in `data/default-user/characters/`
- Metadata embedded in PNG using Tavern Card specification (V1/V2)
- Character data includes: name, description, personality, scenario, first message, example dialogue, tags
- Disk and memory caching for performance (configurable limits)

**Chats:**
- Stored as JSONL (JSON Lines) files: `data/default-user/chats/{character_name}/{chat_name}.jsonl`
- First line: header with metadata (user_name, character_name, chat_metadata)
- Subsequent lines: individual messages (name, is_user, send_date, mes, extra)
- Automatic backups with throttling (configurable interval)
- Support for message swipes (alternative responses)

**Relationship:**
- One character → Many chats (one-to-many)
- Group chats support multiple characters in single conversation
- Chat directory named after character filename

### Extension System

**Client-Side Extensions:**
- Located in `public/scripts/extensions/{extension_name}/`
- Loaded via manifest.json (dependencies, version requirements, assets)
- Can register UI components, slash commands, event listeners
- Access shared API via `getContext()` and `extension_settings` object
- Can be enabled/disabled via UI (triggers page reload)

**Server Plugins:**
- Located in `plugins/` directory
- Must export: `info` object (id, name, description) and `init(router)` function
- Routes available at `/api/plugins/{plugin-id}/{route}`
- Optional `exit()` function for cleanup on shutdown
- Enabled via `enableServerPlugins: true` in config.yaml

### Configuration

**Main Config:** `default/config.yaml` (defaults, should not be edited directly)
**User Config:** `data/default-user/config.yaml` (overrides defaults)

**Important Settings:**
- `listen: false` - Localhost only (set to `true` for network access)
- `port: 8000` - Server port
- `whitelistMode: true` - IP whitelist enabled by default
- `basicAuthMode: false` - Basic authentication disabled
- `enableUserAccounts: false` - Multi-user mode disabled by default
- `enableServerPlugins: false` - Server plugins disabled by default

## Common Development Tasks

### Adding a New API Endpoint

1. Create or modify a file in `src/endpoints/`
2. Export an Express router:
   ```javascript
   import { Router } from 'express';
   export const router = Router();

   router.post('/my-endpoint', async (req, res) => {
       // Implementation
   });
   ```
3. Register the router in `src/server-startup.js` via `setupPrivateEndpoints()`

### Creating a Client-Side Extension

1. Create directory: `public/scripts/extensions/{extension-name}/`
2. Create `manifest.json`:
   ```json
   {
       "display_name": "My Extension",
       "loading_order": 100,
       "requires": [],
       "js": "index.js",
       "css": "style.css"
   }
   ```
3. Create `index.js` that registers with the extension system
4. Extensions load automatically on server restart

### Creating a Server Plugin

1. Create directory: `plugins/{plugin-name}/`
2. Create `index.js`:
   ```javascript
   export const info = {
       id: 'my-plugin',
       name: 'My Plugin',
       description: 'Does something'
   };

   export async function init(router) {
       router.get('/hello', (req, res) => {
           res.send('Hello from plugin!');
       });
   }
   ```
3. Enable in config: `enableServerPlugins: true`
4. Routes available at `/api/plugins/my-plugin/hello`

### Working with Characters

**Reading a character:**
```javascript
// Backend
import { getCharacter } from './src/endpoints/characters.js';
const character = await getCharacter(avatarUrl, userDirectories);

// Frontend
const response = await fetch('/api/characters/get', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ avatar_url: 'character.png' })
});
const character = await response.json();
```

**Character format:** Tavern Card V2 with embedded PNG metadata

### Working with Chats

**Reading messages:**
```javascript
// Backend - chats are JSONL files
const chatPath = path.join(chatsDir, characterName, `${chatName}.jsonl`);
const lines = fs.readFileSync(chatPath, 'utf8').split('\n').filter(Boolean);
const header = JSON.parse(lines[0]);
const messages = lines.slice(1).map(line => JSON.parse(line));

// Frontend
const response = await fetch('/api/chats/get', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ ch_name: characterName, file_name: chatName })
});
const chat = await response.json();
```

## Pull Request Guidelines

**Target Branch:**
- **`staging`** - Default target for 99% of contributions
- **`release`** - Only for README updates, GitHub Actions, or critical hotfixes

**Code Quality:**
- Run `npm run lint` before committing
- Fix all ESLint errors
- Use VS Code autoformat (4-space indentation, single quotes)
- Follow existing naming conventions

**Size Limit:**
- Keep PRs under ~200 lines of code (additions + deletions)
- Split larger changes into multiple PRs
- For substantial features, discuss creating a feature branch first

**PR Description:**
- What is the reason for the change?
- What did you do to achieve this?
- How would a reviewer test the change?

**Before Submitting:**
- Ensure "Allow edits from maintainers" is checked
- Avoid force-pushing after PR is out of draft state
- Test changes locally with `npm start`

## Data Directory Structure

```
data/
└── default-user/              # Default user (or {handle}/ in multi-user mode)
    ├── characters/            # Character PNG files
    ├── chats/                 # Chat JSONL files
    │   └── {character}/       # Per-character chat directory
    ├── groups/                # Group chat definitions
    ├── worlds/                # World info (lorebooks)
    ├── User Avatars/          # User avatar images
    ├── backgrounds/           # Background images
    ├── themes/                # Custom themes
    ├── settings.json          # User settings
    └── stats.json             # Usage statistics
```

## Important Files Reference

**Backend Core:**
- `src/server-main.js:95-470` - Express app setup and middleware
- `src/endpoints/characters.js` - Character CRUD operations
- `src/endpoints/chats.js` - Chat persistence and format conversion
- `src/endpoints/settings.js` - Settings management
- `src/users.js` - User authentication and directory management

**Frontend Core:**
- `public/script.js` - Main application orchestration
- `public/scripts/extensions.js` - Extension loading system
- `public/scripts/events.js` - Event bus with event type constants
- `public/scripts/st-context.js` - Context factory for extensions
- `public/scripts/slash-commands.js` - Command parser

**Configuration:**
- `default/config.yaml` - Server configuration defaults
- `package.json` - Dependencies and npm scripts
- `.eslintrc.cjs` - ESLint rules
- `webpack.config.js` - Webpack bundling for lib.js

## Testing

Currently, there is no automated test suite. Manual testing is expected:
1. Start the server: `npm start`
2. Open browser to `http://localhost:8000`
3. Test affected functionality manually
4. Check browser console for errors
5. Check server console for errors

## Key Dependencies

**Backend:**
- express - Web server framework
- multer - File upload handling
- simple-git - Git operations
- vectra - Vector database for RAG
- sillytavern-transformers - ML models (captioning, classification, etc.)
- archiver - Backup creation
- sanitize-filename - Path security

**Frontend:**
- jQuery - DOM manipulation (legacy but still used)
- Handlebars - Template rendering
- showdown - Markdown to HTML
- DOMPurify - XSS prevention
- Fuse.js - Fuzzy search
- highlight.js - Code highlighting
- localforage - IndexedDB storage

## Security Considerations

- CSRF protection enabled by default (middleware in server-main.js)
- IP whitelist for network access (`whitelistMode: true`)
- File path sanitization via `sanitize-filename`
- Input validation on all endpoints
- Rate limiting support (`rate-limiter-flexible`)
- Helmet.js for security headers
- Never disable CSRF or security checks in production
