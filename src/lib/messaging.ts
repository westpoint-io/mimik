import { defineExtensionMessaging } from '@webext-core/messaging';
import type { DOMContext } from '@/core/capture/dom/context';
import type { CaptureStateValue } from '@/core/capture/machine';
import type { ElementMeta } from '@/core/guides/types';

export interface GetStateResponse {
  state: CaptureStateValue;
  stepCount: number;
  currentGuideId: string | null;
}

export interface StartRecordingData {
  url: string;
  insertTargetGuideId?: string;
  insertAtIndex?: number;
}

export interface StartRecordingResponse {
  guideId: string;
}

export interface StopRecordingResponse {
  success: boolean;
  guideId?: string;
  inserted?: boolean;
}

export interface CaptureStepData {
  guideId: string;
  action: string;
  elementMeta: ElementMeta;
  domContext?: DOMContext;
}

export type CaptureStepResponse = { stepId: string } | { ignored: true } | { error: string };

export interface UpdateInputStepData {
  stepId: string;
  description: string;
  inputValue?: string;
}

export interface UpdateInputStepResponse {
  updated: boolean;
}

export interface FinalizeInputStepData {
  stepId: string;
  elementMeta: ElementMeta;
  domContext?: DOMContext;
}

export interface FinalizeInputStepResponse {
  updated: boolean;
}

export interface StartGuideMeData {
  guideId: string;
}

export interface StartGuideMeResponse {
  started: boolean;
  error?: string;
}

export interface GuideMeStepCompletedData {
  stepIndex: number;
}

export interface GuideMeStepCompletedResponse {
  advanced: boolean;
  completed?: boolean;
}

export interface GuideMe_CancelResponse {
  cancelled: boolean;
}

export interface GuideMe_GoToData {
  stepIndex: number;
}

export interface GuideMe_GoToResponse {
  moved: boolean;
}

export type GuideDescriptionError = 'no-api-key' | 'no-steps' | 'generation-failed' | 'save-failed';

export interface GenerateGuideDescriptionData {
  guideId: string;
}

export interface GenerateGuideDescriptionResponse {
  description?: string;
  error?: GuideDescriptionError;
}

export type RewriteError = 'no-api-key' | 'generation-failed';

export interface RewriteSelectionData {
  text: string;
  instruction: string;
}

export interface RewriteSelectionResponse {
  text?: string;
  error?: RewriteError;
}

export interface ValidateApiKeyData {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface ValidateApiKeyResponse {
  valid: boolean;
  reason?: 'rejected' | 'network' | 'model-required' | 'model-invalid';
  models?: string[];
}

export interface EnterBlurModeResponse {
  entered: boolean;
}

export interface StartNarrationResponse {
  started: boolean;
}

export interface ExitBlurModeResponse {
  exited: boolean;
}

interface MimikProtocol {
  getState(): GetStateResponse;
  startRecording(data: StartRecordingData): StartRecordingResponse;
  stopRecording(): StopRecordingResponse;
  captureStep(data: CaptureStepData): CaptureStepResponse;
  updateInputStep(data: UpdateInputStepData): UpdateInputStepResponse;
  finalizeInputStep(data: FinalizeInputStepData): FinalizeInputStepResponse;
  startGuideMe(data: StartGuideMeData): StartGuideMeResponse;
  guideMeStepCompleted(data: GuideMeStepCompletedData): GuideMeStepCompletedResponse;
  guideMeCancel(): GuideMe_CancelResponse;
  guideMeGoTo(data: GuideMe_GoToData): GuideMe_GoToResponse;
  enterBlurMode(): EnterBlurModeResponse;
  exitBlurMode(): ExitBlurModeResponse;
  startNarration(): StartNarrationResponse;
  generateGuideDescription(data: GenerateGuideDescriptionData): GenerateGuideDescriptionResponse;
  validateApiKey(data: ValidateApiKeyData): ValidateApiKeyResponse;
  rewriteSelection(data: RewriteSelectionData): RewriteSelectionResponse;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<MimikProtocol>();
