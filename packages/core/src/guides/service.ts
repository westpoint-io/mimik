import type { GuideStore } from './store';
import { store } from './store';

export type { GuideChangeEvent } from './dexie-store';
export { onGuidesChanged } from './dexie-store';
export { configureStore, resetStore } from './store';
export type { GuideStore };

export const createGuide: GuideStore['createGuide'] = (...args) => store.createGuide(...args);
export const getGuide: GuideStore['getGuide'] = (...args) => store.getGuide(...args);
export const getGuides: GuideStore['getGuides'] = (...args) => store.getGuides(...args);
export const getStarredGuides: GuideStore['getStarredGuides'] = (...args) => store.getStarredGuides(...args);
export const getTrashedGuides: GuideStore['getTrashedGuides'] = (...args) => store.getTrashedGuides(...args);
export const updateGuideTitle: GuideStore['updateGuideTitle'] = (...args) => store.updateGuideTitle(...args);
export const updateGuideDescription: GuideStore['updateGuideDescription'] = (...args) =>
  store.updateGuideDescription(...args);
export const addStepToGuide: GuideStore['addStepToGuide'] = (...args) => store.addStepToGuide(...args);
export const toggleStar: GuideStore['toggleStar'] = (...args) => store.toggleStar(...args);
export const softDeleteGuide: GuideStore['softDeleteGuide'] = (...args) => store.softDeleteGuide(...args);
export const restoreGuide: GuideStore['restoreGuide'] = (...args) => store.restoreGuide(...args);
export const permanentlyDeleteGuide: GuideStore['permanentlyDeleteGuide'] = (...args) =>
  store.permanentlyDeleteGuide(...args);
export const reorderSteps: GuideStore['reorderSteps'] = (...args) => store.reorderSteps(...args);
export const createStep: GuideStore['createStep'] = (...args) => store.createStep(...args);
export const mergeGuideInto: GuideStore['mergeGuideInto'] = (...args) => store.mergeGuideInto(...args);
export const insertBlock: GuideStore['insertBlock'] = (...args) => store.insertBlock(...args);
export const updateCallout: GuideStore['updateCallout'] = (...args) => store.updateCallout(...args);
export const updateStepDescription: GuideStore['updateStepDescription'] = (...args) =>
  store.updateStepDescription(...args);
export const applyNarrationToSteps: GuideStore['applyNarrationToSteps'] = (...args) =>
  store.applyNarrationToSteps(...args);
export const applyAiDescription: GuideStore['applyAiDescription'] = (...args) => store.applyAiDescription(...args);
export const clearStepAiPending: GuideStore['clearStepAiPending'] = (...args) => store.clearStepAiPending(...args);
export const getStep: GuideStore['getStep'] = (...args) => store.getStep(...args);
export const updateStepInputValue: GuideStore['updateStepInputValue'] = (...args) =>
  store.updateStepInputValue(...args);
export const updateStepCapture: GuideStore['updateStepCapture'] = (...args) => store.updateStepCapture(...args);
export const getStepsForGuide: GuideStore['getStepsForGuide'] = (...args) => store.getStepsForGuide(...args);
export const findExistingStepIds: GuideStore['findExistingStepIds'] = (...args) => store.findExistingStepIds(...args);
export const deleteSteps: GuideStore['deleteSteps'] = (...args) => store.deleteSteps(...args);
export const deleteStep: GuideStore['deleteStep'] = (...args) => store.deleteStep(...args);
export const getGuideDomain: GuideStore['getGuideDomain'] = (...args) => store.getGuideDomain(...args);
export const allScreenshotIds: GuideStore['allScreenshotIds'] = (...args) => store.allScreenshotIds(...args);
export const saveScreenshot: GuideStore['saveScreenshot'] = (...args) => store.saveScreenshot(...args);
export const replaceScreenshot: GuideStore['replaceScreenshot'] = (...args) => store.replaceScreenshot(...args);
export const updateScreenshotEdits: GuideStore['updateScreenshotEdits'] = (...args) =>
  store.updateScreenshotEdits(...args);
export const deleteScreenshot: GuideStore['deleteScreenshot'] = (...args) => store.deleteScreenshot(...args);
export const getScreenshotsForSteps: GuideStore['getScreenshotsForSteps'] = (...args) =>
  store.getScreenshotsForSteps(...args);
export const getFirstScreenshot: GuideStore['getFirstScreenshot'] = (...args) => store.getFirstScreenshot(...args);
export const createSnapshot: GuideStore['createSnapshot'] = (...args) => store.createSnapshot(...args);
export const getSnapshots: GuideStore['getSnapshots'] = (...args) => store.getSnapshots(...args);
export const renameSnapshot: GuideStore['renameSnapshot'] = (...args) => store.renameSnapshot(...args);
export const revertToSnapshot: GuideStore['revertToSnapshot'] = (...args) => store.revertToSnapshot(...args);
export const duplicateGuide: GuideStore['duplicateGuide'] = (...args) => store.duplicateGuide(...args);
export const importGuide: GuideStore['importGuide'] = (...args) => store.importGuide(...args);
export const saveTranscript: GuideStore['saveTranscript'] = (...args) => store.saveTranscript(...args);
export const getTranscripts: GuideStore['getTranscripts'] = (...args) => store.getTranscripts(...args);
export const hasTranscript: GuideStore['hasTranscript'] = (...args) => store.hasTranscript(...args);
export const deleteTranscripts: GuideStore['deleteTranscripts'] = (...args) => store.deleteTranscripts(...args);
export const addTranscriptLineToStep: GuideStore['addTranscriptLineToStep'] = (...args) =>
  store.addTranscriptLineToStep(...args);
export const restoreNarratedDescription: GuideStore['restoreNarratedDescription'] = (...args) =>
  store.restoreNarratedDescription(...args);
