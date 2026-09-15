# Dynamic Lorebook Manager - Extension Design Document

**Version:** 1.0
**Last Updated:** 2024-03-28
**Status:** Design Complete - Ready for Implementation

---

## Executive Summary

The Dynamic Lorebook Manager is a SillyTavern extension that automatically detects when lorebook (World Info) entries are activated during chat, analyzes AI responses for new information, and intelligently suggests updates to keep lorebooks current and comprehensive. It solves the problem of lorebooks becoming stale as conversations naturally expand on existing lore.

### The Problem

1. Lorebooks trigger static content injection based on keywords
2. AI responses often expand on or contradict lorebook entries
3. Users must manually identify and update entries
4. Lorebooks drift out of sync with ongoing roleplay

### The Solution

An intelligent extension that:
- Detects which entries were activated
- Analyzes AI responses using LLM
- Generates update suggestions with diff view
- Allows user approval with editing capability
- Maintains full undo/redo history

---

## Core Concept

```
┌─────────────┐
│ User chats  │
│ normally    │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐      ┌──────────────────┐
│ Lorebook entries    │─────▶│ AI Response      │
│ trigger (existing   │      │ includes new     │
│ SillyTavern         │      │ information      │
│ behavior)           │      │                  │
└─────────────────────┘      └────────┬─────────┘
       │                              │
       │ Extension detects            │
       │ what triggered               │
       └──────────────┬───────────────┘
                      │
                      ▼
       ┌──────────────────────────────┐
       │ Extension analyzes:          │
       │ "Entry X was active and      │
       │  AI said Y. Entry X should   │
       │  be updated to include Y"    │
       └──────────────┬───────────────┘
                      │
                      ▼
       ┌──────────────────────────────┐
       │ User reviews suggestion in   │
       │ diff view and approves/      │
       │ rejects/edits                │
       └──────────────┬───────────────┘
                      │
                      ▼
       ┌──────────────────────────────┐
       │ Lorebook updated             │
       │ (with undo capability)       │
       └──────────────────────────────┘
```

---

## Technical Architecture

### System Overview

```
SillyTavern Core
├─ Chat System (generates messages)
├─ World Info System (activates entries)
└─ Event Bus (emits events)
        │
        │ Events: WORLDINFO_ACTIVATED, MESSAGE_RECEIVED
        ▼
Extension Layer
├─ Event Listener (captures events)
├─ Entry Detector (tracks activations)
├─ Response Analyzer (calls LLM API)
├─ Update Suggester (generates suggestions)
├─ UI Layer (shows approval dialog)
├─ Lorebook Updater (applies changes)
└─ Update History (undo/redo)
```

### Module Architecture

#### 1. Event Listener (`src/event-listener.js`)

**Purpose:** Central hub for SillyTavern event subscriptions

```javascript
class EventListener {
    constructor() {
        this.handlers = new Map();
        this.eventHistory = [];
    }

    init() {
        // Subscribe to SillyTavern events
        eventSource.on(event_types.WORLDINFO_ACTIVATED, this.onWorldInfoActivated);
        eventSource.on(event_types.MESSAGE_RECEIVED, this.onMessageReceived);
        eventSource.on(event_types.GENERATION_STARTED, this.onGenerationStarted);
    }

    onWorldInfoActivated(data) {
        // Route to EntryDetector
        entryDetector.onActivation(data);
    }

    onMessageReceived(data) {
        // Route to ResponseAnalyzer
        if (!data.isUser) {
            responseAnalyzer.analyzeIfNeeded(data);
        }
    }
}
```

**Key Events:**
- `WORLDINFO_ACTIVATED` - Fired when entries trigger (BEFORE generation)
- `MESSAGE_RECEIVED` - Fired when AI response completes (AFTER generation)
- `GENERATION_STARTED` - Track generation timing
- `WORLDINFO_UPDATED` - Detect external lorebook changes

#### 2. Entry Detector (`src/detector.js`)

**Purpose:** Track which entries were activated for each message

```javascript
class EntryDetector {
    constructor() {
        this.activationHistory = new Map();  // messageId -> ActivationRecord
        this.pendingActivation = null;        // Activation waiting for message ID
        this.entryCache = new Map();          // Cache entry details
    }

    onActivation(data) {
        // Store activation data (message ID not yet known)
        this.pendingActivation = {
            timestamp: Date.now(),
            entries: data.entries.map(e => ({
                uid: e.uid,
                worldName: e.worldName,
                matchedKey: e.matchedKey,
                content: e.content,
                comment: e.comment,
                // ... other relevant fields
            })),
            scanState: data.scanState
        };
    }

    onMessageReceived(messageId) {
        // Associate pending activation with message ID
        if (this.pendingActivation) {
            this.activationHistory.set(messageId, {
                ...this.pendingActivation,
                messageId: messageId
            });
            this.pendingActivation = null;
        }
    }

    getActivationsForMessage(messageId) {
        return this.activationHistory.get(messageId);
    }

    pruneHistory(keepLast = 100) {
        // Keep only recent activations to prevent memory bloat
        if (this.activationHistory.size > keepLast) {
            const keys = Array.from(this.activationHistory.keys());
            const toDelete = keys.slice(0, keys.length - keepLast);
            toDelete.forEach(key => this.activationHistory.delete(key));
        }
    }
}
```

**Data Structure: ActivationRecord**
```typescript
interface ActivationRecord {
    messageId: string;
    timestamp: number;
    entries: Array<{
        uid: number;
        worldName: string;
        matchedKey: string;      // Which keyword triggered
        content: string;
        comment: string;
        key: string[];
        // ... full entry data
    }>;
    scanState: {
        depth: number;
        budget: number;
        recursionLevel: number;
    };
}
```

#### 3. Response Analyzer (`src/analyzer.js`)

**Purpose:** Use LLM to analyze AI responses for updates

```javascript
class ResponseAnalyzer {
    constructor(apiClient, settings) {
        this.apiClient = apiClient;
        this.settings = settings;
        this.analysisCache = new Map();
        this.promptTemplate = this.loadPromptTemplate();
    }

    async analyzeMessage(messageText, activationRecord) {
        // Check cache
        const cacheKey = this.getCacheKey(messageText, activationRecord);
        if (this.analysisCache.has(cacheKey)) {
            return this.analysisCache.get(cacheKey);
        }

        // Build prompt
        const prompt = this.buildAnalysisPrompt(messageText, activationRecord);

        // Call LLM
        const response = await this.apiClient.sendRequest(prompt, {
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: 'json_object' }
        });

        // Parse result
        const analysis = this.parseAnalysisResult(response);

        // Cache and return
        this.analysisCache.set(cacheKey, analysis);
        return analysis;
    }

    buildAnalysisPrompt(messageText, activationRecord) {
        return this.promptTemplate
            .replace('{{ENTRIES}}', this.formatEntries(activationRecord.entries))
            .replace('{{MESSAGE}}', messageText)
            .replace('{{INSTRUCTIONS}}', this.getInstructions());
    }

    parseAnalysisResult(rawResult) {
        const parsed = JSON.parse(rawResult);

        // Validate structure
        if (!parsed.updates || !Array.isArray(parsed.updates)) {
            throw new Error('Invalid analysis result structure');
        }

        return {
            updates: parsed.updates.map(u => ({
                entryUid: u.entryUid,
                confidence: u.confidence,
                changeType: u.changeType,
                suggestedNewContent: u.suggestedNewContent,
                reasoning: u.reasoning,
                extractedInfo: u.extractedInfo || []
            })),
            newEntities: parsed.newEntities || []
        };
    }
}
```

**Analysis Prompt Template:**
```
You are analyzing a chat message to identify new information for lorebook entries.

ACTIVATED ENTRIES:
{{ENTRIES}}

AI MESSAGE:
{{MESSAGE}}

OUTPUT (JSON):
{
  "updates": [
    {
      "entryUid": <number>,
      "confidence": <0.0-1.0>,
      "changeType": "expansion|correction|addition",
      "extractedInfo": [
        {
          "fact": "<new fact>",
          "relevance": "<why relevant>",
          "confidence": <0.0-1.0>
        }
      ],
      "suggestedNewContent": "<complete updated content>",
      "reasoning": "<explanation>"
    }
  ],
  "newEntities": [
    {
      "name": "<entity name>",
      "description": "<brief description>",
      "suggestedKeywords": ["<kw1>", "<kw2>"],
      "confidence": <0.0-1.0>
    }
  ]
}

RULES:
- Only suggest updates for genuinely NEW information
- Preserve original tone and style
- Be conservative: high confidence threshold
- Identify contradictions clearly
```

**Data Structure: AnalysisResult**
```typescript
interface AnalysisResult {
    updates: Array<{
        entryUid: number;
        confidence: number;        // 0.0 - 1.0
        changeType: 'expansion' | 'correction' | 'addition';
        extractedInfo: Array<{
            fact: string;
            relevance: string;
            confidence: number;
        }>;
        suggestedNewContent: string;
        reasoning: string;
    }>;
    newEntities: Array<{
        name: string;
        description: string;
        suggestedKeywords: string[];
        confidence: number;
    }>;
}
```

#### 4. Update Suggester (`src/suggester.js`)

**Purpose:** Filter and rank suggestions for user presentation

```javascript
class UpdateSuggester {
    constructor(settings) {
        this.settings = settings;
    }

    generateSuggestions(analysisResult, activationRecord) {
        let suggestions = [];

        // Process updates
        for (const update of analysisResult.updates) {
            // Filter by confidence
            if (update.confidence < this.settings.minConfidence) {
                continue;
            }

            // Apply aggressiveness filter
            if (!this.shouldIncludeUpdate(update)) {
                continue;
            }

            // Find original entry
            const originalEntry = activationRecord.entries.find(
                e => e.uid === update.entryUid
            );

            // Compute diff
            const diff = this.computeDiff(
                originalEntry.content,
                update.suggestedNewContent
            );

            // Create suggestion
            suggestions.push({
                id: generateUUID(),
                type: 'update',
                entryUid: update.entryUid,
                entryComment: originalEntry.comment,
                worldName: originalEntry.worldName,
                originalContent: originalEntry.content,
                suggestedContent: update.suggestedNewContent,
                diff: diff,
                confidence: update.confidence,
                changeType: update.changeType,
                reasoning: update.reasoning,
                impact: this.calculateImpact(update),
                status: 'pending',
                createdAt: Date.now()
            });
        }

        // Rank suggestions
        suggestions = this.rankSuggestions(suggestions);

        return suggestions;
    }

    shouldIncludeUpdate(update) {
        const { aggressiveness } = this.settings;

        if (aggressiveness === 'conservative') {
            // Only expansions
            return update.changeType === 'expansion';
        } else if (aggressiveness === 'balanced') {
            // Expansions and corrections
            return ['expansion', 'correction'].includes(update.changeType);
        } else {
            // All types
            return true;
        }
    }

    calculateImpact(update) {
        // Calculate impact score based on multiple factors
        const factors = {
            tokensAdded: this.countTokens(update.suggestedNewContent) * 0.3,
            changeType: this.getChangeTypeWeight(update.changeType) * 0.5,
            confidence: update.confidence * 0.2
        };

        return Object.values(factors).reduce((a, b) => a + b, 0);
    }

    rankSuggestions(suggestions) {
        return suggestions.sort((a, b) => {
            // Primary: Confidence (descending)
            if (a.confidence !== b.confidence) {
                return b.confidence - a.confidence;
            }

            // Secondary: Impact (descending)
            if (a.impact !== b.impact) {
                return b.impact - a.impact;
            }

            // Tertiary: Creation time (ascending - earlier first)
            return a.createdAt - b.createdAt;
        });
    }
}
```

**Data Structure: Suggestion**
```typescript
interface Suggestion {
    id: string;
    type: 'update' | 'new-entry';

    // For updates
    entryUid: number;
    entryComment: string;
    worldName: string;
    originalContent: string;
    suggestedContent: string;
    diff: DiffResult;

    // Metadata
    confidence: number;
    changeType: string;
    reasoning: string;
    impact: number;

    // State
    status: 'pending' | 'approved' | 'rejected' | 'applied';
    userModified: boolean;
    editedContent?: string;

    // Timestamps
    createdAt: number;
    reviewedAt?: number;
    appliedAt?: number;
}
```

#### 5. UI Layer (`src/ui/`)

**Components:**

**a) Notification (`src/ui/notification.js`)**
```javascript
class NotificationManager {
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `dlm-notification dlm-notification-${type}`;
        notification.innerHTML = `
            <div class="dlm-notification-icon">
                <i class="fa fa-${this.getIcon(type)}"></i>
            </div>
            <div class="dlm-notification-content">
                <div class="dlm-notification-message">${message}</div>
            </div>
            <button class="dlm-notification-close">
                <i class="fa fa-times"></i>
            </button>
        `;

        document.body.appendChild(notification);

        if (duration > 0) {
            setTimeout(() => this.dismiss(notification), duration);
        }

        return notification;
    }

    showSuggestionsAvailable(count, onReview) {
        const notification = this.show(
            `${count} lorebook ${count === 1 ? 'suggestion' : 'suggestions'} available`,
            'info',
            0
        );

        const reviewButton = document.createElement('button');
        reviewButton.textContent = 'Review';
        reviewButton.className = 'dlm-btn dlm-btn-sm';
        reviewButton.onclick = () => {
            this.dismiss(notification);
            onReview();
        };

        notification.querySelector('.dlm-notification-content').appendChild(reviewButton);
    }
}
```

**b) Approval Dialog (`src/ui/approval-dialog.js`)**
```javascript
class ApprovalDialog {
    constructor(suggestions) {
        this.suggestions = suggestions;
        this.selectedIds = new Set();
        this.element = null;
    }

    show() {
        this.element = this.render();
        document.body.appendChild(this.element);
        this.bindEvents();
    }

    render() {
        const dialog = document.createElement('div');
        dialog.className = 'dlm-modal';
        dialog.innerHTML = `
            <div class="dlm-modal-overlay"></div>
            <div class="dlm-modal-content">
                <div class="dlm-modal-header">
                    <h2>Lorebook Update Suggestions</h2>
                    <button class="dlm-modal-close">
                        <i class="fa fa-times"></i>
                    </button>
                </div>

                <div class="dlm-modal-summary">
                    ${this.renderSummary()}
                </div>

                <div class="dlm-toolbar">
                    ${this.renderToolbar()}
                </div>

                <div class="dlm-modal-body">
                    ${this.renderSuggestionsList()}
                </div>

                <div class="dlm-modal-footer">
                    <button class="dlm-btn dlm-btn-secondary" data-action="reject-all">
                        Reject All
                    </button>
                    <button class="dlm-btn dlm-btn-secondary" data-action="cancel">
                        Cancel
                    </button>
                    <button class="dlm-btn dlm-btn-primary" data-action="apply">
                        Apply Selected (${this.selectedIds.size})
                    </button>
                </div>
            </div>
        `;

        return dialog;
    }

    renderSuggestionsList() {
        return this.suggestions.map(s => this.renderSuggestionCard(s)).join('');
    }

    renderSuggestionCard(suggestion) {
        return `
            <div class="dlm-suggestion-card" data-suggestion-id="${suggestion.id}">
                <div class="dlm-card-header">
                    <input type="checkbox" class="dlm-suggestion-select"
                           data-id="${suggestion.id}" />
                    <div class="dlm-card-title">
                        <span class="dlm-entry-comment">${suggestion.entryComment}</span>
                        <span class="dlm-world-name">${suggestion.worldName}</span>
                    </div>
                    <div class="dlm-confidence" style="--confidence: ${suggestion.confidence}">
                        <span class="dlm-confidence-bar"></span>
                        <span class="dlm-confidence-text">
                            ${Math.round(suggestion.confidence * 100)}%
                        </span>
                    </div>
                    <span class="dlm-change-type">${suggestion.changeType}</span>
                </div>

                <div class="dlm-card-body">
                    ${this.renderDiffViewer(suggestion.diff)}

                    <details class="dlm-reasoning">
                        <summary>Why this change?</summary>
                        <p>${suggestion.reasoning}</p>
                    </details>
                </div>

                <div class="dlm-card-footer">
                    <button class="dlm-btn" data-action="approve" data-id="${suggestion.id}">
                        <i class="fa fa-check"></i> Approve
                    </button>
                    <button class="dlm-btn" data-action="edit" data-id="${suggestion.id}">
                        <i class="fa fa-edit"></i> Edit
                    </button>
                    <button class="dlm-btn" data-action="reject" data-id="${suggestion.id}">
                        <i class="fa fa-times"></i> Reject
                    </button>
                </div>
            </div>
        `;
    }

    bindEvents() {
        // Close button
        this.element.querySelector('.dlm-modal-close').onclick = () => this.close();

        // Apply button
        this.element.querySelector('[data-action="apply"]').onclick = () => {
            this.onApply();
        };

        // Individual suggestion actions
        this.element.querySelectorAll('[data-action]').forEach(btn => {
            const action = btn.dataset.action;
            const suggestionId = btn.dataset.id;

            btn.onclick = () => this.handleAction(action, suggestionId);
        });
    }

    async onApply() {
        const selectedSuggestions = this.suggestions.filter(
            s => this.selectedIds.has(s.id)
        );

        // Show progress
        this.showProgress();

        try {
            await lorebookUpdater.applySuggestions(selectedSuggestions);

            this.close();
            notificationManager.show(
                `Applied ${selectedSuggestions.length} updates`,
                'success'
            );
        } catch (error) {
            notificationManager.show(
                `Error: ${error.message}`,
                'error'
            );
        }
    }
}
```

**c) Diff Viewer (`src/ui/diff-viewer.js`)**
```javascript
class DiffViewer {
    constructor(oldText, newText) {
        this.oldText = oldText;
        this.newText = newText;
        this.diff = this.computeDiff();
    }

    computeDiff() {
        // Use diff-match-patch library
        const dmp = new diff_match_patch();
        const diffs = dmp.diff_main(this.oldText, this.newText);
        dmp.diff_cleanupSemantic(diffs);

        return diffs.map(([op, text]) => ({
            type: op === 1 ? 'insert' : op === -1 ? 'delete' : 'equal',
            content: text
        }));
    }

    render(mode = 'inline') {
        if (mode === 'inline') {
            return this.renderInline();
        } else {
            return this.renderSideBySide();
        }
    }

    renderInline() {
        return `
            <div class="dlm-diff-viewer" data-mode="inline">
                ${this.diff.map(chunk => this.renderChunk(chunk)).join('')}
            </div>
        `;
    }

    renderChunk(chunk) {
        const className = `dlm-diff-${chunk.type}`;
        return `<span class="${className}">${this.escapeHtml(chunk.content)}</span>`;
    }
}
```

#### 6. Lorebook Updater (`src/updater.js`)

**Purpose:** Apply approved suggestions to lorebooks

```javascript
class LorebookUpdater {
    constructor(worldInfoAPI) {
        this.worldInfoAPI = worldInfoAPI;
    }

    async applySuggestion(suggestion) {
        // Load lorebook
        const lorebook = await this.worldInfoAPI.load(suggestion.worldName);

        // Find entry
        const entry = lorebook.entries[suggestion.entryUid];
        if (!entry) {
            throw new Error(`Entry ${suggestion.entryUid} not found`);
        }

        // Create backup
        const backup = structuredClone(entry);

        // Apply change
        entry.content = suggestion.userModified
            ? suggestion.editedContent
            : suggestion.suggestedContent;

        // Save
        await this.worldInfoAPI.save(suggestion.worldName, lorebook, true);

        // Record in history
        await updateHistory.addUpdate({
            id: generateUUID(),
            timestamp: Date.now(),
            type: 'single',
            worldName: suggestion.worldName,
            changes: [{
                entryUid: suggestion.entryUid,
                before: { content: backup.content },
                after: { content: entry.content },
                suggestionId: suggestion.id
            }]
        });

        // Emit event
        eventSource.emit(event_types.WORLDINFO_UPDATED, {
            worldName: suggestion.worldName,
            source: 'extension'
        });

        return { success: true };
    }

    async applySuggestions(suggestions) {
        // Group by lorebook
        const grouped = this.groupByLorebook(suggestions);

        // Apply each lorebook in sequence
        for (const [worldName, sigs] of grouped) {
            await this.batchUpdateLorebook(worldName, sigs);
        }
    }

    async batchUpdateLorebook(worldName, suggestions) {
        const lorebook = await this.worldInfoAPI.load(worldName);
        const backups = {};

        for (const suggestion of suggestions) {
            const entry = lorebook.entries[suggestion.entryUid];
            backups[suggestion.entryUid] = structuredClone(entry);

            // Apply change
            entry.content = suggestion.userModified
                ? suggestion.editedContent
                : suggestion.suggestedContent;
        }

        // Single save
        await this.worldInfoAPI.save(worldName, lorebook, true);

        // Record in history
        await updateHistory.addUpdate({
            id: generateUUID(),
            timestamp: Date.now(),
            type: 'batch',
            worldName: worldName,
            changes: suggestions.map(s => ({
                entryUid: s.entryUid,
                before: { content: backups[s.entryUid].content },
                after: { content: lorebook.entries[s.entryUid].content },
                suggestionId: s.id
            }))
        });
    }
}
```

#### 7. Update History (`src/storage.js`)

**Purpose:** Track updates for undo/redo

```javascript
class UpdateHistory {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxSize = 50;
        this.load();
    }

    async addUpdate(updateRecord) {
        // Truncate forward history
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Add new record
        this.history.push(updateRecord);
        this.currentIndex++;

        // Prune if needed
        if (this.history.length > this.maxSize) {
            this.history.shift();
            this.currentIndex--;
        }

        await this.save();
    }

    async undo() {
        if (!this.canUndo()) return null;

        const record = this.history[this.currentIndex];

        // Restore backups
        const lorebook = await worldInfoAPI.load(record.worldName);

        for (const change of record.changes) {
            const entry = lorebook.entries[change.entryUid];
            entry.content = change.before.content;
        }

        await worldInfoAPI.save(record.worldName, lorebook, true);

        this.currentIndex--;
        await this.save();

        return record;
    }

    async redo() {
        if (!this.canRedo()) return null;

        this.currentIndex++;
        const record = this.history[this.currentIndex];

        // Reapply changes
        const lorebook = await worldInfoAPI.load(record.worldName);

        for (const change of record.changes) {
            const entry = lorebook.entries[change.entryUid];
            entry.content = change.after.content;
        }

        await worldInfoAPI.save(record.worldName, lorebook, true);
        await this.save();

        return record;
    }

    canUndo() {
        return this.currentIndex >= 0;
    }

    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    save() {
        localStorage.setItem('dynamic_lorebook_history', JSON.stringify({
            history: this.history,
            currentIndex: this.currentIndex
        }));
    }

    load() {
        const stored = localStorage.getItem('dynamic_lorebook_history');
        if (stored) {
            const data = JSON.parse(stored);
            this.history = data.history || [];
            this.currentIndex = data.currentIndex ?? -1;
        }
    }
}
```

---

## Complete Data Flow

### 1. Activation Detection Flow

```
User sends message
       │
       ▼
AI generates response
       │
       ├──(during generation)──▶ World Info scans
       │                               │
       │                               ▼
       │                         Entries match keywords
       │                               │
       │                               ▼
       │                    WORLDINFO_ACTIVATED event
       │                               │
       │                               ▼
       │                         EntryDetector.onActivation()
       │                               │
       │                               ▼
       │                         Store ActivationRecord
       │                         (pending message ID)
       │
       ├──(after generation)───▶ MESSAGE_RECEIVED event
       │                               │
       │                               ▼
       │                         Associate with ActivationRecord
       ▼
Response complete
```

### 2. Analysis & Suggestion Flow

```
MESSAGE_RECEIVED event
       │
       ▼
Get ActivationRecord for message
       │
       ├─None found──▶ Skip (no entries activated)
       │
       └─Found
         │
         ▼
ResponseAnalyzer.analyzeMessage()
         │
         ├─Build prompt with entries + message
         │
         ├─Call LLM API
         │
         ├─Parse JSON response
         │
         └─Return AnalysisResult
           │
           ▼
UpdateSuggester.generateSuggestions()
           │
           ├─Filter by confidence threshold
           │
           ├─Apply aggressiveness filter
           │
           ├─Compute diffs
           │
           ├─Rank by confidence/impact
           │
           └─Return Suggestion[]
             │
             ├─None──▶ Silent completion
             │
             └─Found
               │
               ▼
         Show notification
               │
         User clicks "Review"
               │
               ▼
         ApprovalDialog.show()
```

### 3. Application Flow

```
User reviews suggestions
       │
       ├─Approves
       │   │
       │   ▼
       │  LorebookUpdater.applySuggestion()
       │   │
       │   ├─Load lorebook
       │   │
       │   ├─Create backup
       │   │
       │   ├─Apply change
       │   │
       │   ├─Save lorebook
       │   │
       │   ├─Record in UpdateHistory
       │   │
       │   └─Emit WORLDINFO_UPDATED
       │       │
       │       ▼
       │  Success notification
       │
       ├─Edits
       │   │
       │   ▼
       │  Edit mode
       │   │
       │   └──(after saving)──▶ Same as Approve
       │
       └─Rejects
           │
           ▼
         Mark as rejected
         (no further action)
```

---

## Key Implementation Details

### SillyTavern API Integration

**World Info Functions (from `world-info.js`):**
```javascript
import {
    loadWorldInfo,         // Load lorebook by name
    saveWorldInfo,         // Save lorebook changes
    getSortedEntries,      // Get all active entries
    worldInfoCache,        // Cache for loaded lorebooks
    eventSource,           // Event emitter
    event_types,           // Event type constants
} from '../world-info.js';

// Example usage
const lorebook = await loadWorldInfo('FantasyWorld');
lorebook.entries[5].content = 'Updated content';
await saveWorldInfo('FantasyWorld', lorebook, true);  // immediate save
```

**Chat API Functions (from `script.js`):**
```javascript
import {
    getRequestHeaders,     // Get auth headers for API calls
    getContext,            // Get context object
} from '../../script.js';

// Example usage
const headers = getRequestHeaders();
const context = getContext();
const chatApi = context.main_api;  // 'openai', 'claude', etc.
```

### Chat API Abstraction

```javascript
class ChatAPIClient {
    constructor() {
        this.context = getContext();
        this.apiType = this.context.main_api;
    }

    async sendRequest(prompt, options = {}) {
        switch (this.apiType) {
            case 'openai':
                return await this.sendOpenAI(prompt, options);
            case 'claude':
                return await this.sendClaude(prompt, options);
            // ... other APIs
        }
    }

    async sendOpenAI(prompt, options) {
        const response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                model: 'gpt-4-turbo',
                messages: [
                    { role: 'system', content: 'You are a lorebook analysis assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: options.temperature || 0.3,
                max_tokens: options.max_tokens || 1000,
                response_format: { type: 'json_object' }
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async sendClaude(prompt, options) {
        const response = await fetch('/api/anthropic/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                model: 'claude-3-opus',
                prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
                max_tokens_to_sample: options.max_tokens || 1000,
                temperature: options.temperature || 0.3
            })
        });

        const data = await response.json();
        return data.completion;
    }
}
```

### Extension Settings

**Storage:**
```javascript
async function loadSettings() {
    const response = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders()
    });

    const data = await response.json();
    return data.extension_settings?.dynamic_lorebook || getDefaultSettings();
}

async function saveSettings(settings) {
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

**Default Settings:**
```javascript
function getDefaultSettings() {
    return {
        enabled: true,
        updateMode: 'auto-suggest',     // 'manual', 'auto-suggest', 'auto-approve'
        aggressiveness: 'balanced',     // 'conservative', 'balanced', 'aggressive'
        minConfidence: 0.70,           // 0.0 - 1.0
        updateFields: ['content'],      // ['content', 'keywords', 'comment']
        enabledLorebooks: [],          // Empty = all
        showNotifications: true,
        autoBackup: true,
        analysisDelay: 2000,           // ms
        maxHistorySize: 50,
        debugMode: false
    };
}
```

---

## File Structure

```
public/scripts/extensions/dynamic-lorebook/
├── manifest.json                   # Extension manifest
├── index.js                        # Main entry point
├── src/
│   ├── event-listener.js          # Event handling
│   ├── detector.js                # Entry detection
│   ├── analyzer.js                # AI analysis
│   ├── suggester.js               # Suggestion generation
│   ├── updater.js                 # Lorebook updates
│   ├── storage.js                 # History management
│   ├── chat-api-client.js         # API abstraction
│   ├── utils.js                   # Helper functions
│   └── ui/
│       ├── approval-dialog.js     # Main UI dialog
│       ├── diff-viewer.js         # Diff component
│       ├── notification.js        # Notifications
│       └── settings-panel.js      # Settings UI
├── styles/
│   ├── main.css                   # Main styles
│   └── diff-viewer.css            # Diff styles
├── prompts/
│   └── analyze.txt                # Analysis prompt template
└── [documentation files]          # All .md files
```

### manifest.json

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
    "description": "Automatically detect and suggest lorebook updates based on AI responses"
}
```

### index.js (Main Entry Point)

```javascript
(async function() {
    'use strict';

    // Imports
    const { loadWorldInfo, saveWorldInfo, eventSource, event_types } =
        await import('../world-info.js');
    const { getRequestHeaders, getContext } =
        await import('../../script.js');

    // Module imports
    const { EventListener } = await import('./src/event-listener.js');
    const { EntryDetector } = await import('./src/detector.js');
    const { ResponseAnalyzer } = await import('./src/analyzer.js');
    const { UpdateSuggester } = await import('./src/suggester.js');
    const { LorebookUpdater } = await import('./src/updater.js');
    const { UpdateHistory } = await import('./src/storage.js');
    const { ChatAPIClient } = await import('./src/chat-api-client.js');
    const { NotificationManager } = await import('./src/ui/notification.js');
    const { ApprovalDialog } = await import('./src/ui/approval-dialog.js');

    // State
    let settings = {};
    let initialized = false;

    // Module instances
    let eventListener;
    let entryDetector;
    let responseAnalyzer;
    let updateSuggester;
    let lorebookUpdater;
    let updateHistory;
    let notificationManager;

    // World Info API wrapper
    const worldInfoAPI = {
        load: loadWorldInfo,
        save: saveWorldInfo
    };

    // Initialize extension
    async function init() {
        console.log('[Dynamic Lorebook] Initializing...');

        // Load settings
        settings = await loadSettings();

        if (!settings.enabled) {
            console.log('[Dynamic Lorebook] Extension disabled in settings');
            return;
        }

        // Initialize modules
        const apiClient = new ChatAPIClient();

        eventListener = new EventListener();
        entryDetector = new EntryDetector();
        responseAnalyzer = new ResponseAnalyzer(apiClient, settings);
        updateSuggester = new UpdateSuggester(settings);
        lorebookUpdater = new LorebookUpdater(worldInfoAPI);
        updateHistory = new UpdateHistory();
        notificationManager = new NotificationManager();

        // Wire up event flow
        eventListener.onWorldInfoActivated = (data) => {
            entryDetector.onActivation(data);
        };

        eventListener.onMessageReceived = async (data) => {
            if (data.isUser) return;

            const activationRecord = entryDetector.getActivationsForMessage(data.messageId);
            if (!activationRecord || activationRecord.entries.length === 0) {
                return;
            }

            // Analyze
            try {
                const analysis = await responseAnalyzer.analyzeMessage(
                    data.text,
                    activationRecord
                );

                const suggestions = updateSuggester.generateSuggestions(
                    analysis,
                    activationRecord
                );

                if (suggestions.length > 0) {
                    notificationManager.showSuggestionsAvailable(
                        suggestions.length,
                        () => showApprovalDialog(suggestions)
                    );
                }
            } catch (error) {
                console.error('[Dynamic Lorebook] Analysis error:', error);
            }
        };

        // Register event handlers
        eventListener.init();

        // Initialize UI
        initializeUI();

        initialized = true;
        console.log('[Dynamic Lorebook] Initialized successfully');
    }

    function showApprovalDialog(suggestions) {
        const dialog = new ApprovalDialog(suggestions);
        dialog.show();
    }

    function initializeUI() {
        // Add settings panel to extensions menu
        // Add history panel
        // Add keyboard shortcuts
    }

    // Settings functions
    async function loadSettings() { /* ... */ }
    async function saveSettings(newSettings) { /* ... */ }

    // Auto-initialize
    await init();
})();
```

---

## Implementation Checklist

### Phase 1: Core Detection (Week 1)
- [ ] Set up extension structure (manifest, files)
- [ ] Implement EventListener
- [ ] Implement EntryDetector
- [ ] Test: Verify activations are captured correctly

### Phase 2: Analysis (Week 2)
- [ ] Implement ChatAPIClient
- [ ] Implement ResponseAnalyzer
- [ ] Create analysis prompt template
- [ ] Test: Verify LLM returns valid suggestions

### Phase 3: Suggestions (Week 3)
- [ ] Implement UpdateSuggester
- [ ] Implement diff computation
- [ ] Test: Verify filtering and ranking

### Phase 4: UI (Week 4)
- [ ] Implement NotificationManager
- [ ] Implement ApprovalDialog
- [ ] Implement DiffViewer
- [ ] Add CSS styling
- [ ] Test: UI displays correctly

### Phase 5: Updates (Week 5)
- [ ] Implement LorebookUpdater
- [ ] Implement UpdateHistory
- [ ] Add undo/redo functionality
- [ ] Test: Updates apply correctly

### Phase 6: Integration & Testing (Week 6)
- [ ] End-to-end testing
- [ ] Edge case testing
- [ ] Performance optimization
- [ ] Documentation updates

---

## Testing Strategy

### Unit Tests
- EntryDetector: Activation correlation
- ResponseAnalyzer: Prompt building, parsing
- UpdateSuggester: Filtering, ranking
- DiffViewer: Diff computation

### Integration Tests
- Full flow: Activation → Analysis → Suggestion → Update
- Multi-entry scenarios
- Error handling

### Manual Tests
- Various lorebook types
- Different LLM APIs
- UI responsiveness
- Performance with large lorebooks

---

## Performance Considerations

1. **Analysis Throttling:** Delay analysis by 2 seconds to batch rapid messages
2. **Caching:** LRU cache for analysis results (100 entries)
3. **History Pruning:** Keep only last 100 activations in memory
4. **Diff Computation:** Use efficient diff-match-patch library
5. **Batch Updates:** Group updates by lorebook for single save

---

## Security & Privacy

- All data stays local (no external APIs except user's chosen LLM)
- No telemetry or tracking
- User controls all updates (approval required by default)
- Full undo capability
- Automatic backups before changes

---

## Future Enhancements

### Phase 2 Features
- Automatic new entry creation
- Batch update mode for multiple messages
- Export/import of update histories
- Custom prompt templates

### Phase 3 Features
- Collaborative filtering (learn from patterns)
- Version control integration
- AI-powered entry merging
- Cross-entry relationship detection

---

This design document serves as the complete specification for implementing the Dynamic Lorebook Manager extension for SillyTavern.
