import type { Guide, Screenshot } from '@mimik/core/guides/types';
import type { StateCreator } from 'zustand';

export interface LibrarySlice {
  guides: Guide[];
  setGuides: (guides: Guide[]) => void;
  updateGuide: (id: string, patch: Partial<Guide>) => void;
  thumbnails: Map<string, Screenshot>;
  setThumbnails: (thumbnails: Map<string, Screenshot>) => void;
  libraryLoading: boolean;
  setLibraryLoading: (loading: boolean) => void;
  counts: { all: number; starred: number; trash: number };
  setCounts: (counts: { all: number; starred: number; trash: number }) => void;
}

export const createLibrarySlice: StateCreator<LibrarySlice, [], [], LibrarySlice> = (set) => ({
  guides: [],
  setGuides: (guides) => set({ guides }),
  updateGuide: (id, patch) => set((s) => ({ guides: s.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  thumbnails: new Map(),
  setThumbnails: (thumbnails) => set({ thumbnails }),
  libraryLoading: true,
  setLibraryLoading: (libraryLoading) => set({ libraryLoading }),
  counts: { all: 0, starred: 0, trash: 0 },
  setCounts: (counts) => set({ counts }),
});
