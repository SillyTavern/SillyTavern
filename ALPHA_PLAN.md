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
