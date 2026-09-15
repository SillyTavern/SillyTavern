# Dynamic Lorebook Manager - Examples & Use Cases

This document provides concrete examples of how the extension works in practice, including real-world scenarios, expected inputs/outputs, and edge cases.

## Table of Contents

1. [Basic Usage Examples](#basic-usage-examples)
2. [Complex Scenarios](#complex-scenarios)
3. [Edge Cases](#edge-cases)
4. [API Request/Response Examples](#api-requestresponse-examples)
5. [Configuration Examples](#configuration-examples)

---

## Basic Usage Examples

### Example 1: Simple Entry Expansion

**Scenario:** User asks about a location, AI provides more details than the lorebook entry contains.

**Initial Lorebook Entry:**
```json
{
  "uid": 5,
  "key": ["eldoria", "magical forest"],
  "content": "Eldoria is a magical forest with ancient trees.",
  "comment": "Eldoria - Main Setting",
  "order": 100,
  "position": 0
}
```

**Chat Exchange:**
```
User: Tell me more about Eldoria

AI: Eldoria is a magical forest with ancient trees. The forest is also home
to the Crystal Lake, a mystical body of water where fairies gather at moonrise
to perform their nightly rituals. Deep within the forest stands the Sentinel
Oak, the oldest tree in Eldoria at over 3000 years old, which serves as a
natural landmark for travelers.
```

**Extension Detection:**
1. `WORLDINFO_ACTIVATED` event fires with entry UID 5
2. `MESSAGE_RECEIVED` event fires with AI response
3. Extension correlates: "Entry 5 was active for this message"

**Analysis Prompt Sent:**
```
You are analyzing a chat message to determine if it contains new information
that should be added to existing lorebook entries.

ACTIVATED LOREBOOK ENTRIES:
---
Entry: Eldoria - Main Setting
Current Content: Eldoria is a magical forest with ancient trees.
Keywords: eldoria, magical forest
---

AI RESPONSE MESSAGE:
Eldoria is a magical forest with ancient trees. The forest is also home to
the Crystal Lake, a mystical body of water where fairies gather at moonrise
to perform their nightly rituals. Deep within the forest stands the Sentinel
Oak, the oldest tree in Eldoria at over 3000 years old, which serves as a
natural landmark for travelers.

TASK:
Identify new facts not present in the original entry and suggest an updated version.
Output as JSON: { "updates": [...], "newEntities": [...] }
```

**LLM Analysis Response:**
```json
{
  "updates": [
    {
      "entryUid": 5,
      "entryComment": "Eldoria - Main Setting",
      "confidence": 0.87,
      "changeType": "expansion",
      "extractedInfo": [
        {
          "fact": "Crystal Lake exists in Eldoria where fairies gather at moonrise for rituals",
          "relevance": "Adds specific geographical feature and creature behavior",
          "suggestedIntegration": "Add as second paragraph after main description",
          "confidence": 0.92
        },
        {
          "fact": "The Sentinel Oak is over 3000 years old and serves as a landmark",
          "relevance": "Provides historical depth and navigation reference",
          "suggestedIntegration": "Add as third sentence or separate paragraph",
          "confidence": 0.85
        }
      ],
      "suggestedNewContent": "Eldoria is a magical forest with ancient trees. The forest is home to the Crystal Lake, a mystical body of water where fairies gather at moonrise to perform their nightly rituals. Deep within the forest stands the Sentinel Oak, the oldest tree in Eldoria at over 3000 years old, which serves as a natural landmark for travelers.",
      "reasoning": "The AI response introduces two significant new details: Crystal Lake as a fairy gathering place, and the Sentinel Oak as an ancient landmark. Both add meaningful context to Eldoria without contradicting the original entry."
    }
  ],
  "newEntities": [
    {
      "name": "Crystal Lake",
      "description": "A mystical lake in Eldoria where fairies gather",
      "suggestedKeywords": ["crystal lake", "fairy lake", "mystical lake"],
      "relevance": "Significant location within Eldoria that could be referenced independently",
      "confidence": 0.92
    }
  ]
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📚 Lorebook Update Suggestions                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ☑ Eldoria - Main Setting (FantasyWorld)                           │
│ ████████████████████░░ 87% Expansion                               │
│                                                                     │
│ OLD: Eldoria is a magical forest with ancient trees.               │
│ NEW: Eldoria is a magical forest with ancient trees. The forest is │
│      home to the Crystal Lake, a mystical body of water where      │
│      fairies gather at moonrise to perform their nightly rituals.  │
│      Deep within the forest stands the Sentinel Oak...             │
│                                                                     │
│ > Why this change?                                                  │
│   The AI introduced two significant new details: Crystal Lake as a │
│   fairy gathering place, and the Sentinel Oak as an ancient        │
│   landmark. Both add meaningful context.                           │
│                                                                     │
│ + Suggested new keywords: crystal lake, sentinel oak, fairies      │
│                                                                     │
│ [✓ Approve]  [✎ Edit]  [✗ Reject]                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ☑ NEW: Crystal Lake (suggested new entry)                         │
│ ██████████████████████ 92% High Confidence                        │
│                                                                     │
│ A mystical lake in Eldoria where fairies gather                    │
│ Suggested keywords: crystal lake, fairy lake, mystical lake        │
│                                                                     │
│ [✓ Create Entry]  [✗ Skip]                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**User Action:** Approves the update

**Result:**
- Entry 5 updated with new content
- Backup created in UpdateHistory
- Notification: "Successfully updated 'Eldoria - Main Setting'"
- New entry suggestion can be approved separately

---

### Example 2: Contradiction Detection

**Scenario:** AI contradicts existing lorebook information.

**Initial Lorebook Entry:**
```json
{
  "uid": 12,
  "key": ["luna", "sorceress"],
  "content": "Luna is a powerful sorceress who specializes in fire magic. She has red hair and wears crimson robes.",
  "comment": "Luna - Main Character"
}
```

**Chat Exchange:**
```
User: What kind of magic does Luna use?

AI: Luna is primarily a water mage, specializing in ice and healing spells.
Her blue robes reflect her affinity for water magic.
```

**Analysis Response:**
```json
{
  "updates": [
    {
      "entryUid": 12,
      "entryComment": "Luna - Main Character",
      "confidence": 0.75,
      "changeType": "correction",
      "extractedInfo": [
        {
          "fact": "Luna specializes in water magic, specifically ice and healing",
          "relevance": "CONTRADICTS existing entry which says fire magic",
          "suggestedIntegration": "CONFLICT - User decision required",
          "confidence": 0.80
        },
        {
          "fact": "Luna wears blue robes",
          "relevance": "CONTRADICTS existing entry which says crimson robes",
          "suggestedIntegration": "CONFLICT - User decision required",
          "confidence": 0.75
        }
      ],
      "suggestedNewContent": "Luna is a powerful sorceress who specializes in water magic, particularly ice and healing spells. She has blue robes that reflect her magical affinity.",
      "reasoning": "⚠️ CONFLICT DETECTED: The AI's response contradicts the existing lorebook entry. Original says fire magic and crimson robes, AI says water magic and blue robes. This may indicate: 1) AI hallucination, 2) Character development in story, or 3) Original entry needs correction. User should verify intent before applying."
    }
  ],
  "newEntities": []
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️ Luna - Main Character (FantasyWorld)                            │
│ ███████████████░░░░░ 75% Correction (CONFLICT)                     │
│                                                                     │
│ ⚠️ WARNING: This update contradicts existing information!          │
│                                                                     │
│ OLD: Luna is a powerful sorceress who specializes in fire magic.   │
│      She has red hair and wears crimson robes.                     │
│                                                                     │
│ NEW: Luna is a powerful sorceress who specializes in water magic,  │
│      particularly ice and healing spells. She has blue robes that  │
│      reflect her magical affinity.                                 │
│                                                                     │
│ Conflicts:                                                          │
│ • Fire magic → Water magic                                          │
│ • Crimson robes → Blue robes                                        │
│                                                                     │
│ > Why this change?                                                  │
│   CONFLICT DETECTED: The AI contradicts existing information. This │
│   may indicate AI hallucination, story development, or an error in │
│   the original entry. Please verify before applying.               │
│                                                                     │
│ [⚠️ Apply Anyway]  [✎ Edit to Merge]  [✗ Reject]                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Recommended User Actions:**
1. **Reject** - If AI is wrong, reject the suggestion
2. **Edit to Merge** - If both are partially correct, combine them
3. **Apply Anyway** - If the story has evolved and the change is intentional

---

## Complex Scenarios

### Example 3: Multiple Entries Activated

**Scenario:** AI response touches on multiple lorebook entries simultaneously.

**Active Entries:**
```json
[
  {
    "uid": 5,
    "comment": "Eldoria - Main Setting",
    "content": "Eldoria is a magical forest with ancient trees.",
    "key": ["eldoria", "forest"]
  },
  {
    "uid": 8,
    "comment": "Fairies of Eldoria",
    "content": "Fairies are mystical creatures that live in Eldoria.",
    "key": ["fairy", "fairies"]
  },
  {
    "uid": 15,
    "comment": "Magic System",
    "content": "Magic in this world flows from natural sources.",
    "key": ["magic", "magical"]
  }
]
```

**Chat Exchange:**
```
User: How do fairies use magic in the forest?

AI: The fairies of Eldoria draw their magic directly from the ancient trees.
They gather at the Crystal Lake during moonrise because the water amplifies
their natural magical abilities. The oldest fairies can communicate with the
Sentinel Oak, which acts as a magical conduit for the entire forest.
```

**Analysis Response:**
```json
{
  "updates": [
    {
      "entryUid": 5,
      "entryComment": "Eldoria - Main Setting",
      "confidence": 0.85,
      "changeType": "expansion",
      "suggestedNewContent": "Eldoria is a magical forest with ancient trees. The Crystal Lake is located in the forest and amplifies magical abilities during moonrise. The Sentinel Oak serves as a magical conduit for the entire forest.",
      "reasoning": "Adds Crystal Lake and Sentinel Oak as important magical features of Eldoria"
    },
    {
      "entryUid": 8,
      "entryComment": "Fairies of Eldoria",
      "confidence": 0.90,
      "changeType": "expansion",
      "suggestedNewContent": "Fairies are mystical creatures that live in Eldoria. They draw their magic directly from the ancient trees and gather at the Crystal Lake during moonrise when the water amplifies their natural abilities. Older fairies can communicate with the Sentinel Oak.",
      "reasoning": "Details the source of fairy magic and their connection to specific locations"
    },
    {
      "entryUid": 15,
      "entryComment": "Magic System",
      "confidence": 0.82,
      "changeType": "expansion",
      "suggestedNewContent": "Magic in this world flows from natural sources. In Eldoria, the ancient trees serve as the primary magical source, with the Sentinel Oak acting as a central conduit. The Crystal Lake amplifies magical abilities, especially during moonrise.",
      "reasoning": "Provides specific example of how natural magic works in Eldoria"
    }
  ],
  "newEntities": [
    {
      "name": "Crystal Lake",
      "description": "A lake in Eldoria that amplifies magical abilities during moonrise",
      "suggestedKeywords": ["crystal lake", "moonrise amplification"],
      "confidence": 0.93
    },
    {
      "name": "Sentinel Oak",
      "description": "The oldest tree in Eldoria that acts as a magical conduit",
      "suggestedKeywords": ["sentinel oak", "ancient oak", "magical conduit"],
      "confidence": 0.88
    }
  ]
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📚 Lorebook Update Suggestions - 3 Updates, 2 New Entries          │
├─────────────────────────────────────────────────────────────────────┤
│ [✓ Select All (5 of 5)]     Sort: [Confidence ▼]  [====|---] 70%  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ☑ Fairies of Eldoria (FantasyWorld)                               │
│ ███████████████████░ 90% Expansion                                 │
│ [Details ▼] [✓] [✎] [✗]                                           │
│                                                                     │
│ ☑ Eldoria - Main Setting (FantasyWorld)                           │
│ █████████████████░░░ 85% Expansion                                 │
│ [Details ▼] [✓] [✎] [✗]                                           │
│                                                                     │
│ ☑ Magic System                                                     │
│ ████████████████░░░░ 82% Expansion                                 │
│ [Details ▼] [✓] [✎] [✗]                                           │
│                                                                     │
│ ☑ NEW: Crystal Lake                                               │
│ ██████████████████████ 93% New Entry                              │
│ [Details ▼] [✓] [✗]                                               │
│                                                                     │
│ ☑ NEW: Sentinel Oak                                               │
│ ████████████████████░░ 88% New Entry                              │
│ [Details ▼] [✓] [✗]                                               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ [Reject All]                            [Cancel] [Apply Selected (5)]│
└─────────────────────────────────────────────────────────────────────┘
```

**Batch Application:**
- All 3 existing entries updated in single transaction
- 2 new entries created with auto-incremented UIDs
- Single UpdateRecord captures all changes for undo
- One notification: "Applied 5 updates to FantasyWorld"

---

### Example 4: Recursive Entry Activation

**Scenario:** Updated entry triggers another entry in the next message.

**Initial State:**
```json
{
  "uid": 20,
  "key": ["crystal lake"],
  "content": "Crystal Lake is a mystical body of water in Eldoria.",
  "comment": "Crystal Lake"
}
```

**First Exchange:**
```
User: Tell me about Crystal Lake
AI: Crystal Lake is... [entry gets updated with more details about guardian spirits]
```

**Updated Entry:**
```json
{
  "uid": 20,
  "content": "Crystal Lake is a mystical body of water in Eldoria, guarded by ancient water spirits who test those who seek its power."
}
```

**Second Exchange:**
```
User: What are these water spirits?
AI: The water spirits of Crystal Lake are ethereal beings made of pure water...
```

**Extension Behavior:**
1. First update adds "water spirits" to entry 20
2. Second message mentions "water spirits" → triggers entry 20 again
3. Extension suggests creating NEW entry specifically for water spirits
4. Demonstrates the recursive nature: updated entries can trigger in future messages

---

## Edge Cases

### Edge Case 1: No Suggestions Generated

**Scenario:** Entry activates but AI doesn't add new information.

**Entry:**
```json
{
  "uid": 7,
  "key": ["magic system"],
  "content": "Magic flows from natural sources including trees, water, and earth."
}
```

**Chat:**
```
User: How does magic work?
AI: Magic flows from natural sources including trees, water, and earth.
```

**Analysis Result:**
```json
{
  "updates": [],
  "newEntities": []
}
```

**Extension Behavior:**
- Analysis runs
- No suggestions generated (AI just repeated existing info)
- No UI shown to user
- No notification
- Silent completion

---

### Edge Case 2: Low Confidence Filtering

**Scenario:** Analysis generates suggestions but all below confidence threshold.

**Settings:**
```json
{
  "minConfidence": 0.70
}
```

**Analysis Result:**
```json
{
  "updates": [
    {
      "entryUid": 10,
      "confidence": 0.55,
      "changeType": "refinement",
      "suggestedNewContent": "..."
    },
    {
      "entryUid": 12,
      "confidence": 0.62,
      "changeType": "expansion",
      "suggestedNewContent": "..."
    }
  ]
}
```

**Extension Behavior:**
- UpdateSuggester filters both (< 0.70 threshold)
- No suggestions shown
- Debug log: "2 suggestions filtered by confidence threshold"
- No user notification

**User Can:**
- Lower confidence threshold in settings
- Manually trigger analysis to review low-confidence suggestions

---

### Edge Case 3: Very Long Content

**Scenario:** Suggested update exceeds typical token limits.

**Analysis Result:**
```json
{
  "updates": [
    {
      "entryUid": 50,
      "suggestedNewContent": "... 5000 words of content ..."
    }
  ]
}
```

**Extension Behavior:**
1. Calculate token count: ~6500 tokens
2. Check against budget limit
3. Show warning in UI:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️ Location History (MyWorld)                                       │
│ ████████████████░░░░ 80% Expansion                                  │
│                                                                     │
│ ⚠️ WARNING: This update is very large (6500 tokens)                │
│                                                                     │
│ This may:                                                           │
│ • Exceed your lorebook token budget                                │
│ • Impact generation performance                                    │
│ • Need to be split into multiple entries                           │
│                                                                     │
│ Recommendation: Edit to shorten or split into separate entries     │
│                                                                     │
│ [✎ Edit]  [Split into Multiple]  [Apply Anyway]  [Reject]        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Request/Response Examples

### Full Analysis API Call

**Request to OpenAI:**
```json
{
  "model": "gpt-4-turbo",
  "messages": [
    {
      "role": "system",
      "content": "You are a lorebook analysis assistant. Your task is to analyze chat messages and identify new information that should be added to existing lorebook entries."
    },
    {
      "role": "user",
      "content": "ACTIVATED LOREBOOK ENTRIES:\n---\nEntry: Eldoria - Main Setting\nCurrent Content: Eldoria is a magical forest with ancient trees.\nKeywords: eldoria, magical forest\n---\n\nAI RESPONSE MESSAGE:\nEldoria is a magical forest with ancient trees. The forest is also home to the Crystal Lake, a mystical body of water where fairies gather at moonrise to perform their nightly rituals.\n\nTASK:\nIdentify new facts not present in the original entry and suggest an updated version.\nOutput as JSON with structure: { \"updates\": [...], \"newEntities\": [...] }"
    }
  ],
  "temperature": 0.3,
  "max_tokens": 1000,
  "response_format": { "type": "json_object" }
}
```

**Response from OpenAI:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1710432000,
  "model": "gpt-4-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"updates\":[{\"entryUid\":5,\"entryComment\":\"Eldoria - Main Setting\",\"confidence\":0.87,\"changeType\":\"expansion\",\"extractedInfo\":[{\"fact\":\"Crystal Lake exists in Eldoria where fairies gather at moonrise\",\"relevance\":\"Adds specific geographical feature and creature behavior\",\"suggestedIntegration\":\"Add as second sentence\",\"confidence\":0.92}],\"suggestedNewContent\":\"Eldoria is a magical forest with ancient trees. The forest is home to the Crystal Lake, a mystical body of water where fairies gather at moonrise to perform their nightly rituals.\",\"reasoning\":\"The AI response introduces Crystal Lake as a significant new location with associated fairy behavior.\"}],\"newEntities\":[{\"name\":\"Crystal Lake\",\"description\":\"A mystical lake in Eldoria where fairies gather\",\"suggestedKeywords\":[\"crystal lake\",\"fairy lake\"],\"relevance\":\"Significant location that could be referenced independently\",\"confidence\":0.92}]}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 234,
    "completion_tokens": 187,
    "total_tokens": 421
  }
}
```

---

## Configuration Examples

### Conservative Setup

For users who want high-confidence suggestions only:

```json
{
  "enabled": true,
  "updateMode": "manual",
  "aggressiveness": "conservative",
  "minConfidence": 0.85,
  "updateFields": ["content"],
  "requireApproval": true,
  "autoBackup": true,
  "showNotifications": true
}
```

**Behavior:**
- Only show very high confidence suggestions (85%+)
- Only update content, never keywords
- Always require manual approval
- Manual trigger only (not automatic)

---

### Aggressive/Automated Setup

For users who trust the AI and want minimal interaction:

```json
{
  "enabled": true,
  "updateMode": "auto-approve",
  "aggressiveness": "aggressive",
  "minConfidence": 0.65,
  "updateFields": ["content", "keywords", "comment"],
  "requireApproval": false,
  "autoBackup": true,
  "showNotifications": true
}
```

**Behavior:**
- Automatically approve high-confidence suggestions
- Accept more types of changes (including style improvements)
- Update content, keywords, and comments
- Lower confidence threshold (65%+)
- Notifications still shown for visibility

---

### Specific Lorebook Setup

For users with multiple lorebooks who only want updates on specific ones:

```json
{
  "enabled": true,
  "enabledLorebooks": ["MainWorld", "CharacterBackstories"],
  "updateMode": "auto-suggest",
  "aggressiveness": "balanced",
  "minConfidence": 0.70
}
```

**Behavior:**
- Only analyze entries from "MainWorld" and "CharacterBackstories"
- Ignore activations from other lorebooks
- Balanced suggestion aggressiveness

---

This examples document provides concrete, real-world scenarios demonstrating how the Dynamic Lorebook Manager extension works in practice across various use cases and configurations.
