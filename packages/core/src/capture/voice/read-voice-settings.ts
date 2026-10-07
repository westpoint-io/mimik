import { localStorage } from '@/core/env';
import { hasVoiceApiKey, VOICE_KEY_SETTINGS } from './api-key';

export interface VoiceSettings {
  enabled: boolean;
  hasApiKey: boolean;
  microphoneId?: string;
}

export async function readVoiceSettings(): Promise<VoiceSettings> {
  const stored = await localStorage.get([...VOICE_KEY_SETTINGS, 'voiceEnabled', 'voiceMicrophoneId']);
  const microphoneId = typeof stored.voiceMicrophoneId === 'string' ? stored.voiceMicrophoneId.trim() : '';
  return {
    enabled: stored.voiceEnabled === true,
    hasApiKey: hasVoiceApiKey(stored),
    microphoneId: microphoneId || undefined,
  };
}
