# Dynamic Lorebook Manager - Technical Architecture

## System Overview

The Dynamic Lorebook Manager operates as a real-time analysis layer between the chat generation system and the World Info (lorebook) system. It observes chat events, correlates them with activated lorebook entries, and generates intelligent update suggestions.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SillyTavern Core                              │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐     │
│  │ Chat System  │─────▶│ World Info   │─────▶│ Prompt Gen   │     │
│  └──────────────┘      └──────────────┘      └──────────────┘     │
│         │                      │                      │              │
│         │ Events               │ Events               │ Events       │
└─────────┼──────────────────────┼──────────────────────┼─────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Dynamic Lorebook Manager Extension                      │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Event Listener  │  │ Entry Detector  │  │ Response        │    │
│  │                 │─▶│                 │─▶│ Analyzer        │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│                                                      │                │
│                                                      ▼                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Update History  │◀─│ Lorebook        │◀─│ Update          │    │
│  │                 │  │ Updater         │  │ Suggester       │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│                              │                      │                │
│                              ▼                      ▼                │
│                       ┌─────────────────────────────────┐           │
│                       │     User Interface Layer        │           │
│                       │  - Diff Viewer                  │           │
│                       │  - Approval Dialog              │           │
│                       │  - Settings Panel               │           │
│                       └─────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Event Listener Module

**File:** `src/event-listener.js`

**Purpose:** Central hub for all SillyTavern event subscriptions

**Responsibilities:**
- Subscribe to core SillyTavern events
- Route events to appropriate handlers
- Maintain event history for correlation
- Handle event lifecycle (enable/disable)

**Events Subscribed:**
```javascript
{
  WORLDINFO_ACTIVATED: {
    priority: 'high',
    handler: 'onWorldInfoActivated',
    description: 'Fired when lorebook entries are triggered'
  },

  MESSAGE_RECEIVED: {
    priority: 'high',
    handler: 'onMessageReceived',
    description: 'Fired when AI response is complete'
  },

  GENERATION_STARTED: {
    priority: 'normal',
    handler: 'onGenerationStarted',
    description: 'Track generation start for timing'
  },

  WORLDINFO_UPDATED: {
    priority: 'low',
    handler: 'onWorldInfoUpdated',
    description: 'Detect external changes to lorebooks'
  },

  CHARACTER_MESSAGE_RENDERED: {
    priority: 'normal',
    handler: 'onMessageRendered',
    description: 'Add UI hooks to messages'
  }
}
```

**Data Flow:**
```
SillyTavern Event → EventListener.receive()
                  → EventListener.route()
                  → ModuleHandler.handle()
                  → ModuleHandler.process()
```

### 2. Entry Detector Module

**File:** `src/detector.js`

**Purpose:** Track and correlate activated lorebook entries with chat messages

**Core Class: `EntryDetector`**

```javascript
class EntryDetector {
  constructor() {
    this.activationHistory = new Map();     // messageId → ActivationRecord
    this.currentActivations = new Set();     // Currently active entries
    this.entryCache = new Map();             // entryId → EntryData
    this.generationContext = null;           // Current generation context
  }

  /**
   * Called when WORLDINFO_ACTIVATED event fires
   * @param {WorldInfoActivationData} data - Event data
   */
  onActivation(data) {
    // Store activation record
    // Update current activations set
    // Cache entry details
  }

  /**
   * Get entries that were active for a specific message
   * @param {string} messageId - Message identifier
   * @returns {ActivationRecord} - Record of activated entries
   */
  getActivationsForMessage(messageId) {
    return this.activationHistory.get(messageId);
  }

  /**
   * Clear old activation history to prevent memory bloat
   */
  pruneHistory() {
    // Keep last N messages only
  }
}
```

**Activation Record Structure:**
```javascript
{
  messageId: string,              // Chat message ID
  timestamp: number,              // Unix timestamp
  entries: [
    {
      uid: number,                // Entry unique ID
      key: string[],              // Matched keywords
      matchedKey: string,         // Specific keyword that triggered
      worldName: string,          // Source lorebook name
      content: string,            // Entry content
      comment: string,            // Entry comment/title
      order: number,              // Priority order
      position: number,           // Position in prompt
      metadata: {                 // Full entry data
        selective: boolean,
        constant: boolean,
        probability: number,
        // ... all entry fields
      }
    }
  ],
  scanState: {
    depth: number,                // Scan depth used
    budget: number,               // Token budget
    bufferSize: number,           // Context buffer size
    recursionLevel: number        // If recursive scan
  }
}
```

**Detection Algorithm:**

```
1. Listen for WORLDINFO_ACTIVATED event
   └─ Capture: activated entry list, scan metadata

2. Store activation record
   └─ Key: pending message ID (generation in progress)
   └─ Value: ActivationRecord structure

3. When MESSAGE_RECEIVED fires
   └─ Associate message ID with activation record
   └─ Trigger analysis if auto-mode enabled

4. Maintain sliding window
   └─ Keep last 100 activations (configurable)
   └─ Prune older entries on new activation
```

### 3. Response Analyzer Module

**File:** `src/analyzer.js`

**Purpose:** Analyze AI responses using LLM to extract new/updated information

**Core Class: `ResponseAnalyzer`**

```javascript
class ResponseAnalyzer {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.analysisCache = new LRUCache(100);
    this.promptTemplate = loadPromptTemplate('analyze.txt');
  }

  /**
   * Analyze a message against activated entries
   * @param {string} messageText - AI response text
   * @param {ActivationRecord} activations - Activated entries
   * @returns {Promise<AnalysisResult>} - Extraction results
   */
  async analyzeMessage(messageText, activations) {
    // Check cache first
    const cacheKey = this.getCacheKey(messageText, activations);
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    // Build analysis prompt
    const prompt = this.buildAnalysisPrompt(messageText, activations);

    // Call LLM API
    const result = await this.apiClient.sendAnalysisRequest(prompt);

    // Parse and validate result
    const parsed = this.parseAnalysisResult(result);

    // Cache result
    this.analysisCache.set(cacheKey, parsed);

    return parsed;
  }

  /**
   * Build the analysis prompt
   */
  buildAnalysisPrompt(messageText, activations) {
    return this.promptTemplate
      .replace('{{MESSAGE}}', messageText)
      .replace('{{ENTRIES}}', this.formatEntries(activations))
      .replace('{{INSTRUCTIONS}}', this.getInstructions());
  }

  /**
   * Parse LLM response into structured data
   */
  parseAnalysisResult(rawResult) {
    // Expected JSON format from LLM
    // Validate and sanitize
    // Return AnalysisResult
  }
}
```

**Analysis Prompt Template:**

```
You are analyzing a chat message to determine if it contains new information
that should be added to existing lorebook entries.

ACTIVATED LOREBOOK ENTRIES:
{{ENTRIES}}

AI RESPONSE MESSAGE:
{{MESSAGE}}

TASK:
For each activated entry, identify:
1. New facts or details not present in the original entry
2. Expansions or elaborations on existing information
3. Contradictions or corrections to existing information
4. Related entities that could be added

OUTPUT FORMAT (JSON):
{
  "updates": [
    {
      "entryUid": <entry UID>,
      "entryComment": "<entry comment>",
      "confidence": <0.0-1.0>,
      "changeType": "expansion|correction|addition",
      "extractedInfo": [
        {
          "fact": "<new fact or detail>",
          "relevance": "<why this relates to the entry>",
          "suggestedIntegration": "<how to integrate this>"
        }
      ],
      "suggestedNewContent": "<complete suggested content>",
      "reasoning": "<explanation of changes>"
    }
  ],
  "newEntities": [
    {
      "name": "<entity name>",
      "description": "<brief description>",
      "suggestedKeywords": ["<keyword1>", "<keyword2>"],
      "relevance": "<why this should be a new entry>"
    }
  ]
}

GUIDELINES:
- Only suggest updates if there is genuinely NEW information
- Preserve the original tone and style of the entry
- Do not add redundant information already in the entry
- Be conservative: high confidence threshold
- Suggest keyword additions if new terms are introduced
```

**Analysis Result Structure:**

```javascript
{
  messageId: string,
  timestamp: number,
  updates: [
    {
      entryUid: number,
      entryComment: string,
      worldName: string,
      confidence: number,              // 0.0 - 1.0
      changeType: 'expansion' | 'correction' | 'addition',
      extractedInfo: [
        {
          fact: string,
          relevance: string,
          suggestedIntegration: string
        }
      ],
      originalContent: string,
      suggestedNewContent: string,
      reasoning: string,
      metadata: {
        tokensAdded: number,
        keywordsToAdd: string[],
        preservedStructure: boolean
      }
    }
  ],
  newEntities: [
    {
      name: string,
      description: string,
      suggestedKeywords: string[],
      relevance: string,
      confidence: number
    }
  ]
}
```

### 4. Update Suggester Module

**File:** `src/suggester.js`

**Purpose:** Process analysis results and generate actionable update suggestions

**Core Class: `UpdateSuggester`**

```javascript
class UpdateSuggester {
  constructor(settings) {
    this.settings = settings;
    this.filters = new SuggestionFilters(settings);
  }

  /**
   * Generate suggestions from analysis results
   * @param {AnalysisResult} analysis - Analyzer output
   * @returns {Suggestion[]} - Filtered and ranked suggestions
   */
  generateSuggestions(analysis) {
    // Filter by confidence threshold
    let suggestions = analysis.updates.filter(
      u => u.confidence >= this.settings.minConfidence
    );

    // Apply aggressiveness filter
    suggestions = this.filters.applyAggressiveness(suggestions);

    // Rank by priority
    suggestions = this.rankSuggestions(suggestions);

    // Add metadata for UI
    suggestions = suggestions.map(s => this.enrichSuggestion(s));

    return suggestions;
  }

  /**
   * Rank suggestions by multiple factors
   */
  rankSuggestions(suggestions) {
    return suggestions.sort((a, b) => {
      // Primary: Confidence
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }

      // Secondary: Change impact
      const impactA = this.calculateImpact(a);
      const impactB = this.calculateImpact(b);
      if (impactA !== impactB) {
        return impactB - impactA;
      }

      // Tertiary: Entry priority (order field)
      return b.entryOrder - a.entryOrder;
    });
  }

  /**
   * Calculate impact score
   */
  calculateImpact(suggestion) {
    const factors = {
      tokensAdded: suggestion.metadata.tokensAdded * 0.3,
      newKeywords: suggestion.metadata.keywordsToAdd.length * 0.2,
      changeType: this.getChangeTypeWeight(suggestion.changeType) * 0.5
    };

    return Object.values(factors).reduce((a, b) => a + b, 0);
  }
}
```

**Suggestion Structure:**

```javascript
{
  id: string,                      // Unique suggestion ID
  entryUid: number,
  entryComment: string,
  worldName: string,

  // Change details
  originalContent: string,
  suggestedContent: string,
  diff: DiffResult,                // Computed diff

  // Metadata
  confidence: number,
  changeType: string,
  reasoning: string,
  impact: number,

  // UI state
  status: 'pending' | 'approved' | 'rejected' | 'edited',
  userModified: boolean,
  editedContent: string | null,

  // Tracking
  createdAt: number,
  reviewedAt: number | null,
  appliedAt: number | null
}
```

### 5. Lorebook Updater Module

**File:** `src/updater.js`

**Purpose:** Apply approved suggestions to lorebook entries

**Core Class: `LorebookUpdater`**

```javascript
class LorebookUpdater {
  constructor(worldInfoAPI) {
    this.worldInfoAPI = worldInfoAPI;
    this.updateQueue = [];
    this.isProcessing = false;
  }

  /**
   * Apply a single suggestion
   * @param {Suggestion} suggestion - Approved suggestion
   * @returns {Promise<UpdateResult>} - Result of update
   */
  async applySuggestion(suggestion) {
    // Load current lorebook
    const lorebook = await this.worldInfoAPI.load(suggestion.worldName);

    // Find entry
    const entry = lorebook.entries[suggestion.entryUid];
    if (!entry) {
      throw new Error(`Entry ${suggestion.entryUid} not found`);
    }

    // Create backup
    const backup = structuredClone(entry);

    // Apply changes
    entry.content = suggestion.userModified
      ? suggestion.editedContent
      : suggestion.suggestedContent;

    // Update keywords if needed
    if (this.settings.updateFields.includes('keywords')) {
      this.updateKeywords(entry, suggestion);
    }

    // Update comment if needed
    if (this.settings.updateFields.includes('comment')) {
      this.updateComment(entry, suggestion);
    }

    // Save lorebook
    await this.worldInfoAPI.save(suggestion.worldName, lorebook, true);

    // Record update in history
    await this.recordUpdate(suggestion, backup, entry);

    return {
      success: true,
      suggestionId: suggestion.id,
      worldName: suggestion.worldName,
      entryUid: suggestion.entryUid,
      backup: backup,
      timestamp: Date.now()
    };
  }

  /**
   * Apply multiple suggestions (batch)
   */
  async applySuggestions(suggestions) {
    // Group by lorebook
    const grouped = this.groupByLorebook(suggestions);

    // Process each lorebook
    const results = [];
    for (const [worldName, sigs] of grouped) {
      const result = await this.batchUpdateLorebook(worldName, sigs);
      results.push(result);
    }

    return results;
  }

  /**
   * Batch update entries in single lorebook
   */
  async batchUpdateLorebook(worldName, suggestions) {
    const lorebook = await this.worldInfoAPI.load(worldName);
    const backups = {};

    for (const suggestion of suggestions) {
      const entry = lorebook.entries[suggestion.entryUid];
      backups[suggestion.entryUid] = structuredClone(entry);

      // Apply changes
      this.applyChanges(entry, suggestion);
    }

    // Single save for all changes
    await this.worldInfoAPI.save(worldName, lorebook, true);

    // Record all updates
    await this.recordBatchUpdate(worldName, suggestions, backups);

    return {
      success: true,
      worldName: worldName,
      count: suggestions.length,
      backups: backups
    };
  }
}
```

### 6. Update History Module

**File:** `src/storage.js`

**Purpose:** Track update history for undo/redo and auditing

**Core Class: `UpdateHistory`**

```javascript
class UpdateHistory {
  constructor(storageKey = 'dynamic_lorebook_history') {
    this.storageKey = storageKey;
    this.history = [];
    this.currentIndex = -1;
    this.maxSize = 50;

    this.load();
  }

  /**
   * Add update to history
   */
  async addUpdate(updateRecord) {
    // Truncate forward history if in middle
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new record
    this.history.push(updateRecord);
    this.currentIndex++;

    // Prune if exceeds max size
    if (this.history.length > this.maxSize) {
      this.history.shift();
      this.currentIndex--;
    }

    await this.save();
  }

  /**
   * Undo last update
   */
  async undo() {
    if (!this.canUndo()) {
      return null;
    }

    const record = this.history[this.currentIndex];

    // Restore backup
    await this.restoreBackup(record);

    this.currentIndex--;
    await this.save();

    return record;
  }

  /**
   * Redo last undone update
   */
  async redo() {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    const record = this.history[this.currentIndex];

    // Reapply changes
    await this.reapplyUpdate(record);
    await this.save();

    return record;
  }

  canUndo() {
    return this.currentIndex >= 0;
  }

  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Persist to localStorage
   */
  async save() {
    const data = {
      history: this.history,
      currentIndex: this.currentIndex,
      timestamp: Date.now()
    };

    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  /**
   * Load from localStorage
   */
  async load() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      const data = JSON.parse(stored);
      this.history = data.history || [];
      this.currentIndex = data.currentIndex ?? -1;
    }
  }
}
```

**Update Record Structure:**

```javascript
{
  id: string,
  timestamp: number,
  type: 'single' | 'batch',
  worldName: string,
  changes: [
    {
      entryUid: number,
      entryComment: string,
      before: {                // Backup
        content: string,
        key: string[],
        comment: string,
        // ... full entry
      },
      after: {                 // New state
        content: string,
        key: string[],
        comment: string,
        // ... full entry
      },
      suggestionId: string,
      confidence: number
    }
  ],
  metadata: {
    messageId: string,
    chatName: string,
    characterName: string,
    undone: boolean,
    redone: boolean
  }
}
```

## Data Flow Diagrams

### Complete Update Flow

```
┌──────────────┐
│ User sends   │
│ message      │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Prompt generation    │
│ triggers lorebook    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ WORLDINFO_ACTIVATED event        │
│ Data: { entries, scanState }     │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ EntryDetector.onActivation()     │
│ - Store activation record        │
│ - Cache entry details            │
└──────┬───────────────────────────┘
       │
       │ (Generation happens)
       │
       ▼
┌──────────────────────────────────┐
│ MESSAGE_RECEIVED event           │
│ Data: { messageId, text }        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ ResponseAnalyzer.analyzeMessage()│
│ - Build analysis prompt          │
│ - Call LLM API                   │
│ - Parse result                   │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ UpdateSuggester.generate()       │
│ - Filter by confidence           │
│ - Rank by priority               │
│ - Enrich with metadata           │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Show UI (if suggestions exist)   │
│ - DiffViewer renders diffs       │
│ - User reviews                   │
└──────┬───────────────────────────┘
       │
       ▼
   ┌───┴────┐
   │ User   │
   │ Choice │
   └───┬────┘
       │
       ├─────────────┬──────────────┐
       │             │              │
  ┌────▼───┐   ┌────▼────┐   ┌─────▼─────┐
  │ Approve│   │ Reject  │   │ Edit      │
  └────┬───┘   └────┬────┘   └─────┬─────┘
       │             │              │
       │             │              ▼
       │             │        ┌──────────────┐
       │             │        │ User modifies│
       │             │        │ suggestion   │
       │             │        └─────┬────────┘
       │             │              │
       ▼             ▼              ▼
┌──────────────────────────────────────┐
│ LorebookUpdater.applySuggestion()    │
│ (or skip if rejected)                │
│ - Load lorebook                      │
│ - Create backup                      │
│ - Apply changes                      │
│ - Save lorebook                      │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ UpdateHistory.addUpdate()            │
│ - Record update                      │
│ - Enable undo/redo                   │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Emit WORLDINFO_UPDATED event         │
│ - SillyTavern reloads entry          │
│ - Extension shows notification       │
└──────────────────────────────────────┘
```

### Undo Flow

```
┌──────────────┐
│ User clicks  │
│ Undo button  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│ UpdateHistory.undo()             │
│ - Get current record             │
│ - Extract backup                 │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ LorebookUpdater.restoreBackup()  │
│ - Load lorebook                  │
│ - Replace entry with backup      │
│ - Save lorebook                  │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Emit WORLDINFO_UPDATED event     │
│ - SillyTavern reloads            │
│ - UI shows undo notification     │
└──────────────────────────────────┘
```

## Performance Considerations

### 1. Analysis Throttling

```javascript
class AnalysisThrottler {
  constructor(settings) {
    this.queue = [];
    this.processing = false;
    this.delay = settings.analysisDelay || 2000; // 2 seconds
  }

  async queueAnalysis(messageId, activations) {
    this.queue.push({ messageId, activations, timestamp: Date.now() });

    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();

      // Wait for delay
      await this.sleep(this.delay);

      // Process
      await analyzer.analyzeMessage(item.messageId, item.activations);
    }

    this.processing = false;
  }
}
```

### 2. Caching Strategy

- **Analysis Cache:** LRU cache (100 entries) for analysis results
- **Entry Cache:** Map of recently accessed entries
- **Prompt Cache:** Template cache for analysis prompts

### 3. Background Processing

All analysis runs asynchronously:
- Non-blocking on chat generation
- Uses Web Workers (future enhancement)
- Cancellable if user navigates away

## Error Handling

### Error Categories

1. **API Errors:** LLM API failures
   - Retry with exponential backoff
   - Fall back to simpler analysis
   - Show error notification

2. **Data Errors:** Corrupt lorebook data
   - Validate before update
   - Preserve backup
   - Rollback on failure

3. **User Errors:** Invalid edits
   - Validate content length
   - Check for required fields
   - Show validation errors

### Error Recovery

```javascript
class ErrorRecovery {
  async safeUpdate(updateFn, rollbackFn) {
    let backup = null;

    try {
      backup = await this.createBackup();
      await updateFn();
    } catch (error) {
      console.error('Update failed:', error);

      if (backup) {
        await rollbackFn(backup);
      }

      throw error;
    }
  }
}
```

## Extension Lifecycle

### Initialization

```javascript
// On extension load
async function init() {
  // 1. Load settings
  settings = await loadSettings();

  // 2. Initialize modules
  detector = new EntryDetector();
  analyzer = new ResponseAnalyzer(apiClient);
  suggester = new UpdateSuggester(settings);
  updater = new LorebookUpdater(worldInfoAPI);
  history = new UpdateHistory();

  // 3. Subscribe to events
  eventSource.on(event_types.WORLDINFO_ACTIVATED, detector.onActivation);
  eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);

  // 4. Initialize UI
  ui.init();

  // 5. Restore state
  await restoreState();
}
```

### Cleanup

```javascript
// On extension unload
async function cleanup() {
  // 1. Unsubscribe from events
  eventSource.off(event_types.WORLDINFO_ACTIVATED);
  eventSource.off(event_types.MESSAGE_RECEIVED);

  // 2. Save state
  await saveState();

  // 3. Clear caches
  analyzer.clearCache();
  detector.clearHistory();

  // 4. Cleanup UI
  ui.cleanup();
}
```

## Security Considerations

1. **Content Validation:**
   - Sanitize all user inputs
   - Validate lorebook data structure
   - Check content length limits

2. **API Security:**
   - Use existing SillyTavern API keys
   - No external API calls
   - Respect rate limits

3. **Data Privacy:**
   - All data stays local
   - No telemetry or tracking
   - User controls all updates

## Testing Strategy

### Unit Tests
- Each module tested independently
- Mock SillyTavern APIs
- Test edge cases

### Integration Tests
- Full flow with test lorebooks
- Multiple entry scenarios
- Error handling

### Manual Tests
- UI responsiveness
- Performance with large lorebooks
- Browser compatibility

## Future Optimizations

1. **Web Workers:** Offload analysis to background thread
2. **Incremental Updates:** Only analyze changed portions
3. **Smart Caching:** Predict likely entries to cache
4. **Batch Analysis:** Group multiple messages
5. **Progressive Enhancement:** Show partial results while analyzing
