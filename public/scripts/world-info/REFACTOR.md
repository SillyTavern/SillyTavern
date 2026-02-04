# World Info Refactor

## Overview

This document describes the refactoring of SillyTavern's World Info (Lorebook) system from a monolithic 6,174-line file to a modular architecture with significant performance improvements.

**Key Results:**
- 2-6x faster scanning depending on lorebook size
- 100% behavioral equivalence with original
- 221 unit tests + comprehensive E2E test suite
- Modular, maintainable codebase

---

## Architecture

### Before: Monolithic (world-info-original.js)

```
world-info-original.js (6,174 lines)
├── Imports & Constants (1-200)
├── WorldInfoBuffer class (199-475)
├── WorldInfoTimedEffects class (480-795)
├── Settings functions (797-872)
├── UI Registration (1051-2070)
├── UI Management (2070-4038)
├── checkWorldInfo() main loop (4490-5057)
├── Group filtering (5067-5250)
└── Converters & utilities (5252-6174)
```

**Problems:**
- Per-entry sequential keyword matching: O(entries × keys × buffer_length)
- No caching of match results or compiled patterns
- Repeated token counting on accumulated strings: O(n²)
- Mixed UI/logic makes unit testing impossible

### After: Modular (world-info/)

```
world-info/
├── scanning/                    # Core scanning pipeline
│   ├── index.js                # Main checkWorldInfo() - 800 lines
│   ├── entry-collection.js     # Entry aggregation from all sources
│   ├── filtering.js            # Inclusion group logic
│   ├── AhoCorasickMatcher.js   # Bulk keyword matching
│   ├── ACCacheManager.js       # Automaton caching
│   └── BufferSignature.js      # Entry grouping by scan config
├── entry/                       # Entry CRUD operations
├── persistence/                 # File I/O and caching
├── editor/                      # UI components
├── pure-functions.js           # Testable pure functions
├── utilities.js                # Re-exports for compatibility
├── WorldInfoBuffer.js          # Text buffer management
├── WorldInfoTimedEffects.js    # Sticky/cooldown/delay
├── state.js                    # Centralized settings
└── constants.js                # Enums and type definitions
```

---

## Performance Optimizations

### 1. Aho-Corasick Bulk Matching

**Problem:** Original scans buffer once per keyword per entry
**Solution:** Build automaton of all keywords, scan buffer once

| Approach | Complexity |
|----------|------------|
| Original | O(buffer × entries × keys_per_entry) |
| AC | O(buffer + total_keywords) |

**Implementation:** `AhoCorasickMatcher.js`
- Builds dual automata (case-sensitive + case-insensitive)
- Handles regex patterns separately
- Returns `Map<entryId, MatchResult[]>`

### 2. Buffer Signature Grouping

**Problem:** Entries with same scan config rebuild identical buffers
**Solution:** Group entries by signature, share buffer construction

```javascript
signature = {
  scanDepth,
  matchPersonaDescription,
  matchCharacterDescription,
  matchCharacterPersonality,
  matchCharacterDepthPrompt,
  matchScenario,
  matchCreatorNotes
}
```

**Example:** 1000 entries with depth=4 → 1 buffer build, not 1000

### 3. AC Cache with Event Invalidation

**Problem:** Rebuilding automaton every scan is expensive
**Solution:** Cache automaton, invalidate on relevant events

```javascript
// Invalidation triggers
eventSource.on(CHAT_CHANGED, () => cache.clear())
eventSource.on(WORLDINFO_UPDATED, () => cache.clear())
eventSource.on(WORLDINFO_SETTINGS_UPDATED, () => cache.clear())
```

**Pre-building:** On invalidation, schedule pre-build with 100ms debounce

### 4. Static Filter Caching

**Problem:** Checking disabled/trigger/character filters every loop iteration
**Solution:** Pre-compute once, O(1) lookup in main loop

```javascript
const staticFilterCache = new Map();
for (const entry of sortedEntries) {
  staticFilterCache.set(entryId, applyStaticFilters(entry, context));
}
```

### 5. Pre-computed Token Counting

**Problem:** Original re-counts accumulated string per entry: O(n²)
**Solution:** Count each entry once, track running total: O(n)

```javascript
// OLD: Re-count entire string each time
if (textToScanTokens + await getTokenCountAsync(allText + newContent) >= budget)

// NEW: Pre-compute, track running total
const entryTokens = precomputed.get(entryId).tokens;
if (textToScanTokens + runningTotal + entryTokens >= budget)
runningTotal += entryTokens;
```

### 6. Pure Functions Extraction

**Problem:** Core logic mixed with UI/state, untestable
**Solution:** Extract to `pure-functions.js`

Extracted functions:
- `applyStaticFilters()` - Disabled/trigger/character filters
- `matchKeysPure()` - Keyword matching logic
- `isWholeWordMatch()` - Word boundary checking
- `getScoreFromMatches()` - Match scoring
- `parseInclusionGroups()` - Group parsing
- `getRecursionDelayLevels()` - Delay level extraction
- `getEntryId()` - Unique entry identifier

---

## Benchmark Results

### Overall Performance (Realistic Chat + Keywords)

| Entries | Legacy | AC Warm | Speedup |
|---------|--------|---------|---------|
| 100 | 17.9ms | 3.2ms | **5.60x** |
| 5,000 | 85.7ms | 28.3ms | **3.03x** |
| 25,000 | 370.8ms | 157.8ms | **2.35x** |
| 100,000 | 1,462.8ms | 671.2ms | **2.18x** |

### AC Timing Breakdown (25k entries)

| Phase | Time | % of Total |
|-------|------|------------|
| AC Build (cold) | ~50ms | 32% |
| AC Search | ~20ms | 13% |
| Post-filtering | ~30ms | 19% |
| Budget/tokens | ~40ms | 25% |
| Other | ~17.8ms | 11% |

**Note:** AC Build only occurs on cold cache. Warm cache eliminates this entirely.

### Cache Hit Rates

- Same chat, same entries: 100% hit rate
- Recursion rounds: 100% hit rate (same signatures)
- Chat changed: Full rebuild (expected)

---

## Behavioral Equivalence

The refactor maintains **100% behavioral equivalence**. All logic paths produce identical results:

| Feature | Status | Notes |
|---------|--------|-------|
| Keyword matching | ✓ Identical | Regex, whole word, case sensitivity |
| Selective logic | ✓ Identical | AND_ANY, AND_ALL, NOT_ANY, NOT_ALL |
| Recursion | ✓ Identical | exclude/prevent/delay flags |
| Budget handling | ✓ Identical | Overflow, ignoreBudget |
| Inclusion groups | ✓ Identical | Scoring, weight, probability |
| Entry ordering | ✓ Identical | Sticky priority, original order |
| Character filters | ✓ Identical | Name/tag include/exclude |
| Trigger filters | ✓ Identical | Generation type matching |
| Timed effects | ✓ Identical | Sticky, cooldown, delay |

**Verified by:**
- `WorldInfoACComparison.e2e.js` - Runs same inputs through Legacy and AC, compares results
- 221 unit tests covering pure functions
- E2E tests for all edge cases

---

## Design Decisions

### Why Dual AC Automata?

Entries can override global case sensitivity. Building two automata (case-sensitive and case-insensitive) allows each entry to use its own setting while still batching all matches.

### Why Buffer Signatures as Cache Keys?

Entries with identical scan configuration (depth, persona matching, etc.) produce identical buffer text. Grouping by signature means:
- One buffer build per signature, not per entry
- AC automaton shared across all entries in group
- Recursion rounds hit cache for all signatures

### Why Pre-parsed Inclusion Groups?

Original splits `entry.group` string on every filter pass:
```javascript
entry.group.split(/,\s*/).filter(x => x)
```

Pre-parsing during entry collection avoids repeated regex operations.

### Why Event-driven Cache Invalidation?

Explicit invalidation on `CHAT_CHANGED`, `WORLDINFO_UPDATED` ensures:
- No stale cache risk
- Automatic correctness without manual cache management
- Pre-building opportunity (100ms debounce)

### Why state.js for Settings?

ES module bindings are read-only. Centralizing settings with setter functions avoids "Assignment to constant variable" errors while maintaining clean imports.

### Why Pure Functions Module?

Extracting pure functions enables:
- Unit testing without browser context
- No mocking required for core logic
- Clear separation of concerns
- Reusable across modules

---

## Module Responsibilities

| Module | Purpose |
|--------|---------|
| `scanning/index.js` | Main loop, state machine (INITIAL→RECURSION→MIN_ACTIVATIONS) |
| `AhoCorasickMatcher.js` | Build/search keyword automaton |
| `ACCacheManager.js` | Singleton cache with event invalidation |
| `BufferSignature.js` | Group entries by scan configuration |
| `entry-collection.js` | Aggregate entries from global/character/chat/persona |
| `filtering.js` | Inclusion group filters, scoring, weighted random |
| `pure-functions.js` | Testable keyword/filter logic |
| `WorldInfoBuffer.js` | Text buffer with depth/recursion management |
| `WorldInfoTimedEffects.js` | Sticky/cooldown/delay effect tracking |
| `state.js` | Centralized settings with setters |

---

## Running Tests

### Prerequisites

```bash
cd tests
npm install
npx playwright install chromium
```

### Unit Tests

```bash
cd tests
npm run test:unit
```

Runs 221 tests covering:
- Pure functions (matching, filtering, scoring)
- Buffer signatures
- Aho-Corasick matcher
- Recursion delay logic

### E2E Tests (World Info)

```bash
cd tests

# Start test server (runs on port 8001 with isolated data)
node e2e-test-server.js start

# Run all World Info tests
npx playwright test --config=playwright.world-info.config.js

# Run specific test file
npx playwright test frontend/WorldInfoBenchmark.e2e.js --config=playwright.world-info.config.js

# Stop test server when done
node e2e-test-server.js stop
```

### Benchmarks Only

```bash
cd tests
node e2e-test-server.js start
npx playwright test frontend/WorldInfoBenchmark.e2e.js --config=playwright.world-info.config.js
node e2e-test-server.js stop
```

### Lint

```bash
# Main codebase
npm run lint

# Tests
cd tests && npm run lint
```

---

## Test Files

| File | Purpose |
|------|---------|
| `WorldInfoACComparison.e2e.js` | Legacy vs AC result comparison |
| `WorldInfoBenchmark.e2e.js` | Performance benchmarks |
| `WorldInfoCacheInvalidation.e2e.js` | Cache behavior verification |
| `WorldInfoMatching.e2e.js` | Keyword matching edge cases |
| `WorldInfoFilterEdgeCases.e2e.js` | Filter logic edge cases |
| `WorldInfoGroupsAndProbability.e2e.js` | Groups, probability, positions |
| `WorldInfoRecursionComplex.e2e.js` | Complex recursion scenarios |
| `WorldInfoBudgetTests.e2e.js` | Budget overflow handling |
| `unit/world-info/*.test.js` | Unit tests for pure functions |
