import { useState, useEffect, useCallback } from 'react';
import { spritesApi, type SpriteInfo } from '../api/client';
import type { Emotion } from '../utils/emotions';

// Cache sprite paths by character name
const spriteCache = new Map<string, SpriteInfo[]>();

/**
 * Extract the actual character name from avatar filename.
 * SillyTavern sometimes prefixes avatar filenames with "default_"
 * but the sprite folder uses the actual character name.
 */
function extractCharacterName(avatarName: string | undefined): string | undefined {
  if (!avatarName) return undefined;

  // Remove file extension first
  let name = avatarName.replace(/\.[^/.]+$/, '');

  // Remove "default_" prefix if present
  if (name.startsWith('default_')) {
    name = name.substring(8); // Remove "default_" (8 characters)
  }

  return name;
}

export function useCharacterSprites(avatarFilename: string | undefined) {
  const [sprites, setSprites] = useState<SpriteInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract actual character name from avatar filename
  const characterName = extractCharacterName(avatarFilename);

  useEffect(() => {
    if (!characterName) {
      setSprites([]);
      return;
    }

    // Check cache first
    const cached = spriteCache.get(characterName);
    if (cached) {
      setSprites(cached);
      return;
    }

    // Fetch from API
    setIsLoading(true);
    setError(null);

    spritesApi
      .getSprites(characterName)
      .then((result) => {
        // Handle case where API returns non-array (error object)
        const spriteList = Array.isArray(result) ? result : [];
        spriteCache.set(characterName, spriteList);
        setSprites(spriteList);
        console.log('[Sprites] Loaded for', characterName, ':', spriteList);
      })
      .catch((err) => {
        console.error('[Sprites] Failed to load for', characterName, ':', err);
        setError(err.message);
        setSprites([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [characterName]);

  // Get the path for a specific emotion
  const getSpritePath = useCallback(
    (emotion: Emotion | null): string | null => {
      if (!emotion || sprites.length === 0) return null;
      const sprite = sprites.find((s) => s.label === emotion);
      return sprite?.path ?? null;
    },
    [sprites]
  );

  // Check if a sprite exists for an emotion
  const hasSprite = useCallback(
    (emotion: Emotion): boolean => {
      return sprites.some((s) => s.label === emotion);
    },
    [sprites]
  );

  // Invalidate cache for a character (useful after uploading new sprites)
  const invalidateCache = useCallback((name: string) => {
    spriteCache.delete(name);
  }, []);

  return {
    sprites,
    isLoading,
    error,
    getSpritePath,
    hasSprite,
    invalidateCache,
  };
}
