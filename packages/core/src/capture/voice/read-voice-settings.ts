import { localStorage } from '@/core/env';
import { resolveVoiceApiKey, VOICE_KEY_SETTINGS } from './api-key';
import { type TranscriptionBlocker, transcriptionBlocker } from './transcription-blocker';

export interface VoiceSettings {
  enabled: boolean;
  hasApiKey: boolean;
  blocker: TranscriptionBlocker | null;
  microphoneId?: string;
}

export async function readVoiceSettings(): Promise<VoiceSettings> {
  const stored = await localStorage.get([...VOICE_KEY_SETTINGS, 'voiceEnabled', 'voiceMicrophoneId']);
  const blocker = transcriptionBlocker(resolveVoiceApiKey(stored));
  const microphoneId = typeof stored.voiceMicrophoneId === 'string' ? stored.voiceMicrophoneId.trim() : '';
  return {
    enabled: stored.voiceEnabled === true,
    hasApiKey: blocker === null,
    blocker,
    microphoneId: microphoneId || undefined,
  };
}
