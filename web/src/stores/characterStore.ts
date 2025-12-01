import { create } from 'zustand';
import { api, type CharacterInfo } from '../api/client';

interface CharacterState {
  characters: CharacterInfo[];
  selectedCharacter: CharacterInfo | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCharacters: () => Promise<void>;
  selectCharacter: (avatar: string) => Promise<void>;
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
      const characters = await api.getCharacters();
      set({ characters, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch characters',
      });
    }
  },

  selectCharacter: async (avatar: string) => {
    const { characters } = get();
    let character = characters.find((c) => c.avatar === avatar);

    if (!character) {
      set({ error: 'Character not found' });
      return;
    }

    // If we don't have full data, fetch it
    if (!character.first_mes) {
      try {
        set({ isLoading: true });
        const fullCharacter = await api.getCharacter(avatar);
        character = { ...character, ...fullCharacter };

        // Update in the list
        set({
          characters: characters.map((c) => (c.avatar === avatar ? character! : c)),
          isLoading: false,
        });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load character',
        });
        return;
      }
    }

    set({ selectedCharacter: character });
  },

  clearSelection: () => set({ selectedCharacter: null }),
}));
