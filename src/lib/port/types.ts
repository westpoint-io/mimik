import type { browser } from '#imports';
import type { AiFailureUpdate } from '@/core/capture/ai/errors';
import type { CaptureStateValue, PauseReason } from '@/core/capture/machine';
import type { VoiceUpdate } from '@/core/capture/voice/voice-update';

export interface PanelStateUpdate {
  type: 'STATE_UPDATE';
  state: CaptureStateValue;
  stepCount: number;
  currentGuideId: string | null;
  pauseReason: PauseReason | null;
}

export interface PanelVoiceUpdate extends VoiceUpdate {
  type: 'VOICE_UPDATE';
}

export interface PanelAiUpdate extends AiFailureUpdate {
  type: 'AI_UPDATE';
}

export type PortMessage = PanelStateUpdate | PanelVoiceUpdate | PanelAiUpdate;

export type Port = ReturnType<typeof browser.runtime.connect>;
