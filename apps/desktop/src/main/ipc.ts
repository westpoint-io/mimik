import type { CaptureStateUpdate } from '@mimik/core/capture/capture-state-update';
import type { CaptureStepData } from '@mimik/core/capture/sink';
import type { OverlayCommand } from './overlay';

export interface DesktopStateUpdate extends CaptureStateUpdate {
  command: OverlayCommand | null;
  narrationWasLive: boolean;
}

export type DesktopCaptureStepData = CaptureStepData & {
  inputValue?: string;
  zoomLevel?: number;
};

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface RendererRequests {
  'mimik:capture:createGuide': [{ guideId?: string | null; staging?: boolean }, string];
  'mimik:capture:captureStep': [DesktopCaptureStepData, { stepId: string; title: string; pending: boolean }];
  'mimik:capture:deleteStep': [{ guideId: string; stepId: string }, boolean];
  'mimik:capture:discardRecording': [{ guideId: string; staging: boolean }, boolean];
  'mimik:capture:finishGuide': [string, boolean];
  'mimik:capture:mergeGuideInto': [{ guideId: string; insertTargetGuideId: string; insertAtIndex: number }, boolean];
  'mimik:check:cleanup': [string[], boolean];
  'mimik:check:defaultLogo': [undefined, boolean];
  'mimik:check:screenshotIds': [undefined, string[]];
  'mimik:check:screenshotSrc': [string, string | null];
  'mimik:check:steps': [string, string[] | null];
  'mimik:check:title': [string, string | null];
  'mimik:check:trashed': [string, boolean | null];
  'mimik:check:verify': [string, CheckResult[]];
}

export type RendererRequest = keyof RendererRequests;
