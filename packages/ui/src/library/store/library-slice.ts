import type { Guide, Screenshot } from '@mimik/core/guides/types';
import type { StateCreator } from 'zustand';
import type { GuidePlace, LibraryDisplay, SortKey } from '../types';

const DISPLAY_KEY = 'mimik-display';

export interface LibrarySlice {
  guides: Guide[];
  setGuides: (guides: Guide[]) => void;
  updateGuide: (id: string, patch: Partial<Guide>) => void;
  thumbnails: Map<string, Screenshot>;
  setThumbnails: (thumbnails: Map<string, Screenshot>) => void;
  places: Map<string, GuidePlace>;
  setPlaces: (places: Map<string, GuidePlace>) => void;
  sort: SortKey;
  setSort: (sort: SortKey) => void;
  display: LibraryDisplay;
  setDisplay: (display: LibraryDisplay) => void;
  total: number | null;
  setTotal: (total: number) => void;
  page: number;
  pageKey: string;
  setPage: (page: number, pageKey: string) => void;
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  counts: { all: number; starred: number; trash: number };
  setCounts: (counts: { all: number; starred: number; trash: number }) => void;
}

export const createLibrarySlice: StateCreator<LibrarySlice, [], [], LibrarySlice> = (set) => ({
  guides: [],
  setGuides: (guides) => set({ guides }),
  updateGuide: (id, patch) => set((s) => ({ guides: s.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  thumbnails: new Map(),
  setThumbnails: (thumbnails) => set({ thumbnails }),
  places: new Map(),
  setPlaces: (places) => set({ places }),
  sort: 'recent',
  setSort: (sort) => set({ sort }),
  display: localStorage.getItem(DISPLAY_KEY) === 'list' ? 'list' : 'grid',
  setDisplay: (display) => {
    localStorage.setItem(DISPLAY_KEY, display);
    set({ display });
  },
  total: null,
  setTotal: (total) => set({ total }),
  page: 0,
  pageKey: '',
  setPage: (page, pageKey) => set({ page, pageKey }),
  importFile: null,
  setImportFile: (importFile) => set({ importFile }),
  counts: { all: 0, starred: 0, trash: 0 },
  setCounts: (counts) => set({ counts }),
});
