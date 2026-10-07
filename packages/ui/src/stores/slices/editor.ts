import type { StateCreator } from 'zustand';

export interface EditorSlice {
  editing: boolean;
  setEditing: (editing: boolean) => void;
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  historyRefreshKey: number;
  bumpHistoryRefresh: () => void;
}

export const CLOSED_EDITOR = { editing: false, historyOpen: false, historyRefreshKey: 0 } as const;

function flushFocusedField() {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.blur();
}

export const createEditorSlice: StateCreator<EditorSlice, [], [], EditorSlice> = (set) => ({
  editing: false,
  setEditing: (editing) => {
    if (!editing) flushFocusedField();
    set({ editing });
  },
  historyOpen: false,
  setHistoryOpen: (historyOpen) => {
    if (historyOpen) flushFocusedField();
    set({ historyOpen });
  },
  historyRefreshKey: 0,
  bumpHistoryRefresh: () => set((s) => ({ historyRefreshKey: s.historyRefreshKey + 1 })),
});
