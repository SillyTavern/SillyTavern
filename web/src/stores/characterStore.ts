import { create } from 'zustand';
import { api } from '../api/client';

interface Character {
  name: string;
  avatar: string;
  description?: string;
  loaded?: boolean;
  data?: Record<string, unknown>;
}

interface CharacterState {
  characters: Character[];
  selectedCharacter: Character | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCharacters: () => Promise<void>;
  selectCharacter: (name: string) => Promise<void>;
  clearSelection: () => void;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  selectedCharacter: null,
  isLoading: false,
  error: null,

  fetchCharacters: async () => {
    set({ isLoading: true, error: null });
    try {
      const characterNames = await api.getCharacters();
      const characters: Character[] = characterNames.map((name) => ({
        name: name.replace('.png', ''),
        avatar: `/characters/${encodeURIComponent(name)}`,
      }));
      set({ characters, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch characters',
      });
    }
  },

  selectCharacter: async (name: string) => {
    const { characters } = get();
    let character = characters.find((c) => c.name === name);

    if (!character) {
      set({ error: 'Character not found' });
      return;
    }

    // Load full character data if not already loaded
    if (!character.loaded) {
      try {
        const data = await api.getCharacter(name);
        character = {
          ...character,
          description: data.description as string,
          data,
          loaded: true,
        };

        // Update in the list
        set({
          characters: characters.map((c) => (c.name === name ? character! : c)),
        });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to load character' });
        return;
      }
    }

    set({ selectedCharacter: character });
  },

  clearSelection: () => set({ selectedCharacter: null }),
}));
