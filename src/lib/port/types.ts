import type { browser } from '#imports';
import type { AiFailureUpdate } from '@/core/capture/ai/errors';
import type { CaptureStateUpdate } from '@/core/capture/capture-state-update';
import type { VoiceUpdate } from '@/core/capture/voice/voice-update';

export interface PanelStateUpdate extends CaptureStateUpdate {
  type: 'STATE_UPDATE';
}

export interface PanelVoiceUpdate extends VoiceUpdate {
  type: 'VOICE_UPDATE';
}

export interface PanelAiUpdate extends AiFailureUpdate {
  type: 'AI_UPDATE';
}

export type PortMessage = PanelStateUpdate | PanelVoiceUpdate | PanelAiUpdate;

export type Port = ReturnType<typeof browser.runtime.connect>;
