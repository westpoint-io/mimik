import { defineExtensionMessaging } from '@webext-core/messaging';
import type { GenerateGuideDescriptionResponse } from '@/core/capture/ai/guide-description';
import type { RewriteSelectionResponse } from '@/core/capture/ai/rewrite';
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

interface StartRecordingData {
  url: string;
  insertTargetGuideId?: string;
  insertAtIndex?: number;
}

interface StartRecordingResponse {
  guideId: string;
}

interface StopRecordingResponse {
  success: boolean;
  guideId?: string;
  inserted?: boolean;
}

interface DiscardRecordingResponse {
  discarded: boolean;
}

interface StartGuideMeData {
  guideId: string;
}

interface StartGuideMeResponse {
  started: boolean;
  error?: string;
}

interface GuideMeStepCompletedData {
  stepIndex: number;
}

interface GuideMeStepCompletedResponse {
  advanced: boolean;
  completed?: boolean;
}

interface GuideMe_CancelResponse {
  cancelled: boolean;
}

interface GuideMe_GoToData {
  stepIndex: number;
}

interface GuideMe_GoToResponse {
  moved: boolean;
}

interface GenerateGuideDescriptionData {
  guideId: string;
}

interface RewriteSelectionData {
  text: string;
  instruction: string;
}

interface ValidateApiKeyData {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

interface ValidateApiKeyResponse {
  valid: boolean;
  reason?: 'rejected' | 'network' | 'model-required' | 'model-invalid';
  models?: string[];
  warning?: 'cannot-spend';
}

interface ListVoicesData {
  provider: VoiceoverProviderKey;
  apiKey: string;
}

interface ListVoicesResponse {
  voices: { id: string; name: string }[];
}

interface EnterBlurModeResponse {
  entered: boolean;
}

interface StartNarrationResponse {
  started: boolean;
}

interface StopNarrationResponse {
  stopped: boolean;
}

interface ExitBlurModeResponse {
  exited: boolean;
}

interface PauseCaptureResponse {
  paused: boolean;
}

interface ResumeCaptureResponse {
  resumed: boolean;
}

interface MimikProtocol {
  getState(): GetStateResponse;
  startRecording(data: StartRecordingData): StartRecordingResponse;
  stopRecording(): StopRecordingResponse;
  discardRecording(): DiscardRecordingResponse;
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
  stopNarration(): StopNarrationResponse;
  generateGuideDescription(data: GenerateGuideDescriptionData): GenerateGuideDescriptionResponse;
  validateApiKey(data: ValidateApiKeyData): ValidateApiKeyResponse;
  listVoices(data: ListVoicesData): ListVoicesResponse;
  rewriteSelection(data: RewriteSelectionData): RewriteSelectionResponse;
}

export type { CaptureStepData, CaptureStepResponse };

export const { sendMessage, onMessage } = defineExtensionMessaging<MimikProtocol>();
