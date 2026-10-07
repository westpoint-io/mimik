import type { Guide, Screenshot, Step } from '@mimik/core/guides/types';
import type { StateCreator } from 'zustand';
import { CLOSED_EDITOR, type EditorSlice } from './editor-slice';

export interface GuideExportData {
  guideId: string;
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}

export interface GuideSlice {
  guideTitle: string;
  setGuideTitle: (title: string) => void;
  guideStepCount: number;
  setGuideStepCount: (count: number) => void;
  guideExportData: GuideExportData | null;
  setGuideExportData: (data: GuideExportData | null) => void;
  scrollToStepId: string | null;
  scrollToStep: (stepId: string) => void;
  activeStepId: string | null;
  setActiveStepId: (id: string | null) => void;
}

const SCROLL_SIGNAL_MS = 100;

export const createGuideSlice: StateCreator<GuideSlice & EditorSlice, [], [], GuideSlice> = (set) => ({
  guideTitle: '',
  setGuideTitle: (guideTitle) => set({ guideTitle }),
  guideStepCount: 0,
  setGuideStepCount: (guideStepCount) => set({ guideStepCount }),
  guideExportData: null,
  setGuideExportData: (guideExportData) =>
    set((s) =>
      s.guideExportData?.guideId === guideExportData?.guideId
        ? { guideExportData }
        : { guideExportData, ...CLOSED_EDITOR },
    ),
  scrollToStepId: null,
  scrollToStep: (stepId) => {
    set({ scrollToStepId: stepId });
    setTimeout(() => set({ scrollToStepId: null }), SCROLL_SIGNAL_MS);
  },
  activeStepId: null,
  setActiveStepId: (activeStepId) => set({ activeStepId }),
});
