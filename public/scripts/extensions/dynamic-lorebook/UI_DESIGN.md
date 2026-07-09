# Dynamic Lorebook Manager - UI Design

This document provides comprehensive UI/UX design specifications for the Dynamic Lorebook Manager extension.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Component Library](#component-library)
3. [User Flows](#user-flows)
4. [Screen Layouts](#screen-layouts)
5. [Interaction Patterns](#interaction-patterns)
6. [Styling and Themes](#styling-and-themes)

---

## Design Principles

### 1. Non-Intrusive
- Extension should not interrupt chat flow
- Suggestions appear after generation completes
- Dismissible notifications
- Minimal visual footprint when inactive

### 2. Clarity
- Clear diff visualization (old vs new)
- Confidence indicators for all suggestions
- Explicit action buttons (no ambiguity)
- Detailed reasoning always available

### 3. Control
- User has final say on all changes
- Easy to edit suggestions before applying
- Undo/redo always available
- Batch operations supported

### 4. Consistency
- Follows SillyTavern's design language
- Reuses existing UI patterns
- Consistent terminology
- Predictable behavior

---

## Component Library

### 1. Diff Viewer Component

Visual diff display for comparing old and new content.

#### Structure

```html
<div class="dlm-diff-viewer">
    <div class="dlm-diff-header">
        <div class="dlm-diff-title">Content Changes</div>
        <div class="dlm-diff-stats">
            <span class="dlm-stat dlm-stat-add">+187 chars</span>
            <span class="dlm-stat dlm-stat-remove">-0 chars</span>
        </div>
    </div>

    <div class="dlm-diff-modes">
        <button class="dlm-diff-mode active" data-mode="inline">Inline</button>
        <button class="dlm-diff-mode" data-mode="side-by-side">Side-by-Side</button>
    </div>

    <div class="dlm-diff-content" data-mode="inline">
        <!-- Inline mode -->
        <div class="dlm-diff-line">
            <span class="dlm-diff-equal">Eldoria is a magical forest with ancient trees.</span>
        </div>
        <div class="dlm-diff-line">
            <span class="dlm-diff-insert">The forest is home to the Crystal Lake, a mystical body of water where fairies gather at moonrise.</span>
        </div>
    </div>

    <div class="dlm-diff-legend">
        <span class="dlm-legend-item">
            <span class="dlm-legend-color dlm-legend-equal"></span>
            Unchanged
        </span>
        <span class="dlm-legend-item">
            <span class="dlm-legend-color dlm-legend-insert"></span>
            Added
        </span>
        <span class="dlm-legend-item">
            <span class="dlm-legend-color dlm-legend-delete"></span>
            Removed
        </span>
    </div>
</div>
```

#### Modes

**Inline Mode** (Default)
- Single column view
- Deletions shown with strikethrough in red
- Insertions shown with green background
- Compact and space-efficient

**Side-by-Side Mode**
- Two column layout
- Left: Original content
- Right: New content
- Easy to scan for large changes

#### Visual States

```css
/* Unchanged text */
.dlm-diff-equal {
    color: var(--SmartThemeBodyColor);
}

/* Inserted text */
.dlm-diff-insert {
    background-color: rgba(40, 167, 69, 0.2);
    border-left: 3px solid #28a745;
    padding-left: 4px;
}

/* Deleted text */
.dlm-diff-delete {
    background-color: rgba(220, 53, 69, 0.2);
    border-left: 3px solid #dc3545;
    text-decoration: line-through;
    padding-left: 4px;
    opacity: 0.7;
}
```

---

### 2. Suggestion Card Component

Individual suggestion card with all relevant information.

#### Structure

```html
<div class="dlm-suggestion-card" data-suggestion-id="sug_123" data-status="pending">
    <!-- Header -->
    <div class="dlm-card-header">
        <div class="dlm-card-title">
            <span class="dlm-entry-comment">Eldoria - Main Setting</span>
            <span class="dlm-world-name">FantasyWorld</span>
        </div>
        <div class="dlm-card-meta">
            <span class="dlm-confidence" data-confidence="0.87">
                <span class="dlm-confidence-bar" style="width: 87%"></span>
                <span class="dlm-confidence-text">87% confident</span>
            </span>
            <span class="dlm-change-type" data-type="expansion">Expansion</span>
        </div>
    </div>

    <!-- Body -->
    <div class="dlm-card-body">
        <!-- Diff Viewer -->
        <div class="dlm-diff-viewer">
            <!-- ... diff content ... -->
        </div>

        <!-- Reasoning (collapsible) -->
        <div class="dlm-reasoning">
            <button class="dlm-reasoning-toggle">
                <i class="fa fa-chevron-right"></i>
                Why this change?
            </button>
            <div class="dlm-reasoning-content" hidden>
                <p>The AI introduced significant new details about Eldoria including
                   Crystal Lake and the Sentinel Oak, which add depth to the setting.</p>

                <div class="dlm-extracted-facts">
                    <div class="dlm-fact">
                        <div class="dlm-fact-label">New Fact:</div>
                        <div class="dlm-fact-text">Crystal Lake exists in Eldoria where fairies gather at moonrise</div>
                        <div class="dlm-fact-confidence">92% confidence</div>
                    </div>
                    <div class="dlm-fact">
                        <div class="dlm-fact-label">New Fact:</div>
                        <div class="dlm-fact-text">The Sentinel Oak is the oldest tree, over 3000 years old</div>
                        <div class="dlm-fact-confidence">85% confidence</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Keyword Changes (if any) -->
        <div class="dlm-keyword-changes">
            <div class="dlm-keywords-add">
                <span class="dlm-keywords-label">+ Add keywords:</span>
                <span class="dlm-keyword-tag">crystal lake</span>
                <span class="dlm-keyword-tag">sentinel oak</span>
                <span class="dlm-keyword-tag">fairies</span>
            </div>
        </div>

        <!-- Edit Mode (when user clicks edit) -->
        <div class="dlm-edit-mode" hidden>
            <textarea class="dlm-edit-textarea"></textarea>
            <div class="dlm-edit-actions">
                <button class="dlm-btn dlm-btn-save">
                    <i class="fa fa-check"></i> Save Edit
                </button>
                <button class="dlm-btn dlm-btn-cancel">
                    <i class="fa fa-times"></i> Cancel
                </button>
            </div>
        </div>
    </div>

    <!-- Footer Actions -->
    <div class="dlm-card-footer">
        <button class="dlm-btn dlm-btn-approve">
            <i class="fa fa-check"></i> Approve
        </button>
        <button class="dlm-btn dlm-btn-edit">
            <i class="fa fa-edit"></i> Edit
        </button>
        <button class="dlm-btn dlm-btn-reject">
            <i class="fa fa-times"></i> Reject
        </button>
    </div>
</div>
```

#### States

**Pending** (Default)
- All actions enabled
- Normal colors

**Approved**
- Green border
- Checkmark icon
- Apply button enabled
- Undo button enabled

**Rejected**
- Red border (subtle)
- Strike-through title
- Actions disabled

**Edited**
- Blue border
- Edit icon badge
- Shows "Modified by user" indicator

**Applied**
- Muted appearance
- "Applied" badge
- Only undo available

---

### 3. Approval Dialog Component

Modal dialog for reviewing and approving suggestions.

#### Structure

```html
<div class="dlm-modal" id="dlm-approval-dialog">
    <div class="dlm-modal-overlay"></div>
    <div class="dlm-modal-content">
        <!-- Header -->
        <div class="dlm-modal-header">
            <h2 class="dlm-modal-title">
                <i class="fa fa-magic"></i>
                Lorebook Update Suggestions
            </h2>
            <button class="dlm-modal-close">
                <i class="fa fa-times"></i>
            </button>
        </div>

        <!-- Summary -->
        <div class="dlm-modal-summary">
            <div class="dlm-summary-stat">
                <span class="dlm-summary-number">3</span>
                <span class="dlm-summary-label">Updates</span>
            </div>
            <div class="dlm-summary-stat">
                <span class="dlm-summary-number">1</span>
                <span class="dlm-summary-label">New Entry</span>
            </div>
            <div class="dlm-summary-stat">
                <span class="dlm-summary-number">87%</span>
                <span class="dlm-summary-label">Avg Confidence</span>
            </div>
        </div>

        <!-- Filter/Sort Bar -->
        <div class="dlm-toolbar">
            <div class="dlm-toolbar-left">
                <label>
                    <input type="checkbox" id="dlm-select-all" />
                    Select All
                </label>
                <span class="dlm-selected-count">2 of 4 selected</span>
            </div>
            <div class="dlm-toolbar-right">
                <select class="dlm-sort-select">
                    <option value="confidence">Sort by Confidence</option>
                    <option value="impact">Sort by Impact</option>
                    <option value="order">Sort by Entry Order</option>
                </select>
                <input type="range" min="0" max="100" value="70"
                       class="dlm-confidence-filter"
                       title="Minimum confidence threshold" />
                <span class="dlm-confidence-label">70%</span>
            </div>
        </div>

        <!-- Suggestions List -->
        <div class="dlm-modal-body">
            <div class="dlm-suggestions-list">
                <!-- Suggestion Cards rendered here -->
            </div>
        </div>

        <!-- Batch Actions -->
        <div class="dlm-modal-footer">
            <div class="dlm-footer-left">
                <button class="dlm-btn dlm-btn-secondary" id="dlm-reject-all">
                    <i class="fa fa-times-circle"></i>
                    Reject All
                </button>
            </div>
            <div class="dlm-footer-right">
                <button class="dlm-btn dlm-btn-secondary" id="dlm-cancel">
                    Cancel
                </button>
                <button class="dlm-btn dlm-btn-primary" id="dlm-apply-selected">
                    <i class="fa fa-check-circle"></i>
                    Apply Selected (2)
                </button>
            </div>
        </div>
    </div>
</div>
```

#### Behavior

**Opening**
- Modal slides in from right
- Backdrop fades in
- Focus trapped within modal

**Filtering**
- Confidence slider filters suggestions in real-time
- Below threshold suggestions are hidden

**Sorting**
- Instant re-sort of visible suggestions
- Maintains selection state

**Applying**
- Shows progress indicator
- Updates applied sequentially
- Success/failure notification per update
- Modal closes when complete

---

### 4. Settings Panel Component

Extension settings interface.

#### Structure

```html
<div class="dlm-settings-panel">
    <h3 class="dlm-settings-title">
        <i class="fa fa-cog"></i>
        Dynamic Lorebook Manager
    </h3>

    <!-- Master Enable -->
    <div class="dlm-setting-row">
        <label class="dlm-setting-label">
            <input type="checkbox" id="dlm-enabled" checked />
            Enable Extension
        </label>
        <div class="dlm-setting-help">
            Enable automatic lorebook update detection and suggestions
        </div>
    </div>

    <!-- Update Mode -->
    <div class="dlm-setting-row">
        <label class="dlm-setting-label">Update Mode</label>
        <select id="dlm-update-mode" class="dlm-setting-select">
            <option value="manual">Manual - Only when triggered</option>
            <option value="auto-suggest" selected>Auto-Suggest - Analyze automatically</option>
            <option value="auto-approve">Auto-Approve - High confidence only</option>
        </select>
        <div class="dlm-setting-help">
            How should updates be handled?
        </div>
    </div>

    <!-- Aggressiveness -->
    <div class="dlm-setting-row">
        <label class="dlm-setting-label">Aggressiveness</label>
        <div class="dlm-radio-group">
            <label>
                <input type="radio" name="aggressiveness" value="conservative" />
                Conservative
            </label>
            <label>
                <input type="radio" name="aggressiveness" value="balanced" checked />
                Balanced
            </label>
            <label>
                <input type="radio" name="aggressiveness" value="aggressive" />
                Aggressive
            </label>
        </div>
        <div class="dlm-setting-help">
            Conservative: Only obvious expansions<br />
            Balanced: Expansions and refinements<br />
            Aggressive: Includes style improvements
        </div>
    </div>

    <!-- Confidence Threshold -->
    <div class="dlm-setting-row">
        <label class="dlm-setting-label">
            Minimum Confidence
            <span class="dlm-confidence-value">70%</span>
        </label>
        <input type="range" min="0" max="100" value="70"
               id="dlm-min-confidence" class="dlm-setting-slider" />
        <div class="dlm-setting-help">
            Only show suggestions above this confidence level
        </div>
    </div>

    <!-- Update Fields -->
    <div class="dlm-setting-row">
        <label class="dlm-setting-label">Update Fields</label>
        <div class="dlm-checkbox-group">
            <label>
                <input type="checkbox" name="update-fields" value="content" checked />
                Entry Content
            </label>
            <label>
                <input type="checkbox" name="update-fields" value="keywords" checked />
                Keywords
            </label>
            <label>
                <input type="checkbox" name="update-fields" value="comment" />
                Comment/Title
            </label>
        </div>
    </div>

    <!-- Enabled Lorebooks -->
    <div class="dlm-setting-row">
        <label class="dlm-setting-label">Enabled Lorebooks</label>
        <div class="dlm-lorebook-list">
            <label>
                <input type="checkbox" name="enabled-lorebooks" value="all" checked />
                All Lorebooks
            </label>
            <label>
                <input type="checkbox" name="enabled-lorebooks" value="FantasyWorld" />
                FantasyWorld
            </label>
            <label>
                <input type="checkbox" name="enabled-lorebooks" value="SciFiWorld" />
                SciFiWorld
            </label>
        </div>
    </div>

    <!-- Notifications -->
    <div class="dlm-setting-row">
        <label class="dlm-setting-label">
            <input type="checkbox" id="dlm-show-notifications" checked />
            Show Notifications
        </label>
    </div>

    <!-- Auto Backup -->
    <div class="dlm-setting-row">
        <label class="dlm-setting-label">
            <input type="checkbox" id="dlm-auto-backup" checked />
            Auto-Backup Before Updates
        </label>
    </div>

    <!-- Advanced Settings (Collapsible) -->
    <details class="dlm-setting-section">
        <summary class="dlm-section-header">Advanced Settings</summary>

        <div class="dlm-setting-row">
            <label class="dlm-setting-label">Analysis Model</label>
            <select id="dlm-analysis-model" class="dlm-setting-select">
                <option value="auto" selected>Auto (Use current API)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-4">GPT-4</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
            </select>
        </div>

        <div class="dlm-setting-row">
            <label class="dlm-setting-label">
                Analysis Delay (ms)
                <span class="dlm-delay-value">2000</span>
            </label>
            <input type="number" min="0" max="10000" step="500" value="2000"
                   id="dlm-analysis-delay" class="dlm-setting-input" />
            <div class="dlm-setting-help">
                Wait time before analyzing messages (prevents spam)
            </div>
        </div>

        <div class="dlm-setting-row">
            <label class="dlm-setting-label">
                History Size
                <span class="dlm-history-value">50</span>
            </label>
            <input type="number" min="10" max="200" step="10" value="50"
                   id="dlm-history-size" class="dlm-setting-input" />
            <div class="dlm-setting-help">
                Number of updates to keep for undo/redo
            </div>
        </div>

        <div class="dlm-setting-row">
            <label class="dlm-setting-label">
                <input type="checkbox" id="dlm-debug-mode" />
                Debug Mode
            </label>
        </div>
    </details>

    <!-- Action Buttons -->
    <div class="dlm-settings-actions">
        <button class="dlm-btn dlm-btn-secondary" id="dlm-reset-settings">
            Reset to Defaults
        </button>
        <button class="dlm-btn dlm-btn-primary" id="dlm-save-settings">
            <i class="fa fa-save"></i> Save Settings
        </button>
    </div>
</div>
```

---

### 5. Notification Component

Toast-style notification for status updates.

#### Structure

```html
<div class="dlm-notification" data-type="success">
    <div class="dlm-notification-icon">
        <i class="fa fa-check-circle"></i>
    </div>
    <div class="dlm-notification-content">
        <div class="dlm-notification-title">Update Applied</div>
        <div class="dlm-notification-message">
            Successfully updated "Eldoria - Main Setting"
        </div>
    </div>
    <button class="dlm-notification-close">
        <i class="fa fa-times"></i>
    </button>
    <div class="dlm-notification-progress"></div>
</div>
```

#### Types

**Success** (Green)
- Update applied
- Settings saved
- Operation completed

**Info** (Blue)
- Analysis started
- Suggestions available
- General information

**Warning** (Yellow)
- Low confidence suggestions
- Partial failures
- Cautionary messages

**Error** (Red)
- Update failed
- API errors
- Critical issues

---

### 6. History Panel Component

Undo/redo history viewer.

#### Structure

```html
<div class="dlm-history-panel">
    <div class="dlm-history-header">
        <h4>Update History</h4>
        <div class="dlm-history-actions">
            <button class="dlm-btn dlm-btn-sm" id="dlm-undo" disabled>
                <i class="fa fa-undo"></i> Undo
            </button>
            <button class="dlm-btn dlm-btn-sm" id="dlm-redo" disabled>
                <i class="fa fa-redo"></i> Redo
            </button>
        </div>
    </div>

    <div class="dlm-history-list">
        <div class="dlm-history-item" data-record-id="rec_123">
            <div class="dlm-history-icon">
                <i class="fa fa-edit"></i>
            </div>
            <div class="dlm-history-details">
                <div class="dlm-history-title">Updated "Eldoria - Main Setting"</div>
                <div class="dlm-history-meta">
                    <span class="dlm-history-time">2 minutes ago</span>
                    <span class="dlm-history-world">FantasyWorld</span>
                </div>
            </div>
            <div class="dlm-history-actions">
                <button class="dlm-btn-icon" title="View Details">
                    <i class="fa fa-eye"></i>
                </button>
                <button class="dlm-btn-icon" title="Revert">
                    <i class="fa fa-undo"></i>
                </button>
            </div>
        </div>
        <!-- More history items -->
    </div>

    <div class="dlm-history-footer">
        <button class="dlm-btn dlm-btn-secondary" id="dlm-clear-history">
            Clear History
        </button>
        <button class="dlm-btn dlm-btn-secondary" id="dlm-export-history">
            <i class="fa fa-download"></i> Export
        </button>
    </div>
</div>
```

---

## User Flows

### Flow 1: Automatic Suggestion (Happy Path)

```
1. User sends message
   ↓
2. AI responds
   ↓
3. Lorebook entries activate (World Info system)
   ↓
4. Extension detects activation
   ↓
5. Extension analyzes response (background)
   ↓
6. Toast notification appears: "3 suggestions available"
   ↓
7. User clicks notification
   ↓
8. Approval Dialog opens
   ↓
9. User reviews suggestions
   ↓
10. User selects 2 suggestions, clicks "Apply Selected"
   ↓
11. Progress indicator shows
   ↓
12. Updates applied to lorebook
   ↓
13. Success notification: "2 updates applied"
   ↓
14. Dialog closes
   ↓
15. User continues chatting with updated lorebook
```

### Flow 2: Manual Trigger

```
1. User right-clicks a message
   ↓
2. Context menu shows "Analyze for Lorebook Updates"
   ↓
3. User clicks menu item
   ↓
4. Extension identifies activated entries for that message
   ↓
5. Analysis runs
   ↓
6. Approval Dialog opens with suggestions
   ↓
7. (Continue as Flow 1 step 9)
```

### Flow 3: Edit Before Apply

```
1. (Continuing from Flow 1 step 9)
   ↓
2. User clicks "Edit" on a suggestion
   ↓
3. Card expands, shows textarea with suggested content
   ↓
4. User modifies the text
   ↓
5. User clicks "Save Edit"
   ↓
6. Card shows "Modified by user" badge
   ↓
7. User clicks "Approve"
   ↓
8. Modified content is applied
```

### Flow 4: Undo an Update

```
1. User realizes update was wrong
   ↓
2. User opens History Panel
   ↓
3. User finds recent update
   ↓
4. User clicks "Revert" button
   ↓
5. Confirmation dialog: "Revert update to Eldoria?"
   ↓
6. User clicks "Yes"
   ↓
7. Entry restored from backup
   ↓
8. Success notification: "Update reverted"
   ↓
9. History item marked as "Undone"
```

---

## Screen Layouts

### Main Chat Interface Integration

```
┌─────────────────────────────────────────────────┐
│ SillyTavern Header                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Chat Messages Area                             │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ User: Tell me about Eldoria              │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ AI: Eldoria is a magical forest...       │   │
│  │     (continues with new details)          │   │
│  │                                           │   │
│  │  [📋 Copy] [🔄 Regenerate] [🔍 Analyze]  │◀── Analyze button
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [Type a message...]                            │
│                                                 │
├─────────────────────────────────────────────────┤
│ Extensions Panel (if open)                      │
│  ┌───────────────────────────────────────┐     │
│  │ 📚 Dynamic Lorebook Manager           │     │
│  │                                       │     │
│  │ ✅ 3 Suggestions Available            │◀── Status widget
│  │ [Review Now]                          │     │
│  │                                       │     │
│  │ Last Update: 2 mins ago              │     │
│  │ [History] [Settings]                  │     │
│  └───────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘

┌──────────────────────────┐
│ 🔔 Notification (Toast)  │◀── Appears top-right
│ 3 lorebook suggestions   │
│ available. [Review]      │
└──────────────────────────┘
```

### Approval Dialog Layout (Desktop)

```
┌───────────────────────────────────────────────────────────────────┐
│ 📚 Lorebook Update Suggestions                         [X]        │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│   │ 3 Updates  │  │ 1 New Entry│  │ 87% Avg    │               │
│   └────────────┘  └────────────┘  └────────────┘               │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│ [✓] Select All (2 of 4)    Sort: [Confidence ▼]  [====|---] 70% │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ☑ Eldoria - Main Setting          FantasyWorld          │    │
│  │ ██████████████████░░ 87% Expansion                      │    │
│  │                                                          │    │
│  │ ┌────────────────────────────────────────────────────┐  │    │
│  │ │ OLD: Eldoria is a magical forest...                │  │    │
│  │ │ NEW: Eldoria is a magical forest... The forest is │  │    │
│  │ │      also home to the Crystal Lake...              │  │    │
│  │ └────────────────────────────────────────────────────┘  │    │
│  │                                                          │    │
│  │ > Why this change?                                       │    │
│  │                                                          │    │
│  │ + crystal lake, sentinel oak                             │    │
│  │                                                          │    │
│  │ [✓ Approve]  [✎ Edit]  [✗ Reject]                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ☑ Ancient Trees          FantasyWorld     [collapsed]   │    │
│  │ ████████████░░░░░░ 72% Refinement    [Expand ▼]        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ... more suggestions ...                                        │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│ [Reject All]                         [Cancel] [Apply Selected (2)]│
└───────────────────────────────────────────────────────────────────┘
```

### Settings Panel Layout

```
┌────────────────────────────────────────┐
│ ⚙ Dynamic Lorebook Manager            │
├────────────────────────────────────────┤
│                                        │
│ [✓] Enable Extension                  │
│                                        │
│ Update Mode: [Auto-Suggest    ▼]      │
│                                        │
│ Aggressiveness:                        │
│ ○ Conservative  ⦿ Balanced ○ Aggressive│
│                                        │
│ Minimum Confidence: [====|-----] 70%   │
│                                        │
│ Update Fields:                         │
│ [✓] Entry Content                     │
│ [✓] Keywords                          │
│ [ ] Comment/Title                     │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ ▸ Advanced Settings                ││
│ └────────────────────────────────────┘│
│                                        │
│ [Reset Defaults]        [💾 Save]     │
└────────────────────────────────────────┘
```

---

## Interaction Patterns

### Hover States

**Suggestion Card**
- Subtle shadow increase
- Border color brightens

**Action Buttons**
- Color deepens
- Scale increases slightly (1.05x)

**Diff Text**
- Tooltip shows full context on truncated text

### Animations

**Modal Open**
```css
@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.dlm-modal-content {
    animation: slideInRight 0.3s ease-out;
}
```

**Notification**
```css
@keyframes fadeInDown {
    from {
        transform: translateY(-20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.dlm-notification {
    animation: fadeInDown 0.3s ease-out;
}
```

**Approval Success**
```css
@keyframes pulse {
    0%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
}

.dlm-card-approved {
    animation: pulse 0.6s ease;
}
```

### Keyboard Shortcuts

**In Approval Dialog:**
- `Ctrl/Cmd + Enter` - Apply selected
- `Escape` - Close dialog
- `Space` - Toggle selection on focused card
- `Tab` - Navigate between cards
- `E` - Edit focused card
- `A` - Approve focused card
- `R` - Reject focused card

**Global:**
- `Ctrl/Cmd + Shift + L` - Open history panel
- `Ctrl/Cmd + Z` - Undo last update
- `Ctrl/Cmd + Shift + Z` - Redo

### Loading States

**Analysis in Progress**
```html
<div class="dlm-loading">
    <div class="dlm-spinner"></div>
    <div class="dlm-loading-text">Analyzing response...</div>
</div>
```

**Applying Updates**
```html
<div class="dlm-progress">
    <div class="dlm-progress-bar" style="width: 66%"></div>
    <div class="dlm-progress-text">Applying 2 of 3...</div>
</div>
```

---

## Styling and Themes

### Color Palette

**Primary Colors**
```css
:root {
    --dlm-primary: #007bff;       /* Blue - Primary actions */
    --dlm-success: #28a745;       /* Green - Success, additions */
    --dlm-warning: #ffc107;       /* Yellow - Warnings */
    --dlm-danger: #dc3545;        /* Red - Errors, deletions */
    --dlm-info: #17a2b8;          /* Cyan - Info */
    --dlm-secondary: #6c757d;     /* Gray - Secondary actions */
}
```

**Semantic Colors**
```css
:root {
    --dlm-diff-equal: var(--SmartThemeBodyColor);
    --dlm-diff-insert-bg: rgba(40, 167, 69, 0.2);
    --dlm-diff-insert-border: #28a745;
    --dlm-diff-delete-bg: rgba(220, 53, 69, 0.2);
    --dlm-diff-delete-border: #dc3545;
}
```

**Confidence Colors** (Gradient)
```css
.dlm-confidence[data-confidence="high"] { /* 80-100% */
    --confidence-color: #28a745;
}

.dlm-confidence[data-confidence="medium"] { /* 60-79% */
    --confidence-color: #ffc107;
}

.dlm-confidence[data-confidence="low"] { /* <60% */
    --confidence-color: #dc3545;
}
```

### Typography

```css
.dlm-card-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--SmartThemeBodyColor);
}

.dlm-diff-content {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.9rem;
    line-height: 1.6;
}

.dlm-confidence-text {
    font-size: 0.85rem;
    font-weight: 500;
}
```

### Spacing

```css
:root {
    --dlm-spacing-xs: 4px;
    --dlm-spacing-sm: 8px;
    --dlm-spacing-md: 16px;
    --dlm-spacing-lg: 24px;
    --dlm-spacing-xl: 32px;
}
```

### Responsive Design

**Breakpoints**
```css
@media (max-width: 768px) {
    /* Mobile: Stack suggestions vertically */
    .dlm-modal-content {
        width: 95%;
        max-width: none;
    }

    .dlm-diff-content {
        font-size: 0.8rem;
    }

    /* Simplified toolbar */
    .dlm-toolbar {
        flex-direction: column;
    }
}

@media (min-width: 769px) and (max-width: 1024px) {
    /* Tablet: Medium layout */
    .dlm-modal-content {
        width: 85%;
    }
}

@media (min-width: 1025px) {
    /* Desktop: Full features */
    .dlm-modal-content {
        width: 900px;
        max-width: 90vw;
    }

    .dlm-diff-content[data-mode="side-by-side"] {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--dlm-spacing-md);
    }
}
```

---

This comprehensive UI design document provides all the specifications needed to implement a consistent, user-friendly interface for the Dynamic Lorebook Manager extension.
