import type { StateCreator } from 'zustand';

export interface SearchSlice {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
}

export const createSearchSlice: StateCreator<SearchSlice, [], [], SearchSlice> = (set) => ({
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
});
