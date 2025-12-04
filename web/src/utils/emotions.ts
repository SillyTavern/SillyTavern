// Emotion types for character expressions
// Uses GoEmotions-compatible naming for expression files

export const EMOTIONS = [
  'neutral',
  'joy',
  'sadness',
  'anger',
  'surprise',
  'fear',
  'love',
  'excitement',
  'confusion',
  'embarrassment',
  'curiosity',
  'amusement',
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

  // Map various emotion words to our file-compatible emotion names
  const emotionMap: Record<string, Emotion> = {
    // Direct matches (file names)
    neutral: 'neutral',
    joy: 'joy',
    sadness: 'sadness',
    anger: 'anger',
    surprise: 'surprise',
    fear: 'fear',
    love: 'love',
    excitement: 'excitement',
    confusion: 'confusion',
    embarrassment: 'embarrassment',
    curiosity: 'curiosity',
    amusement: 'amusement',

    // Common variants -> joy
    happy: 'joy',
    joyful: 'joy',
    cheerful: 'joy',
    pleased: 'joy',
    content: 'joy',
    delighted: 'joy',
    glad: 'joy',
    elated: 'joy',

    // Common variants -> sadness
    sad: 'sadness',
    unhappy: 'sadness',
    depressed: 'sadness',
    melancholy: 'sadness',
    upset: 'sadness',
    tearful: 'sadness',
    crying: 'sadness',
    grief: 'sadness',
    disappointed: 'sadness',

    // Common variants -> anger
    angry: 'anger',
    mad: 'anger',
    furious: 'anger',
    annoyed: 'anger',
    irritated: 'anger',
    frustrated: 'anger',
    rage: 'anger',
    annoyance: 'anger',

    // Common variants -> surprise
    surprised: 'surprise',
    shock: 'surprise',
    shocked: 'surprise',
    astonished: 'surprise',
    amazed: 'surprise',
    startled: 'surprise',

    // Common variants -> fear
    scared: 'fear',
    afraid: 'fear',
    terrified: 'fear',
    nervous: 'fear',
    anxious: 'fear',
    worried: 'fear',
    nervousness: 'fear',

    // Common variants -> love
    loving: 'love',
    affectionate: 'love',
    adoring: 'love',
    romantic: 'love',
    flirty: 'love',
    caring: 'love',
    desire: 'love',

    // Common variants -> excitement
    excited: 'excitement',
    thrilled: 'excitement',
    enthusiastic: 'excitement',
    eager: 'excitement',
    energetic: 'excitement',

    // Common variants -> confusion
    confused: 'confusion',
    puzzled: 'confusion',
    bewildered: 'confusion',
    perplexed: 'confusion',
    lost: 'confusion',

    // Common variants -> embarrassment
    embarrassed: 'embarrassment',
    shy: 'embarrassment',
    flustered: 'embarrassment',
    blushing: 'embarrassment',

    // Common variants -> curiosity
    curious: 'curiosity',
    interested: 'curiosity',
    intrigued: 'curiosity',
    thinking: 'curiosity',
    pondering: 'curiosity',
    thoughtful: 'curiosity',

    // Common variants -> amusement
    amused: 'amusement',
    laughing: 'amusement',
    playful: 'amusement',
    teasing: 'amusement',
    smug: 'amusement',
    proud: 'amusement',
  };

  return emotionMap[emotionStr] || null;
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

  // Expression images are stored in /characters/[name]/[emotion].png
  // Extract character name from avatar filename (e.g., "Seraphina.png" -> "Seraphina")
  const characterName = characterAvatar.replace(/\.[^/.]+$/, '');

  return `/characters/${encodeURIComponent(characterName)}/${emotion}.png`;
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
  return `/characters/${encodeURIComponent(characterName)}/${emotion}.png`;
}
