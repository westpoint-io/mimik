import type { VoiceProvider } from '@/core/capture/voice/transcribe';
import type { NarrationResult } from '@/core/capture/voice/types';

export const VOICE_OFFSCREEN_TARGET = 'mimik-offscreen';
export const VOICE_BACKGROUND_TARGET = 'mimik-background';
export const VOICE_SIDEPANEL_TARGET = 'mimik-sidepanel';

export type VoiceTarget =
  | typeof VOICE_OFFSCREEN_TARGET
  | typeof VOICE_BACKGROUND_TARGET
  | typeof VOICE_SIDEPANEL_TARGET;

export const VoiceMessage = {
  VOICE_START: 'VOICE_START',
  VOICE_STOP: 'VOICE_STOP',
  VOICE_FLUSH: 'VOICE_FLUSH',
  VOICE_ABORT: 'VOICE_ABORT',
  VOICE_STATUS: 'VOICE_STATUS',
  VOICE_PERMISSION_QUERY: 'VOICE_PERMISSION_QUERY',
  VOICE_EPOCH: 'VOICE_EPOCH',
  VOICE_LEVEL: 'VOICE_LEVEL',
  VOICE_ERROR: 'VOICE_ERROR',
  VOICE_RESULT: 'VOICE_RESULT',
  VOICE_HANDOFF: 'VOICE_HANDOFF',
  VOICE_PERMISSION_RESULT: 'VOICE_PERMISSION_RESULT',
} as const;

export type VoiceMessageType = (typeof VoiceMessage)[keyof typeof VoiceMessage];

export type VoiceErrorReason =
  | 'permission-denied'
  | 'no-device'
  | 'no-audio'
  | 'not-recording'
  | 'already-recording'
  | 'missing-api-key'
  | 'stream-ended'
  | 'unsupported'
  | 'unknown';

export interface VoiceEnvelope {
  type: VoiceMessageType;
  target: VoiceTarget;
  timestamp: number;
}

export interface VoiceStartRequest extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_START;
  target: typeof VOICE_OFFSCREEN_TARGET;
  deviceId?: string;
}

export type VoiceStartResponse =
  | { started: true; deviceId: string | null; usedFallbackDevice: boolean }
  | { started: false; reason: VoiceErrorReason; error: string };

export interface VoiceStepMark {
  stepId: string;
  timestamp: number;
}

export interface VoiceTranscriptionSettings {
  provider: VoiceProvider;
  apiKey: string;
  language?: string;
}

export interface VoiceStopRequest extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_STOP;
  target: typeof VOICE_OFFSCREEN_TARGET;
  guideId: string;
  steps: VoiceStepMark[];
  settings: VoiceTranscriptionSettings;
}

export type VoiceStopResponse =
  | { ok: true; audioEpochMs: number; durationSeconds: number }
  | { ok: false; reason: VoiceErrorReason; error: string };

export interface VoiceFlushRequest extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_FLUSH;
  target: typeof VOICE_OFFSCREEN_TARGET;
  guideId: string;
  step: VoiceStepMark;
  settings: VoiceTranscriptionSettings;
}

export type VoiceFlushResponse =
  | { ok: true; flushed: boolean }
  | { ok: false; reason: VoiceErrorReason; error: string };

export interface VoiceAbortRequest extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_ABORT;
  target: typeof VOICE_OFFSCREEN_TARGET;
}

export interface VoiceAbortResponse {
  ok: true;
}

export interface VoiceStatusRequest extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_STATUS;
  target: typeof VOICE_OFFSCREEN_TARGET;
}

export interface VoiceStatusResponse {
  recording: boolean;
  transcribing: boolean;
  audioEpochMs: number | null;
  sampleRate: number;
  samples: number;
  durationSeconds: number;
}

export type VoicePermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface VoicePermissionQueryRequest extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_PERMISSION_QUERY;
  target: typeof VOICE_OFFSCREEN_TARGET;
}

export interface VoicePermissionQueryResponse {
  state: VoicePermissionState;
}

export interface VoiceEpochEvent extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_EPOCH;
  target: typeof VOICE_BACKGROUND_TARGET;
  audioEpochMs: number;
}

export interface VoiceLevelEvent extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_LEVEL;
  target: typeof VOICE_SIDEPANEL_TARGET;
  level: number;
  speaking: boolean;
}

export interface VoiceErrorEvent extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_ERROR;
  target: typeof VOICE_BACKGROUND_TARGET;
  reason: VoiceErrorReason;
  error: string;
}

export interface VoiceResultEvent extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_RESULT;
  target: typeof VOICE_BACKGROUND_TARGET;
  guideId: string;
  result: NarrationResult;
}

export interface VoiceHandoffEvent extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_HANDOFF;
  target: typeof VOICE_BACKGROUND_TARGET;
  pcm: Int16Array;
  sampleRate: number;
  audioEpochMs: number;
  durationSeconds: number;
}

export interface VoicePermissionResultEvent extends VoiceEnvelope {
  type: typeof VoiceMessage.VOICE_PERMISSION_RESULT;
  target: typeof VOICE_BACKGROUND_TARGET;
  state: 'granted' | 'denied';
}

export type VoiceRequest =
  | VoiceStartRequest
  | VoiceStopRequest
  | VoiceFlushRequest
  | VoiceAbortRequest
  | VoiceStatusRequest
  | VoicePermissionQueryRequest;

export type VoiceEvent =
  | VoiceEpochEvent
  | VoiceLevelEvent
  | VoiceErrorEvent
  | VoiceResultEvent
  | VoiceHandoffEvent
  | VoicePermissionResultEvent;

export function voiceMessage<T extends VoiceEnvelope>(message: Omit<T, 'timestamp'>): T {
  return { ...message, timestamp: Date.now() } as T;
}
