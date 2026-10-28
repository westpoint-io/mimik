import type { StateCreator } from 'zustand';
import { toggleSelection } from '../lib/toggle-selection';

const COLLAPSED_KEY = 'mimik-outline-collapsed';

export interface OutlineSlice {
  outlineCollapsed: boolean;
  setOutlineCollapsed: (collapsed: boolean) => void;
  outlineDrawerOpen: boolean;
  setOutlineDrawerOpen: (open: boolean) => void;
  selectedStepIds: Set<string>;
  selectionAnchorId: string | null;
  toggleStepSelection: (steps: { id: string }[], stepId: string, extend: boolean) => void;
  clearStepSelection: () => void;
}

export const createOutlineSlice: StateCreator<OutlineSlice, [], [], OutlineSlice> = (set) => ({
  outlineCollapsed: localStorage.getItem(COLLAPSED_KEY) === '1',
  setOutlineCollapsed: (outlineCollapsed) => {
    if (outlineCollapsed) localStorage.setItem(COLLAPSED_KEY, '1');
    else localStorage.removeItem(COLLAPSED_KEY);
    set({ outlineCollapsed });
  },
  outlineDrawerOpen: false,
  setOutlineDrawerOpen: (outlineDrawerOpen) => set({ outlineDrawerOpen }),
  selectedStepIds: new Set(),
  selectionAnchorId: null,
  toggleStepSelection: (steps, stepId, extend) =>
    set((s) => ({
      selectedStepIds: toggleSelection(steps, s.selectedStepIds, s.selectionAnchorId, stepId, extend),
      selectionAnchorId: stepId,
    })),
  clearStepSelection: () => set({ selectedStepIds: new Set(), selectionAnchorId: null }),
});
