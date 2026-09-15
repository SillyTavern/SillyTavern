# Dynamic Lorebook Manager Extension

## Overview

The Dynamic Lorebook Manager is a SillyTavern extension that enables automatic detection and AI-powered updates of lorebook (World Info) entries based on chat responses. When an AI generates content that expands on or modifies existing lorebook entries, this extension detects the changes and suggests updates for user approval.

## Problem Statement

Currently in SillyTavern:
- Lorebook entries are triggered when their keywords appear in chat context
- These entries inject static information into the AI's prompt
- When the AI generates new information about a topic, the lorebook entry remains unchanged
- Users must manually identify outdated entries and update them

**Example Scenario:**
```
Lorebook Entry: "Eldoria"
Content: "Eldoria is a magical forest with ancient trees."

Chat Exchange:
User: "Tell me more about Eldoria"
AI: "Eldoria is a magical forest with ancient trees. The forest is also home
     to the Crystal Lake, where fairies gather at moonrise. The oldest tree,
     called the Sentinel Oak, has stood for over 3000 years."

Problem: The new information (Crystal Lake, fairies, Sentinel Oak) is NOT
         captured in the lorebook entry.
```

## Solution

This extension:
1. **Detects** which lorebook entries were activated during generation
2. **Analyzes** the AI's response for new/expanded information related to those entries
3. **Generates** suggested updates using AI analysis
4. **Presents** a diff-based UI for user approval
5. **Updates** the lorebook entry if approved

## Key Features

### 1. Automatic Entry Detection
- Hooks into `WORLDINFO_ACTIVATED` event to track triggered entries
- Maintains correlation between chat messages and active entries
- Supports all lorebook activation types (keyword, constant, decorator-based)

### 2. Intelligent Content Analysis
- Uses the active chat API (OpenAI, Claude, etc.) to analyze responses
- Extracts facts, details, and expansions related to triggered entries
- Preserves original entry intent while incorporating new information
- Handles multiple triggered entries in a single response

### 3. User-Controlled Updates
- Diff view showing old content vs. proposed new content
- Inline editing of suggestions before applying
- Accept all, reject all, or selective approval
- Undo/redo capability with update history

### 4. Smart Suggestion Generation
- Maintains entry structure and tone
- Avoids redundancy and contradictions
- Respects token limits and entry constraints
- Optional: Suggests new entries for unmatched information

### 5. Flexible Configuration
- Enable/disable per lorebook
- Configure update aggressiveness (conservative, balanced, aggressive)
- Set minimum confidence threshold for suggestions
- Choose which entry fields to update (content only, keywords too, etc.)

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical architecture.

## Data Structures

See [DATA_STRUCTURES.md](./DATA_STRUCTURES.md) for complete data structure documentation.

## API Integration

See [API_REFERENCE.md](./API_REFERENCE.md) for all API calls and event handlers.

## User Interface

See [UI_DESIGN.md](./UI_DESIGN.md) for UI components and user flow.

## Installation

1. Extension is automatically discovered in `public/scripts/extensions/dynamic-lorebook/`
2. Restart SillyTavern server
3. Enable extension in Extensions panel
4. Configure settings via extension settings panel

## Configuration

### Extension Settings

```javascript
{
  enabled: true,                          // Master enable/disable
  updateMode: 'manual',                   // 'manual', 'auto-approve', 'auto-suggest'
  aggressiveness: 'balanced',             // 'conservative', 'balanced', 'aggressive'
  minConfidence: 0.7,                     // 0.0 - 1.0
  updateFields: ['content'],              // ['content', 'keywords', 'comment']
  maxHistorySize: 50,                     // Number of updates to track
  enabledLorebooks: [],                   // Empty = all, or specific names
  showNotifications: true,                // Toast notifications
  autoBackup: true,                       // Backup before updates
  analysisModel: 'auto',                  // 'auto', 'gpt-4', 'claude-3', etc.
  promptTemplate: 'default',              // Analysis prompt template
}
```

## Usage Workflow

### Basic Flow

1. **Chat with character** - Lorebook entries trigger normally
2. **AI responds** - Extension analyzes response
3. **Review suggestions** - Popup shows proposed changes
4. **Approve/reject** - Choose which updates to apply
5. **Lorebook updated** - Changes saved automatically

### Manual Trigger

Users can also manually trigger analysis:
- Right-click on any message → "Analyze for Lorebook Updates"
- Select specific entries to analyze against
- Generate suggestions on demand

## Technical Requirements

### Dependencies
- SillyTavern v1.12.0+
- Active chat API connection (for analysis)
- World Info system enabled

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Performance Considerations
- Analysis runs asynchronously (doesn't block chat)
- Debounced to avoid excessive API calls
- Caches analysis results per message
- Minimal impact on generation speed

## Development

### File Structure
```
dynamic-lorebook/
├── README.md                    # This file
├── ARCHITECTURE.md              # Technical architecture
├── DATA_STRUCTURES.md           # Data structure documentation
├── API_REFERENCE.md             # API calls and events
├── UI_DESIGN.md                 # UI component design
├── manifest.json                # Extension manifest
├── index.js                     # Main entry point
├── src/
│   ├── detector.js              # Entry detection logic
│   ├── analyzer.js              # AI-powered analysis
│   ├── suggester.js             # Suggestion generation
│   ├── updater.js               # Lorebook update logic
│   ├── ui/
│   │   ├── diff-viewer.js       # Diff display component
│   │   ├── approval-dialog.js   # Approval UI
│   │   ├── settings-panel.js    # Settings interface
│   │   └── notification.js      # Toast notifications
│   ├── storage.js               # History and cache
│   └── utils.js                 # Helper functions
├── styles/
│   ├── main.css                 # Main styles
│   └── diff-viewer.css          # Diff component styles
└── prompts/
    ├── analyze.txt              # Analysis prompt template
    └── merge.txt                # Merge strategy prompt
```

### Key Classes

- **EntryDetector** - Tracks activated entries
- **ResponseAnalyzer** - Analyzes AI responses
- **UpdateSuggester** - Generates suggestions
- **LorebookUpdater** - Applies updates
- **UpdateHistory** - Manages undo/redo
- **DiffViewer** - Renders diff UI
- **ApprovalDialog** - Handles user approval

## Testing

### Test Scenarios

1. **Single Entry Trigger**
   - One entry activated
   - AI expands on that entry
   - Suggestion generated correctly

2. **Multiple Entry Trigger**
   - 3+ entries activated
   - AI references all entries
   - Individual suggestions for each

3. **No Update Needed**
   - Entry activated
   - AI doesn't add new info
   - No suggestion generated

4. **Conflicting Information**
   - Entry says "X is blue"
   - AI says "X is red"
   - Suggestion handles conflict appropriately

5. **New Entity Introduction**
   - No matching entry
   - AI introduces new concept
   - Optional: Suggest new entry creation

## Future Enhancements

### Phase 2 Features
- Automatic new entry creation for unmatched entities
- Batch update mode for multiple messages
- Collaborative filtering (learn from other users' updates)
- Version control integration (git-like branching)
- AI-powered entry merging for duplicates

### Phase 3 Features
- Multi-user approval workflow
- Entry quality scoring
- Automatic keyword extraction and optimization
- Cross-entry relationship detection
- Export/import of update histories

## Contributing

See main SillyTavern CONTRIBUTING.md for contribution guidelines.

## License

AGPL-3.0 (same as SillyTavern)

## Support

- GitHub Issues: Report bugs and feature requests
- Discord: #extensions channel in SillyTavern Discord
- Documentation: See design docs in this directory

## Credits

Developed for SillyTavern by [Your Name]
Based on SillyTavern's World Info system
