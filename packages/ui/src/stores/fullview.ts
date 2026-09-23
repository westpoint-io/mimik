import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createEditorSlice, type EditorSlice } from '../guide/store/editor-slice';
import { createGuideSlice, type GuideSlice } from '../guide/store/guide-slice';
import { createLibrarySlice, type LibrarySlice } from '../library/store/library-slice';
import { createSearchSlice, type SearchSlice } from '../search/store/search-slice';

export type { GuideExportData } from '../guide/store/guide-slice';

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
