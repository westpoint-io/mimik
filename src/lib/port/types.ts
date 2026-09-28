import type { browser } from '#imports';
import type { AiFailureReason } from '@/core/capture/ai/errors';
import type { CaptureStateValue, PauseReason } from '@/core/capture/machine';
import type { VoiceErrorReason } from '@/lib/voice/voice-message';

export interface PanelStateUpdate {
  type: 'STATE_UPDATE';
  state: CaptureStateValue;
  stepCount: number;
  currentGuideId: string | null;
  pauseReason: PauseReason | null;
}

export type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'error';

export interface PanelVoiceUpdate {
  type: 'VOICE_UPDATE';
  phase: VoicePhase;
  reason?: VoiceErrorReason;
  error?: string;
  narrated?: number;
}

export interface PanelAiUpdate {
  type: 'AI_UPDATE';
  reason: AiFailureReason;
  status?: number;
  provider: string;
}

export type PortMessage = PanelStateUpdate | PanelVoiceUpdate | PanelAiUpdate;

export type Port = ReturnType<typeof browser.runtime.connect>;
