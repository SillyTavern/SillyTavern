// Emotion types for character expressions

export const EMOTIONS = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'thinking',
  'embarrassed',
  'worried',
  'excited',
  'confused',
  'loving',
  'smug',
] as const;

export type Emotion = (typeof EMOTIONS)[number];

// Regex to match emotion tags like [emotion:happy] or [mood:sad]
const EMOTION_TAG_REGEX = /\[(?:emotion|mood|expression|feeling):\s*(\w+)\]/i;

/**
 * Parse emotion tag from message content
 * Returns the emotion if found, or null
 */
export function parseEmotion(content: string): Emotion | null {
  const match = content.match(EMOTION_TAG_REGEX);
  if (!match) return null;

  const emotionStr = match[1].toLowerCase();

  // Map common variants to our emotion types
  const emotionMap: Record<string, Emotion> = {
    // Direct matches
    neutral: 'neutral',
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    surprised: 'surprised',
    thinking: 'thinking',
    embarrassed: 'embarrassed',
    worried: 'worried',
    excited: 'excited',
    confused: 'confused',
    loving: 'loving',
    smug: 'smug',
    // Variants
    joy: 'happy',
    joyful: 'happy',
    cheerful: 'happy',
    pleased: 'happy',
    content: 'happy',
    delighted: 'happy',
    unhappy: 'sad',
    depressed: 'sad',
    melancholy: 'sad',
    upset: 'sad',
    tearful: 'sad',
    crying: 'sad',
    mad: 'angry',
    furious: 'angry',
    annoyed: 'angry',
    irritated: 'angry',
    frustrated: 'angry',
    shock: 'surprised',
    shocked: 'surprised',
    astonished: 'surprised',
    amazed: 'surprised',
    startled: 'surprised',
    ponder: 'thinking',
    pondering: 'thinking',
    thoughtful: 'thinking',
    contemplating: 'thinking',
    curious: 'thinking',
    shy: 'embarrassed',
    flustered: 'embarrassed',
    blushing: 'embarrassed',
    nervous: 'worried',
    anxious: 'worried',
    concerned: 'worried',
    scared: 'worried',
    afraid: 'worried',
    fear: 'worried',
    thrilled: 'excited',
    enthusiastic: 'excited',
    eager: 'excited',
    energetic: 'excited',
    puzzled: 'confused',
    bewildered: 'confused',
    perplexed: 'confused',
    lost: 'confused',
    love: 'loving',
    affectionate: 'loving',
    adoring: 'loving',
    romantic: 'loving',
    flirty: 'loving',
    proud: 'smug',
    confident: 'smug',
    sarcastic: 'smug',
    teasing: 'smug',
  };

  return emotionMap[emotionStr] || 'neutral';
}

/**
 * Strip emotion tags from message content for display
 */
export function stripEmotionTag(content: string): string {
  return content.replace(EMOTION_TAG_REGEX, '').trim();
}

/**
 * Get expression image URL for a character and emotion
 * Falls back to main avatar if expression not available
 */
export function getExpressionUrl(
  characterAvatar: string,
  emotion: Emotion | null
): string {
  if (!emotion || emotion === 'neutral') {
    // Use main avatar for neutral
    return `/characters/${encodeURIComponent(characterAvatar)}`;
  }

  // Expression images are stored in /characters/[name]/expressions/[emotion].png
  // Extract character name from avatar filename (e.g., "Seraphina.png" -> "Seraphina")
  const characterName = characterAvatar.replace(/\.[^/.]+$/, '');

  return `/characters/${encodeURIComponent(characterName)}/expressions/${emotion}.png`;
}

/**
 * Get thumbnail expression URL (for chat messages)
 */
export function getExpressionThumbnailUrl(
  characterAvatar: string,
  emotion: Emotion | null
): string {
  if (!emotion || emotion === 'neutral') {
    return `/thumbnail?type=avatar&file=${encodeURIComponent(characterAvatar)}`;
  }

  // For expressions, we use the full-size path since thumbnails may not exist
  const characterName = characterAvatar.replace(/\.[^/.]+$/, '');
  return `/characters/${encodeURIComponent(characterName)}/expressions/${emotion}.png`;
}
