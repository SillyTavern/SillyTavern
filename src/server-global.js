#!/usr/bin/env node
globalThis.FORCE_GLOBAL_MODE = true;
await import('../server.js');

export {};
