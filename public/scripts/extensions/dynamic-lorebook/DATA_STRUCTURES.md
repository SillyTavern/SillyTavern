# Dynamic Lorebook Manager - Data Structures Reference

This document provides comprehensive documentation of all data structures used in the Dynamic Lorebook Manager extension.

## Table of Contents

1. [Core Data Structures](#core-data-structures)
2. [Event Payloads](#event-payloads)
3. [Configuration Structures](#configuration-structures)
4. [UI State Structures](#ui-state-structures)
5. [Storage Structures](#storage-structures)
6. [Type Definitions](#type-definitions)

---

## Core Data Structures

### ActivationRecord

Represents a complete record of lorebook entries activated during a single generation.

```typescript
interface ActivationRecord {
  // Identification
  id: string;                         // Unique record ID (UUID)
  messageId: string;                  // Associated chat message ID
  timestamp: number;                  // Unix timestamp (milliseconds)

  // Activated entries
  entries: ActivatedEntry[];          // Array of activated entries

  // Scan context
  scanState: ScanState;               // Scan metadata

  // Generation context
  generationContext: GenerationContext;

  // Metadata
  totalTokens: number;                // Total tokens used by entries
  budgetUsed: number;                 // Percentage of budget consumed
  recursionDepth: number;             // Final recursion depth reached
}
```

**Example:**
```javascript
{
  id: "ar_a8f3d9c1-4e2b-4f9a-8c7d-6e5a3b2c1d0e",
  messageId: "msg_12345",
  timestamp: 1710432000000,
  entries: [
    {
      uid: 5,
      key: ["eldoria", "forest"],
      matchedKey: "eldoria",
      worldName: "MyWorld",
      content: "Eldoria is a magical forest...",
      comment: "Eldoria - Main Setting",
      // ... more fields
    }
  ],
  scanState: {
    depth: 4,
    budget: 2048,
    bufferSize: 1024,
    recursionLevel: 0
  },
  generationContext: {
    characterName: "Luna",
    userName: "User",
    chatName: "main_chat",
    trigger: "normal"
  },
  totalTokens: 156,
  budgetUsed: 7.6,
  recursionDepth: 0
}
```

---

### ActivatedEntry

Details of a single activated lorebook entry.

```typescript
interface ActivatedEntry {
  // Core identification
  uid: number;                        // Entry unique ID
  worldName: string;                  // Source lorebook name

  // Content
  content: string;                    // Entry content text
  comment: string;                    // Entry comment/title

  // Matching details
  key: string[];                      // All primary keywords
  keysecondary: string[];            // All secondary keywords
  matchedKey: string;                 // Specific keyword that triggered
  matchType: 'primary' | 'secondary' | 'constant' | 'decorator';

  // Entry configuration
  order: number;                      // Priority order
  position: number;                   // Position in prompt (0-7)
  depth: number;                      // Depth setting
  probability: number;                // Probability (0-100)
  constant: boolean;                  // Always active flag

  // Advanced settings
  selective: boolean;
  selectiveLogic: number;            // 0-3 (AND_ANY, NOT_ALL, etc.)
  excludeRecursion: boolean;
  preventRecursion: boolean;
  delayUntilRecursion: number;

  // Full metadata (optional, for detailed analysis)
  metadata?: WorldInfoEntry;         // Complete entry object

  // Tracking
  activationCount: number;           // Times activated in session
  lastActivated: number;             // Last activation timestamp
  tokensUsed: number;               // Tokens in this activation
}
```

**Example:**
```javascript
{
  uid: 5,
  worldName: "FantasyWorld",
  content: "Eldoria is an ancient magical forest filled with mystical creatures.",
  comment: "Eldoria - Main Setting",
  key: ["eldoria", "magical forest", "forest"],
  keysecondary: ["ancient trees", "mystical"],
  matchedKey: "eldoria",
  matchType: "primary",
  order: 100,
  position: 0,
  depth: 4,
  probability: 100,
  constant: false,
  selective: true,
  selectiveLogic: 0,
  excludeRecursion: false,
  preventRecursion: false,
  delayUntilRecursion: 0,
  activationCount: 3,
  lastActivated: 1710432000000,
  tokensUsed: 156
}
```

---

### ScanState

Metadata about the World Info scanning process.

```typescript
interface ScanState {
  // Scan parameters
  depth: number;                     // Messages scanned backward
  budget: number;                    // Token budget limit
  budgetCap: number;                 // Hard token cap

  // Buffer details
  bufferSize: number;               // Total context buffer size (tokens)
  scannedMessages: number;          // Number of messages included

  // Recursion
  recursionLevel: number;           // Current recursion depth (0 = initial)
  maxRecursionSteps: number;        // Maximum recursion allowed
  recursionStopped: boolean;        // Hit recursion limit flag

  // Performance
  scanDuration: number;             // Scan time in milliseconds
  entriesEvaluated: number;         // Total entries checked
  entriesActivated: number;         // Entries that passed checks
  entriesRejected: number;          // Entries that failed checks

  // Budget tracking
  budgetOverflow: boolean;          // Budget limit reached
  budgetRemaining: number;          // Tokens remaining in budget
}
```

**Example:**
```javascript
{
  depth: 4,
  budget: 2048,
  budgetCap: 4096,
  bufferSize: 1024,
  scannedMessages: 4,
  recursionLevel: 0,
  maxRecursionSteps: 3,
  recursionStopped: false,
  scanDuration: 45,
  entriesEvaluated: 25,
  entriesActivated: 3,
  entriesRejected: 22,
  budgetOverflow: false,
  budgetRemaining: 1892
}
```

---

### GenerationContext

Context information about the current generation.

```typescript
interface GenerationContext {
  // Participants
  characterName: string;            // Active character name
  userName: string;                 // User name

  // Chat context
  chatName: string;                 // Active chat file name
  groupId: string | null;           // Group chat ID (if group)

  // Generation type
  trigger: GenerationTrigger;       // What triggered generation

  // Persona/Character data
  personaDescription: string;       // User persona text
  characterDescription: string;     // Character description
  characterPersonality: string;     // Character personality
  scenario: string;                 // Current scenario

  // Settings
  maxContext: number;               // Context size limit
  instructMode: boolean;            // Instruct mode active
}

type GenerationTrigger =
  | 'normal'      // Regular message
  | 'continue'    // Continue generation
  | 'regenerate'  // Regenerate response
  | 'swipe'       // Swipe alternative
  | 'impersonate' // Impersonate user
  | 'quiet';      // Quiet generation
```

**Example:**
```javascript
{
  characterName: "Luna the Sorceress",
  userName: "Traveler",
  chatName: "eldoria_adventure",
  groupId: null,
  trigger: "normal",
  personaDescription: "A brave adventurer seeking knowledge",
  characterDescription: "Luna is a wise and powerful sorceress...",
  characterPersonality: "Mysterious, helpful, patient",
  scenario: "Luna is teaching magic in the forest of Eldoria",
  maxContext: 8192,
  instructMode: false
}
```

---

### AnalysisResult

Output from the ResponseAnalyzer module.

```typescript
interface AnalysisResult {
  // Identification
  id: string;                       // Analysis ID (UUID)
  messageId: string;                // Source message ID
  timestamp: number;                // Analysis timestamp

  // Analysis output
  updates: EntryUpdate[];           // Suggested updates
  newEntities: NewEntity[];         // Suggested new entries

  // Metadata
  confidence: number;               // Overall confidence (0-1)
  processingTime: number;           // Analysis duration (ms)
  modelUsed: string;                // LLM model used
  promptTokens: number;             // Prompt tokens sent
  completionTokens: number;         // Completion tokens received

  // Quality metrics
  hallucination: Risk;              // Hallucination risk assessment
  relevance: number;                // Relevance score (0-1)
  novelty: number;                  // Novelty score (0-1)

  // Error handling
  errors: AnalysisError[];          // Any errors encountered
  warnings: string[];               // Warning messages
}

type AnalysisError = {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  recoverable: boolean;
};
```

**Example:**
```javascript
{
  id: "analysis_f4e8d2c1-9a3b-4f7e-8d6c-5a4b3c2d1e0f",
  messageId: "msg_12345",
  timestamp: 1710432001000,
  updates: [
    {
      entryUid: 5,
      entryComment: "Eldoria - Main Setting",
      worldName: "FantasyWorld",
      confidence: 0.87,
      changeType: "expansion",
      // ... more fields
    }
  ],
  newEntities: [
    {
      name: "Crystal Lake",
      description: "A mystical lake in Eldoria where fairies gather",
      suggestedKeywords: ["crystal lake", "fairy lake"],
      relevance: "Mentioned as important location in Eldoria",
      confidence: 0.92
    }
  ],
  confidence: 0.87,
  processingTime: 1250,
  modelUsed: "gpt-4-turbo",
  promptTokens: 456,
  completionTokens: 189,
  hallucination: "low",
  relevance: 0.91,
  novelty: 0.85,
  errors: [],
  warnings: []
}
```

---

### EntryUpdate

A suggested update to a single lorebook entry.

```typescript
interface EntryUpdate {
  // Target entry
  entryUid: number;
  entryComment: string;
  worldName: string;

  // Analysis
  confidence: number;               // Confidence score (0-1)
  changeType: ChangeType;           // Type of change
  reasoning: string;                // Explanation of why

  // Extracted information
  extractedInfo: ExtractedFact[];   // New facts found

  // Content changes
  originalContent: string;          // Current entry content
  suggestedNewContent: string;      // Proposed new content
  contentDiff: DiffResult;          // Computed diff

  // Keyword changes (optional)
  keywordsToAdd: string[];          // New keywords to add
  keywordsToRemove: string[];       // Keywords to remove

  // Metadata changes (optional)
  commentUpdate: string | null;     // New comment if applicable

  // Statistics
  metadata: UpdateMetadata;

  // Timestamps
  createdAt: number;
  lastModified: number;
}

type ChangeType =
  | 'expansion'   // Adding new information
  | 'correction'  // Fixing incorrect information
  | 'addition'    // Adding completely new aspects
  | 'refinement'  // Improving existing text
  | 'merge';      // Merging multiple facts

interface ExtractedFact {
  fact: string;                     // The extracted fact
  relevance: string;                // Why it's relevant
  suggestedIntegration: string;     // How to integrate it
  confidence: number;               // Fact confidence (0-1)
  source: string;                   // Where in message it came from
}

interface UpdateMetadata {
  tokensAdded: number;              // Tokens added by update
  tokensRemoved: number;            // Tokens removed
  netTokenChange: number;           // Net change
  characterCountChange: number;     // Character count delta
  structurePreserved: boolean;      // Original structure kept
  styleConsistent: boolean;         // Style matches original
}
```

**Example:**
```javascript
{
  entryUid: 5,
  entryComment: "Eldoria - Main Setting",
  worldName: "FantasyWorld",
  confidence: 0.87,
  changeType: "expansion",
  reasoning: "The AI introduced significant new details about Eldoria that enhance the setting",
  extractedInfo: [
    {
      fact: "Crystal Lake exists in Eldoria where fairies gather at moonrise",
      relevance: "Adds specific geographical feature and creature behavior",
      suggestedIntegration: "Add as second sentence or new paragraph",
      confidence: 0.92,
      source: "The forest is also home to the Crystal Lake, where fairies gather at moonrise"
    },
    {
      fact: "The Sentinel Oak is the oldest tree, over 3000 years old",
      relevance: "Provides historical depth and notable landmark",
      suggestedIntegration: "Add as final detail or separate sentence",
      confidence: 0.85,
      source: "The oldest tree, called the Sentinel Oak, has stood for over 3000 years"
    }
  ],
  originalContent: "Eldoria is a magical forest with ancient trees.",
  suggestedNewContent: "Eldoria is a magical forest with ancient trees. The forest is home to the Crystal Lake, a mystical body of water where fairies gather at moonrise. Among the ancient trees stands the Sentinel Oak, the oldest tree in Eldoria at over 3000 years old, serving as a landmark for travelers.",
  contentDiff: {
    // ... diff object (see DiffResult structure)
  },
  keywordsToAdd: ["crystal lake", "sentinel oak", "fairies"],
  keywordsToRemove: [],
  commentUpdate: null,
  metadata: {
    tokensAdded: 45,
    tokensRemoved: 0,
    netTokenChange: 45,
    characterCountChange: 187,
    structurePreserved: true,
    styleConsistent: true
  },
  createdAt: 1710432001000,
  lastModified: 1710432001000
}
```

---

### NewEntity

Suggestion for creating a new lorebook entry.

```typescript
interface NewEntity {
  // Entity details
  name: string;                     // Entity name
  description: string;              // Brief description
  fullContent: string;              // Suggested full entry content

  // Keywords
  suggestedKeywords: string[];      // Primary keywords
  suggestedSecondaryKeywords: string[]; // Secondary keywords

  // Relevance
  relevance: string;                // Why this should be an entry
  confidence: number;               // Confidence score (0-1)

  // Categorization
  category: EntityCategory;         // Type of entity
  relatedEntries: number[];         // Related existing entry UIDs

  // Suggested settings
  suggestedSettings: Partial<WorldInfoEntry>;

  // Source
  sourceMessage: string;            // Where it was mentioned
  sourceContext: string;            // Context excerpt
}

type EntityCategory =
  | 'location'
  | 'character'
  | 'object'
  | 'concept'
  | 'event'
  | 'organization'
  | 'other';
```

**Example:**
```javascript
{
  name: "Crystal Lake",
  description: "A mystical lake in Eldoria where fairies gather",
  fullContent: "Crystal Lake is a mystical body of water located in the heart of the Eldoria forest. The lake is known for attracting fairies, who gather at its shores during moonrise to perform their nightly rituals. The water is said to have magical properties.",
  suggestedKeywords: ["crystal lake", "fairy lake", "mystical lake"],
  suggestedSecondaryKeywords: ["moonrise", "magical water"],
  relevance: "Significant location mentioned in connection with Eldoria and fairy behavior",
  confidence: 0.92,
  category: "location",
  relatedEntries: [5],  // Related to Eldoria entry
  suggestedSettings: {
    order: 95,
    position: 0,
    depth: 4,
    probability: 100,
    selective: true
  },
  sourceMessage: "The forest is also home to the Crystal Lake, where fairies gather at moonrise.",
  sourceContext: "...magical forest with ancient trees. The forest is also home to the Crystal Lake..."
}
```

---

### Suggestion

A user-facing suggestion object (combines analysis with UI state).

```typescript
interface Suggestion {
  // Identification
  id: string;                       // Unique suggestion ID (UUID)
  type: 'update' | 'new-entry';    // Suggestion type

  // For updates
  entryUid?: number;
  entryComment?: string;
  worldName?: string;

  // For new entries
  entityName?: string;
  category?: EntityCategory;

  // Content
  originalContent: string;          // Current content (or empty for new)
  suggestedContent: string;         // Proposed content
  diff: DiffResult | null;          // Diff (null for new entries)

  // Analysis data
  confidence: number;
  changeType: ChangeType | null;
  reasoning: string;
  impact: number;                   // Impact score (0-1)

  // Additional changes
  keywordChanges: KeywordChanges | null;
  commentChange: string | null;

  // UI State
  status: SuggestionStatus;
  userModified: boolean;
  editedContent: string | null;
  expanded: boolean;                // UI: Is details panel expanded

  // User interaction
  createdAt: number;
  viewedAt: number | null;
  reviewedAt: number | null;
  appliedAt: number | null;

  // Metadata
  sourceMessageId: string;
  sourceMessageText: string;        // Truncated
  activatedEntriesCount: number;
}

type SuggestionStatus =
  | 'pending'     // Awaiting review
  | 'approved'    // Approved by user
  | 'rejected'    // Rejected by user
  | 'edited'      // User modified suggestion
  | 'applied'     // Successfully applied
  | 'failed';     // Application failed

interface KeywordChanges {
  add: string[];
  remove: string[];
  reason: string;
}
```

**Example:**
```javascript
{
  id: "sug_c7d8e9f1-2a3b-4c5d-6e7f-8g9h0i1j2k3l",
  type: "update",
  entryUid: 5,
  entryComment: "Eldoria - Main Setting",
  worldName: "FantasyWorld",
  originalContent: "Eldoria is a magical forest with ancient trees.",
  suggestedContent: "Eldoria is a magical forest with ancient trees. The forest is home to the Crystal Lake...",
  diff: {
    // ... diff object
  },
  confidence: 0.87,
  changeType: "expansion",
  reasoning: "Added Crystal Lake and Sentinel Oak details",
  impact: 0.75,
  keywordChanges: {
    add: ["crystal lake", "sentinel oak"],
    remove: [],
    reason: "New locations mentioned"
  },
  commentChange: null,
  status: "pending",
  userModified: false,
  editedContent: null,
  expanded: false,
  createdAt: 1710432001000,
  viewedAt: null,
  reviewedAt: null,
  appliedAt: null,
  sourceMessageId: "msg_12345",
  sourceMessageText: "Eldoria is a magical forest with ancient trees. The forest is...",
  activatedEntriesCount: 3
}
```

---

### DiffResult

Represents a computed diff between old and new content.

```typescript
interface DiffResult {
  // Diff chunks
  chunks: DiffChunk[];

  // Statistics
  stats: DiffStats;

  // Formatting options
  format: 'inline' | 'side-by-side';
}

interface DiffChunk {
  type: 'equal' | 'insert' | 'delete';
  content: string;
  lineNumber: number;               // Line number in original (if line-based)
  startChar: number;                // Start character position
  endChar: number;                  // End character position
}

interface DiffStats {
  insertions: number;               // Characters added
  deletions: number;                // Characters removed
  changes: number;                  // Total changes
  unchanged: number;                // Unchanged characters
  similarity: number;               // Similarity score (0-1)
}
```

**Example:**
```javascript
{
  chunks: [
    {
      type: "equal",
      content: "Eldoria is a magical forest with ancient trees.",
      lineNumber: 1,
      startChar: 0,
      endChar: 47
    },
    {
      type: "insert",
      content: " The forest is home to the Crystal Lake, a mystical body of water where fairies gather at moonrise.",
      lineNumber: 1,
      startChar: 47,
      endChar: 147
    },
    {
      type: "insert",
      content: " Among the ancient trees stands the Sentinel Oak, the oldest tree in Eldoria at over 3000 years old.",
      lineNumber: 1,
      startChar: 147,
      endChar: 247
    }
  ],
  stats: {
    insertions: 200,
    deletions: 0,
    changes: 200,
    unchanged: 47,
    similarity: 0.19
  },
  format: "inline"
}
```

---

## Event Payloads

### WORLDINFO_ACTIVATED Event

```typescript
interface WorldInfoActivatedPayload {
  entries: ActivatedEntry[];        // Activated entries
  scanState: ScanState;             // Scan metadata
  generationContext: GenerationContext;
  timestamp: number;
}
```

### MESSAGE_RECEIVED Event

```typescript
interface MessageReceivedPayload {
  messageId: string;
  text: string;                     // Message content
  characterName: string;
  isUser: boolean;
  timestamp: number;
  metadata: {
    swipeId: number | null;
    regenerated: boolean;
    continued: boolean;
  };
}
```

### WORLDINFO_UPDATED Event

```typescript
interface WorldInfoUpdatedPayload {
  worldName: string;
  data: WorldInfoData;              // Updated lorebook data
  changedEntries: number[];         // UIDs of changed entries
  source: 'user' | 'extension' | 'import';
  timestamp: number;
}
```

---

## Configuration Structures

### ExtensionSettings

```typescript
interface ExtensionSettings {
  // Core settings
  enabled: boolean;
  updateMode: UpdateMode;
  aggressiveness: Aggressiveness;
  minConfidence: number;            // 0.0 - 1.0

  // Update scope
  updateFields: UpdateField[];
  enabledLorebooks: string[];       // Empty = all

  // Behavior
  autoBackup: boolean;
  showNotifications: boolean;
  requireApproval: boolean;
  batchMode: boolean;

  // Analysis
  analysisModel: string;            // 'auto' or specific model
  analysisDelay: number;            // Milliseconds
  promptTemplate: string;           // Template name
  maxHistorySize: number;

  // Performance
  cacheSize: number;
  throttleDelay: number;
  maxConcurrentAnalyses: number;

  // UI
  defaultView: 'compact' | 'detailed';
  showDiffInline: boolean;
  highlightChanges: boolean;
  expandSuggestions: boolean;

  // Advanced
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  telemetry: boolean;
}

type UpdateMode =
  | 'manual'         // User must trigger analysis
  | 'auto-suggest'   // Auto-analyze, show suggestions
  | 'auto-approve';  // Auto-analyze and apply (high confidence only)

type Aggressiveness =
  | 'conservative'   // Only obvious expansions
  | 'balanced'       // Balanced approach
  | 'aggressive';    // Include refinements and style changes

type UpdateField =
  | 'content'        // Entry content
  | 'keywords'       // Primary keywords
  | 'secondaryKeys'  // Secondary keywords
  | 'comment';       // Entry comment
```

---

## Storage Structures

### UpdateRecord

Stored in UpdateHistory for undo/redo.

```typescript
interface UpdateRecord {
  // Identification
  id: string;
  timestamp: number;
  type: 'single' | 'batch';

  // Target
  worldName: string;

  // Changes
  changes: EntryChange[];

  // Suggestions that led to this update
  suggestionIds: string[];

  // Context
  metadata: UpdateRecordMetadata;

  // State
  undone: boolean;
  redone: boolean;
}

interface EntryChange {
  entryUid: number;
  entryComment: string;
  before: Partial<WorldInfoEntry>;  // Backup
  after: Partial<WorldInfoEntry>;   // New state
  fields: string[];                 // Fields that changed
}

interface UpdateRecordMetadata {
  messageId: string;
  chatName: string;
  characterName: string;
  userName: string;
  extensionVersion: string;
}
```

---

## Type Definitions

### WorldInfoEntry

Complete lorebook entry structure (from SillyTavern).

```typescript
interface WorldInfoEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  selectiveLogic: number;
  order: number;
  position: number;
  disable: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  probability: number;
  useProbability: boolean;
  depth: number;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  useGroupScoring: boolean | null;
  automationId: string;
  role: number;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
  vectorized: boolean;
  ignoreBudget: boolean;
  displayIndex: number;
  addMemo: boolean;
  // Character filtering
  characterFilter?: {
    names: string[];
    tags: string[];
    isExclude: boolean;
  };
  // Activation tracking
  decorators?: string[];
  hash?: string;
}
```

### WorldInfoData

Complete lorebook data structure.

```typescript
interface WorldInfoData {
  entries: Record<number, WorldInfoEntry>;
  originalData?: any;               // Original format for some imports
}
```

### Risk

Risk assessment enumeration.

```typescript
type Risk = 'low' | 'medium' | 'high' | 'critical';
```

---

## Data Validation

### Validation Functions

```typescript
// Validate ActivationRecord
function isValidActivationRecord(obj: any): obj is ActivationRecord {
  return (
    typeof obj.id === 'string' &&
    typeof obj.messageId === 'string' &&
    typeof obj.timestamp === 'number' &&
    Array.isArray(obj.entries) &&
    obj.entries.every(isValidActivatedEntry) &&
    isValidScanState(obj.scanState)
  );
}

// Validate Suggestion
function isValidSuggestion(obj: any): obj is Suggestion {
  return (
    typeof obj.id === 'string' &&
    (obj.type === 'update' || obj.type === 'new-entry') &&
    typeof obj.confidence === 'number' &&
    obj.confidence >= 0 && obj.confidence <= 1 &&
    typeof obj.suggestedContent === 'string'
  );
}

// Validate confidence score
function isValidConfidence(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 1;
}
```

---

## Data Transformations

### Converting Analysis to Suggestions

```typescript
function analysisToSuggestions(
  analysis: AnalysisResult,
  activations: ActivationRecord,
  settings: ExtensionSettings
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Convert updates
  for (const update of analysis.updates) {
    if (update.confidence < settings.minConfidence) {
      continue;
    }

    const suggestion: Suggestion = {
      id: generateUUID(),
      type: 'update',
      entryUid: update.entryUid,
      entryComment: update.entryComment,
      worldName: update.worldName,
      originalContent: update.originalContent,
      suggestedContent: update.suggestedNewContent,
      diff: update.contentDiff,
      confidence: update.confidence,
      changeType: update.changeType,
      reasoning: update.reasoning,
      impact: calculateImpact(update),
      keywordChanges: {
        add: update.keywordsToAdd,
        remove: update.keywordsToRemove,
        reason: 'New entities mentioned'
      },
      commentChange: update.commentUpdate,
      status: 'pending',
      userModified: false,
      editedContent: null,
      expanded: false,
      createdAt: Date.now(),
      viewedAt: null,
      reviewedAt: null,
      appliedAt: null,
      sourceMessageId: activations.messageId,
      sourceMessageText: truncate(analysis.messageText, 100),
      activatedEntriesCount: activations.entries.length
    };

    suggestions.push(suggestion);
  }

  // Convert new entities (if enabled)
  if (settings.suggestNewEntries) {
    for (const entity of analysis.newEntities) {
      if (entity.confidence < settings.minConfidence) {
        continue;
      }

      const suggestion: Suggestion = {
        id: generateUUID(),
        type: 'new-entry',
        entityName: entity.name,
        category: entity.category,
        originalContent: '',
        suggestedContent: entity.fullContent,
        diff: null,
        confidence: entity.confidence,
        changeType: null,
        reasoning: entity.relevance,
        impact: 0.5,  // Default impact for new entries
        keywordChanges: {
          add: entity.suggestedKeywords,
          remove: [],
          reason: 'New entry keywords'
        },
        commentChange: entity.name,
        status: 'pending',
        userModified: false,
        editedContent: null,
        expanded: false,
        createdAt: Date.now(),
        viewedAt: null,
        reviewedAt: null,
        appliedAt: null,
        sourceMessageId: activations.messageId,
        sourceMessageText: entity.sourceMessage,
        activatedEntriesCount: activations.entries.length
      };

      suggestions.push(suggestion);
    }
  }

  return suggestions;
}
```

---

This comprehensive data structure reference should provide all the information needed to understand the data flow and object shapes throughout the Dynamic Lorebook Manager extension.
