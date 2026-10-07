import { defineExtensionMessaging } from '@webext-core/messaging';
import type { GenerateGuideDescriptionResponse } from '@/core/capture/ai/guide-description';
import type { RewriteError, RewriteSelectionResponse } from '@/core/capture/ai/rewrite';
import type { CaptureStateValue, PauseReason } from '@/core/capture/machine';
import type {
  CaptureStepData,
  CaptureStepResponse,
  FinalizeInputStepData,
  FinalizeInputStepResponse,
  UpdateInputStepData,
  UpdateInputStepResponse,
} from '@/core/capture/sink';
import type { VoiceoverProviderKey } from '@/core/export/voiceover/providers';

export interface GetStateResponse {
  state: CaptureStateValue;
  stepCount: number;
  currentGuideId: string | null;
  pauseReason: PauseReason | null;
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

export interface GenerateGuideDescriptionData {
  guideId: string;
}

export interface RewriteSelectionData {
  text: string;
  instruction: string;
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
  warning?: 'cannot-spend';
}

export interface ListVoicesData {
  provider: VoiceoverProviderKey;
  apiKey: string;
}

export interface ListVoicesResponse {
  voices: { id: string; name: string }[];
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

export interface PauseCaptureResponse {
  paused: boolean;
}

export interface ResumeCaptureResponse {
  resumed: boolean;
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
  pauseCapture(): PauseCaptureResponse;
  resumeCapture(): ResumeCaptureResponse;
  startNarration(): StartNarrationResponse;
  generateGuideDescription(data: GenerateGuideDescriptionData): GenerateGuideDescriptionResponse;
  validateApiKey(data: ValidateApiKeyData): ValidateApiKeyResponse;
  listVoices(data: ListVoicesData): ListVoicesResponse;
  rewriteSelection(data: RewriteSelectionData): RewriteSelectionResponse;
}

export type {
  CaptureStepData,
  CaptureStepResponse,
  FinalizeInputStepData,
  FinalizeInputStepResponse,
  RewriteError,
  RewriteSelectionResponse,
  UpdateInputStepData,
  UpdateInputStepResponse,
};

export const { sendMessage, onMessage } = defineExtensionMessaging<MimikProtocol>();
