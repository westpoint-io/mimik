import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createEditorSlice, type EditorSlice } from './slices/editor';
import { createGuideSlice, type GuideSlice } from './slices/guide';
import { createLibrarySlice, type LibrarySlice } from './slices/library';
import { createSearchSlice, type SearchSlice } from './slices/search';

export type { GuideExportData } from './slices/guide';

type FullviewStore = LibrarySlice & SearchSlice & GuideSlice & EditorSlice;

export const useFullviewStore = create<FullviewStore>()((...a) => ({
  ...createLibrarySlice(...a),
  ...createSearchSlice(...a),
  ...createGuideSlice(...a),
  ...createEditorSlice(...a),
}));

export function useFullview<T>(selector: (s: FullviewStore) => T): T {
  return useFullviewStore(useShallow(selector));
}
