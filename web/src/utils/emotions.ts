// Emotion types for character expressions
// Now supports any string emotion - not restricted to a predefined list

// Default emotions for suggestions/UI hints
export const DEFAULT_EMOTIONS = [
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

// Emotion is now any string - characters can have any emotions they want
export type Emotion = string;

// Regex to match emotion tags like [emotion:happy] or [mood:sad]
const EMOTION_TAG_REGEX = /\[(?:emotion|mood|expression|feeling):\s*(\w+)\]/i;

/**
 * Parse emotion tag from message content
 * Returns the raw emotion string if found, or null
 * The caller should check if this emotion exists in the character's sprites
 */
export function parseEmotion(content: string): string | null {
  const match = content.match(EMOTION_TAG_REGEX);
  if (!match) return null;

  // Return the raw emotion string, normalized to lowercase
  return match[1].toLowerCase();
}

/**
 * Try to map a parsed emotion to one that exists in the available sprites
 * Falls back to the original if no mapping exists
 */
export function mapEmotionToAvailable(
  emotion: string,
  availableEmotions: string[]
): string | null {
  // Direct match
  if (availableEmotions.includes(emotion)) {
    return emotion;
  }

  // Common aliases - try to find a match
  const aliases: Record<string, string[]> = {
    // joy variants
    happy: ['joy', 'happiness', 'cheerful', 'pleased'],
    joyful: ['joy', 'happy', 'cheerful'],
    cheerful: ['joy', 'happy'],
    pleased: ['joy', 'happy', 'content'],
    content: ['joy', 'happy', 'pleased'],
    delighted: ['joy', 'happy', 'excited'],
    glad: ['joy', 'happy'],
    elated: ['joy', 'excited', 'happy'],

    // sadness variants
    sad: ['sadness', 'unhappy', 'melancholy'],
    unhappy: ['sadness', 'sad', 'disappointed'],
    depressed: ['sadness', 'sad', 'melancholy'],
    melancholy: ['sadness', 'sad'],
    upset: ['sadness', 'sad', 'angry'],
    tearful: ['sadness', 'crying', 'sad'],
    crying: ['sadness', 'tearful', 'sad'],
    grief: ['sadness', 'crying', 'sad'],
    disappointed: ['sadness', 'sad', 'unhappy'],

    // anger variants
    angry: ['anger', 'mad', 'furious'],
    mad: ['anger', 'angry', 'furious'],
    furious: ['anger', 'angry', 'rage'],
    annoyed: ['anger', 'irritated', 'frustrated'],
    irritated: ['anger', 'annoyed', 'frustrated'],
    frustrated: ['anger', 'annoyed', 'irritated'],
    rage: ['anger', 'furious', 'angry'],

    // surprise variants
    surprised: ['surprise', 'shocked', 'amazed'],
    shock: ['surprise', 'shocked', 'startled'],
    shocked: ['surprise', 'shock', 'startled'],
    astonished: ['surprise', 'amazed', 'shocked'],
    amazed: ['surprise', 'astonished', 'excited'],
    startled: ['surprise', 'shocked', 'scared'],

    // fear variants
    scared: ['fear', 'afraid', 'terrified'],
    afraid: ['fear', 'scared', 'nervous'],
    terrified: ['fear', 'scared', 'afraid'],
    nervous: ['fear', 'anxious', 'worried'],
    anxious: ['fear', 'nervous', 'worried'],
    worried: ['fear', 'anxious', 'nervous'],

    // love variants
    loving: ['love', 'affectionate', 'caring'],
    affectionate: ['love', 'loving', 'caring'],
    adoring: ['love', 'loving', 'affectionate'],
    romantic: ['love', 'flirty', 'affectionate'],
    flirty: ['love', 'romantic', 'playful'],
    caring: ['love', 'affectionate', 'kind'],

    // excitement variants
    excited: ['excitement', 'thrilled', 'eager'],
    thrilled: ['excitement', 'excited', 'happy'],
    enthusiastic: ['excitement', 'excited', 'eager'],
    eager: ['excitement', 'excited', 'enthusiastic'],
    energetic: ['excitement', 'excited', 'happy'],

    // confusion variants
    confused: ['confusion', 'puzzled', 'bewildered'],
    puzzled: ['confusion', 'confused', 'thinking'],
    bewildered: ['confusion', 'confused', 'lost'],
    perplexed: ['confusion', 'confused', 'puzzled'],
    lost: ['confusion', 'confused', 'bewildered'],

    // embarrassment variants
    embarrassed: ['embarrassment', 'shy', 'flustered'],
    shy: ['embarrassment', 'embarrassed', 'nervous'],
    flustered: ['embarrassment', 'embarrassed', 'nervous'],
    blushing: ['embarrassment', 'shy', 'flustered'],

    // curiosity variants
    curious: ['curiosity', 'interested', 'intrigued'],
    interested: ['curiosity', 'curious', 'intrigued'],
    intrigued: ['curiosity', 'curious', 'interested'],
    thinking: ['curiosity', 'thoughtful', 'pondering'],
    pondering: ['curiosity', 'thinking', 'thoughtful'],
    thoughtful: ['curiosity', 'thinking', 'pondering'],

    // amusement variants
    amused: ['amusement', 'laughing', 'playful'],
    laughing: ['amusement', 'amused', 'happy'],
    playful: ['amusement', 'amused', 'happy'],
    teasing: ['amusement', 'playful', 'smug'],
    smug: ['amusement', 'proud', 'confident'],
    proud: ['amusement', 'smug', 'confident'],
  };

  // Check aliases
  const possibleMatches = aliases[emotion];
  if (possibleMatches) {
    for (const candidate of possibleMatches) {
      if (availableEmotions.includes(candidate)) {
        return candidate;
      }
    }
  }

  // No match found - return null to use default/neutral
  return null;
}

/**
 * Strip emotion tags from message content for display
 */
export function stripEmotionTag(content: string): string {
  return content.replace(EMOTION_TAG_REGEX, '').trim();
}

/**
 * Get the default avatar URL (used for neutral or fallback)
 */
export function getDefaultAvatarUrl(characterAvatar: string): string {
  // Use the characters endpoint which serves the avatar file directly
  return `/characters/${encodeURIComponent(characterAvatar)}`;
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
    return getDefaultAvatarUrl(characterAvatar);
  }

  // Expression images are stored in /characters/[name]/[emotion].png
  // Extract character name from avatar filename (e.g., "Seraphina.png" -> "Seraphina")
  const characterName = characterAvatar.replace(/\.[^/.]+$/, '');
  const url = `/characters/${encodeURIComponent(characterName)}/${emotion}.png`;

  console.log('[Expression] Avatar:', characterAvatar, '-> Name:', characterName, '-> URL:', url);

  return url;
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
