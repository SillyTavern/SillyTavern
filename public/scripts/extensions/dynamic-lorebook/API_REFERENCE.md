# Dynamic Lorebook Manager - API Reference

This document details all API calls, event handlers, and integration points with SillyTavern.

## Table of Contents

1. [SillyTavern API Integration](#sillytavern-api-integration)
2. [Event System](#event-system)
3. [World Info API](#world-info-api)
4. [Chat API Integration](#chat-api-integration)
5. [Extension API](#extension-api)
6. [Internal Module APIs](#internal-module-apis)

---

## SillyTavern API Integration

### Imported Functions from SillyTavern

These functions are imported from SillyTavern's core modules.

#### From `world-info.js`

```javascript
import {
    loadWorldInfo,          // Load a lorebook by name
    saveWorldInfo,          // Save lorebook changes
    getSortedEntries,       // Get all active entries
    worldInfoCache,         // Cache for loaded lorebooks
    createWorldInfoEntry,   // Create new entry
    deleteWorldInfoEntry,   // Delete entry
    worldInfoBuffer,        // Access scan buffer
    checkWorldInfo,         // Trigger world info scan
    eventSource,            // Event emitter
    event_types,            // Event type constants
} from '../world-info.js';
```

**API Functions:**

##### `loadWorldInfo(name)`

Loads a lorebook from storage.

**Parameters:**
- `name` (string): Lorebook file name (without .json)

**Returns:**
- `Promise<WorldInfoData>`: Lorebook data object

**Example:**
```javascript
const lorebook = await loadWorldInfo('FantasyWorld');
console.log(lorebook.entries); // { 0: {...}, 1: {...}, ... }
```

**Caching:**
- Results are cached in `worldInfoCache`
- Cache uses StructuredCloneMap for deep cloning

---

##### `saveWorldInfo(name, data, immediately)`

Saves lorebook changes to storage.

**Parameters:**
- `name` (string): Lorebook file name
- `data` (WorldInfoData): Complete lorebook data
- `immediately` (boolean): If true, saves immediately. If false, debounced (1000ms)

**Returns:**
- `Promise<void>`

**Example:**
```javascript
// Immediate save
await saveWorldInfo('FantasyWorld', lorebookData, true);

// Debounced save (waits 1 second)
await saveWorldInfo('FantasyWorld', lorebookData, false);
```

**Side Effects:**
- Emits `WORLDINFO_UPDATED` event
- Updates `worldInfoCache`
- Writes to `/api/worldinfo/edit` endpoint

---

##### `getSortedEntries()`

Gets all currently active lorebook entries sorted by priority.

**Parameters:** None

**Returns:**
- `Promise<WorldInfoEntry[]>`: Array of entries

**Sorting Strategy:**
- Respects `world_info_insertion_strategy` setting
- Orders: evenly, character_first, global_first
- Final order: [chat entries, persona entries, ...rest]

**Example:**
```javascript
const entries = await getSortedEntries();
console.log(entries.length); // Total active entries
```

---

##### `createWorldInfoEntry(name, data)`

Creates a new entry in a lorebook.

**Parameters:**
- `name` (string): Lorebook file name
- `data` (WorldInfoData): Lorebook data object

**Returns:**
- `WorldInfoEntry`: The newly created entry

**Example:**
```javascript
const lorebook = await loadWorldInfo('MyWorld');
const newEntry = createWorldInfoEntry('MyWorld', lorebook);
newEntry.key = ['crystal lake'];
newEntry.content = 'A mystical lake...';
await saveWorldInfo('MyWorld', lorebook, true);
```

---

#### From `script.js`

```javascript
import {
    getRequestHeaders,      // Get auth headers for API calls
    getContext,             // Get context object
    eventSource,            // Global event emitter
    event_types,            // Event type constants
    substituteParams,       // Substitute macros in text
} from '../../script.js';
```

##### `getRequestHeaders()`

Returns headers required for authenticated API calls.

**Returns:**
- `Object`: Headers object

**Example:**
```javascript
const headers = getRequestHeaders();
// { 'Content-Type': 'application/json', 'X-CSRF-Token': '...', ... }

const response = await fetch('/api/worldinfo/get', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ name: 'MyWorld' })
});
```

---

##### `getContext()`

Returns the global context object with extensive API surface.

**Returns:**
- `Object`: Context object with 150+ properties/methods

**Relevant Properties:**
```javascript
const context = getContext();

context.chat                    // Current chat messages
context.characters              // Character list
context.name1                   // User name
context.name2                   // Character name
context.characterId             // Active character ID
context.groupId                 // Group chat ID (if applicable)
context.chatId                  // Active chat ID
context.maxContext              // Context size limit
context.generate                // Generate function
context.sendSystemMessage       // Show system message
```

---

## Event System

### Subscribing to Events

```javascript
import { eventSource, event_types } from '../../script.js';

// Subscribe
eventSource.on(event_types.WORLDINFO_ACTIVATED, handleActivation);

// Unsubscribe
eventSource.off(event_types.WORLDINFO_ACTIVATED, handleActivation);

// One-time listener
eventSource.once(event_types.MESSAGE_RECEIVED, handleMessage);
```

### Event Types Used

#### `WORLDINFO_ACTIVATED`

Fired when lorebook entries are activated during prompt generation.

**When:** During `checkWorldInfo()` execution

**Payload:**
```typescript
{
    entries: ActivatedEntry[],      // Activated entries with match info
    scanState: ScanState,            // Scan metadata
    timestamp: number
}
```

**Handler Example:**
```javascript
function handleActivation(data) {
    console.log(`${data.entries.length} entries activated`);

    for (const entry of data.entries) {
        console.log(`Entry ${entry.uid}: ${entry.comment}`);
        console.log(`Matched keyword: ${entry.matchedKey}`);
    }

    console.log(`Scan depth: ${data.scanState.depth}`);
    console.log(`Budget used: ${data.scanState.budgetUsed}%`);
}

eventSource.on(event_types.WORLDINFO_ACTIVATED, handleActivation);
```

**Note:** This event fires BEFORE the actual generation, so the message ID is not yet available.

---

#### `MESSAGE_RECEIVED`

Fired when the AI completes a response.

**When:** After generation completes

**Payload:**
```typescript
{
    messageId: string,
    text: string,
    isUser: boolean,
    characterName: string,
    timestamp: number
}
```

**Handler Example:**
```javascript
function handleMessageReceived(data) {
    if (data.isUser) return; // Skip user messages

    console.log(`AI message received: ${data.messageId}`);
    console.log(`Text: ${data.text.substring(0, 100)}...`);

    // Trigger analysis
    analyzer.analyzeMessage(data.messageId, data.text);
}

eventSource.on(event_types.MESSAGE_RECEIVED, handleMessageReceived);
```

---

#### `GENERATION_STARTED`

Fired when generation begins.

**When:** At start of generation

**Payload:**
```typescript
{
    type: GenerationTrigger,  // 'normal', 'continue', etc.
    timestamp: number
}
```

**Use Case:** Track pending generations to correlate activations with messages.

---

#### `WORLDINFO_UPDATED`

Fired when any lorebook is modified.

**When:** After `saveWorldInfo()` completes

**Payload:**
```typescript
{
    worldName: string,
    data: WorldInfoData,
    source: 'user' | 'extension' | 'import'
}
```

**Handler Example:**
```javascript
function handleWorldInfoUpdated(data) {
    if (data.source === 'extension') {
        // Our own update, skip
        return;
    }

    // External update, may need to refresh cache
    console.log(`Lorebook "${data.worldName}" was updated externally`);
}

eventSource.on(event_types.WORLDINFO_UPDATED, handleWorldInfoUpdated);
```

---

#### `CHARACTER_MESSAGE_RENDERED`

Fired when a message is rendered in the UI.

**When:** After message HTML is added to DOM

**Payload:**
```typescript
{
    messageId: string,
    element: HTMLElement
}
```

**Use Case:** Add UI hooks (e.g., "Analyze this message" button).

**Handler Example:**
```javascript
function handleMessageRendered(data) {
    const button = document.createElement('button');
    button.textContent = '🔍 Analyze';
    button.onclick = () => triggerAnalysis(data.messageId);

    data.element.appendChild(button);
}

eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, handleMessageRendered);
```

---

### Emitting Events

#### Custom Extension Events

```javascript
// Define custom event type
const EXTENSION_EVENTS = {
    ANALYSIS_STARTED: 'dynamic_lorebook_analysis_started',
    ANALYSIS_COMPLETED: 'dynamic_lorebook_analysis_completed',
    SUGGESTION_GENERATED: 'dynamic_lorebook_suggestion_generated',
    UPDATE_APPLIED: 'dynamic_lorebook_update_applied',
};

// Emit event
eventSource.emit(EXTENSION_EVENTS.ANALYSIS_STARTED, {
    messageId: 'msg_123',
    entriesCount: 3,
    timestamp: Date.now()
});

// Listen to own events
eventSource.on(EXTENSION_EVENTS.ANALYSIS_COMPLETED, (data) => {
    console.log(`Analysis completed for ${data.messageId}`);
});
```

---

## World Info API

### Backend API Endpoints

These endpoints are provided by SillyTavern's backend.

#### `POST /api/worldinfo/list`

Lists all lorebooks in the user's worlds directory.

**Request:**
```javascript
const response = await fetch('/api/worldinfo/list', {
    method: 'POST',
    headers: getRequestHeaders()
});

const worlds = await response.json();
```

**Response:**
```json
[
    {
        "name": "FantasyWorld",
        "uid": "FantasyWorld"
    },
    {
        "name": "SciFiWorld",
        "uid": "SciFiWorld"
    }
]
```

---

#### `POST /api/worldinfo/get`

Fetches a specific lorebook.

**Request:**
```javascript
const response = await fetch('/api/worldinfo/get', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ name: 'FantasyWorld' })
});

const lorebook = await response.json();
```

**Response:**
```json
{
    "entries": {
        "0": {
            "uid": 0,
            "key": ["keyword1"],
            "content": "...",
            ...
        },
        "1": { ... }
    }
}
```

---

#### `POST /api/worldinfo/edit`

Saves lorebook changes.

**Request:**
```javascript
const response = await fetch('/api/worldinfo/edit', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
        name: 'FantasyWorld',
        data: lorebookData
    })
});
```

**Response:**
```json
{
    "success": true
}
```

**Note:** Uses `write-file-atomic` for atomicity.

---

#### `POST /api/worldinfo/delete`

Deletes a lorebook.

**Request:**
```javascript
const response = await fetch('/api/worldinfo/delete', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ name: 'FantasyWorld' })
});
```

---

## Chat API Integration

### Sending Analysis Requests

The extension uses the active chat API to send analysis requests.

#### Getting the Chat API Client

```javascript
import { getContext } from '../../script.js';

const context = getContext();
const apiType = context.main_api; // 'openai', 'claude', 'kobold', etc.
```

#### Example: OpenAI API

```javascript
async function sendAnalysisRequest(prompt) {
    const response = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            model: 'gpt-4-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a lorebook analysis assistant.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: 'json_object' }
        })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}
```

#### Example: Claude API

```javascript
async function sendAnalysisRequest(prompt) {
    const response = await fetch('/api/anthropic/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            model: 'claude-3-opus',
            prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
            max_tokens_to_sample: 1000,
            temperature: 0.3,
            stop_sequences: ['\n\nHuman:']
        })
    });

    const data = await response.json();
    return JSON.parse(data.completion);
}
```

#### Abstraction Layer

```javascript
class ChatAPIClient {
    constructor() {
        this.context = getContext();
        this.apiType = this.context.main_api;
    }

    async sendRequest(prompt, options = {}) {
        switch (this.apiType) {
            case 'openai':
                return this.sendOpenAI(prompt, options);
            case 'claude':
                return this.sendClaude(prompt, options);
            case 'kobold':
                return this.sendKobold(prompt, options);
            case 'textgenerationwebui':
                return this.sendTextGen(prompt, options);
            default:
                throw new Error(`Unsupported API type: ${this.apiType}`);
        }
    }

    async sendOpenAI(prompt, options) {
        // OpenAI implementation
    }

    async sendClaude(prompt, options) {
        // Claude implementation
    }

    // ... other implementations
}
```

---

## Extension API

### Extension Registration

Extensions register with SillyTavern via the manifest.json and an initialization function.

#### manifest.json

```json
{
    "display_name": "Dynamic Lorebook Manager",
    "loading_order": 100,
    "requires": [],
    "optional": [],
    "js": "index.js",
    "css": "styles/main.css",
    "author": "Your Name",
    "version": "1.0.0",
    "homePage": "https://github.com/...",
    "description": "Automatically detect and update lorebook entries based on AI responses"
}
```

#### index.js Entry Point

```javascript
(async function() {
    'use strict';

    // Import dependencies
    const { loadWorldInfo, saveWorldInfo, eventSource, event_types } = await import('../world-info.js');
    const { getRequestHeaders, getContext } = await import('../../script.js');

    // Extension state
    let extensionSettings = {};
    let extensionInitialized = false;

    // Main initialization function
    async function init() {
        // Load settings
        extensionSettings = await loadExtensionSettings();

        // Initialize modules
        await initializeModules();

        // Register event handlers
        registerEventHandlers();

        // Initialize UI
        await initializeUI();

        extensionInitialized = true;
        console.log('Dynamic Lorebook Manager initialized');
    }

    // Auto-initialize when script loads
    await init();
})();
```

### Extension Settings API

#### Loading Settings

```javascript
async function loadExtensionSettings() {
    const response = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders()
    });

    const data = await response.json();
    return data.extension_settings?.dynamic_lorebook || getDefaultSettings();
}
```

#### Saving Settings

```javascript
async function saveExtensionSettings(settings) {
    const response = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders()
    });

    const data = await response.json();
    data.extension_settings = data.extension_settings || {};
    data.extension_settings.dynamic_lorebook = settings;

    await fetch('/api/settings/set', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(data)
    });
}
```

---

## Internal Module APIs

### EntryDetector API

```typescript
class EntryDetector {
    /**
     * Handle WORLDINFO_ACTIVATED event
     */
    onActivation(data: WorldInfoActivatedPayload): void;

    /**
     * Get activations for a specific message
     */
    getActivationsForMessage(messageId: string): ActivationRecord | null;

    /**
     * Get all activations in time range
     */
    getActivationsInRange(startTime: number, endTime: number): ActivationRecord[];

    /**
     * Clear activation history
     */
    clearHistory(): void;

    /**
     * Prune old activations (keep last N)
     */
    pruneHistory(keepCount: number): void;

    /**
     * Get statistics
     */
    getStats(): {
        totalActivations: number;
        averageEntriesPerActivation: number;
        mostActivatedEntries: Array<{ uid: number; count: number }>;
    };
}
```

**Usage:**
```javascript
const detector = new EntryDetector();

// Subscribe to events
eventSource.on(event_types.WORLDINFO_ACTIVATED, (data) => {
    detector.onActivation(data);
});

// Later, get activations
const activations = detector.getActivationsForMessage('msg_123');
```

---

### ResponseAnalyzer API

```typescript
class ResponseAnalyzer {
    constructor(apiClient: ChatAPIClient, settings: ExtensionSettings);

    /**
     * Analyze a message
     */
    async analyzeMessage(
        messageText: string,
        activations: ActivationRecord
    ): Promise<AnalysisResult>;

    /**
     * Build analysis prompt
     */
    buildAnalysisPrompt(
        messageText: string,
        activations: ActivationRecord
    ): string;

    /**
     * Parse LLM response
     */
    parseAnalysisResult(rawResult: string): AnalysisResult;

    /**
     * Clear analysis cache
     */
    clearCache(): void;

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        hitRate: number;
        missRate: number;
    };
}
```

**Usage:**
```javascript
const analyzer = new ResponseAnalyzer(apiClient, settings);

const result = await analyzer.analyzeMessage(
    "Eldoria is a magical forest...",
    activationRecord
);

console.log(`Found ${result.updates.length} updates`);
```

---

### UpdateSuggester API

```typescript
class UpdateSuggester {
    constructor(settings: ExtensionSettings);

    /**
     * Generate suggestions from analysis
     */
    generateSuggestions(analysis: AnalysisResult): Suggestion[];

    /**
     * Filter suggestions by confidence
     */
    filterByConfidence(suggestions: Suggestion[], threshold: number): Suggestion[];

    /**
     * Rank suggestions by priority
     */
    rankSuggestions(suggestions: Suggestion[]): Suggestion[];

    /**
     * Calculate impact score
     */
    calculateImpact(suggestion: Suggestion): number;

    /**
     * Enrich suggestion with metadata
     */
    enrichSuggestion(suggestion: Suggestion): Suggestion;
}
```

---

### LorebookUpdater API

```typescript
class LorebookUpdater {
    constructor(worldInfoAPI: WorldInfoAPI);

    /**
     * Apply a single suggestion
     */
    async applySuggestion(suggestion: Suggestion): Promise<UpdateResult>;

    /**
     * Apply multiple suggestions (batch)
     */
    async applySuggestions(suggestions: Suggestion[]): Promise<UpdateResult[]>;

    /**
     * Batch update single lorebook
     */
    async batchUpdateLorebook(
        worldName: string,
        suggestions: Suggestion[]
    ): Promise<BatchUpdateResult>;

    /**
     * Restore from backup
     */
    async restoreBackup(backup: EntryChange): Promise<void>;

    /**
     * Update keywords
     */
    updateKeywords(entry: WorldInfoEntry, suggestion: Suggestion): void;

    /**
     * Record update in history
     */
    async recordUpdate(
        suggestion: Suggestion,
        backup: Partial<WorldInfoEntry>,
        newState: Partial<WorldInfoEntry>
    ): Promise<void>;
}
```

---

### UpdateHistory API

```typescript
class UpdateHistory {
    constructor(storageKey?: string);

    /**
     * Add update to history
     */
    async addUpdate(record: UpdateRecord): Promise<void>;

    /**
     * Undo last update
     */
    async undo(): Promise<UpdateRecord | null>;

    /**
     * Redo last undone update
     */
    async redo(): Promise<UpdateRecord | null>;

    /**
     * Check if can undo
     */
    canUndo(): boolean;

    /**
     * Check if can redo
     */
    canRedo(): boolean;

    /**
     * Get history
     */
    getHistory(): UpdateRecord[];

    /**
     * Clear history
     */
    clearHistory(): void;

    /**
     * Export history to JSON
     */
    exportHistory(): string;

    /**
     * Import history from JSON
     */
    importHistory(json: string): void;
}
```

---

## Error Handling

### Error Types

```typescript
class ExtensionError extends Error {
    constructor(
        message: string,
        public code: string,
        public severity: 'low' | 'medium' | 'high',
        public recoverable: boolean
    ) {
        super(message);
        this.name = 'ExtensionError';
    }
}

class APIError extends ExtensionError {
    constructor(message: string, public statusCode: number) {
        super(message, 'API_ERROR', 'high', true);
    }
}

class ValidationError extends ExtensionError {
    constructor(message: string, public field: string) {
        super(message, 'VALIDATION_ERROR', 'medium', true);
    }
}
```

### Error Handler

```javascript
function handleError(error, context) {
    console.error(`[Dynamic Lorebook] Error in ${context}:`, error);

    if (error instanceof APIError) {
        showNotification(`API Error: ${error.message}`, 'error');

        if (error.recoverable) {
            // Retry logic
        }
    } else if (error instanceof ValidationError) {
        showNotification(`Validation Error: ${error.message}`, 'warning');
    } else {
        showNotification(`Unexpected error: ${error.message}`, 'error');
    }

    // Log to extension error log
    logError(error, context);
}
```

---

## API Response Formats

### Success Response

```json
{
    "success": true,
    "data": { ... },
    "timestamp": 1710432000000
}
```

### Error Response

```json
{
    "success": false,
    "error": {
        "code": "ENTRY_NOT_FOUND",
        "message": "Entry with UID 5 not found in lorebook",
        "details": { ... }
    },
    "timestamp": 1710432000000
}
```

---

This API reference provides complete documentation for all integration points, function signatures, and usage patterns for the Dynamic Lorebook Manager extension.
