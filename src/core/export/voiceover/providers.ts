export interface VoiceoverModelOption {
  id: string;
  label: string;
}

export interface VoiceoverVoice {
  id: string;
  name: string;
}

export interface VoiceoverProviderConfig {
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: VoiceoverModelOption[];
  voices: VoiceoverVoice[];
  defaultVoice: string;
  catalog: boolean;
  keyPlaceholder: string;
}

export const VOICEOVER_PROVIDERS = {
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini-tts',
    models: [
      { id: 'gpt-4o-mini-tts', label: 'GPT-4o Mini TTS' },
      { id: 'tts-1', label: 'TTS-1' },
      { id: 'tts-1-hd', label: 'TTS-1 HD' },
    ],
    voices: [
      { id: 'alloy', name: 'Alloy' },
      { id: 'ash', name: 'Ash' },
      { id: 'coral', name: 'Coral' },
      { id: 'echo', name: 'Echo' },
      { id: 'fable', name: 'Fable' },
      { id: 'nova', name: 'Nova' },
      { id: 'onyx', name: 'Onyx' },
      { id: 'sage', name: 'Sage' },
      { id: 'shimmer', name: 'Shimmer' },
    ],
    defaultVoice: 'alloy',
    catalog: false,
    keyPlaceholder: 'sk-...',
  },
  elevenlabs: {
    label: 'ElevenLabs',
    defaultBaseUrl: 'https://api.elevenlabs.io/v1',
    defaultModel: 'eleven_turbo_v2_5',
    models: [
      { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5' },
      { id: 'eleven_multilingual_v2', label: 'Multilingual v2' },
      { id: 'eleven_flash_v2_5', label: 'Flash v2.5' },
    ],
    voices: [
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
      { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
      { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
      { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
    ],
    defaultVoice: '21m00Tcm4TlvDq8ikWAM',
    catalog: true,
    keyPlaceholder: 'sk_...',
  },
} satisfies Record<string, VoiceoverProviderConfig>;

export type VoiceoverProviderKey = keyof typeof VOICEOVER_PROVIDERS;

export const DEFAULT_VOICEOVER_PROVIDER: VoiceoverProviderKey = 'openai';

export const VOICEOVER_PROVIDER_KEYS = Object.keys(VOICEOVER_PROVIDERS) as VoiceoverProviderKey[];

export function isVoiceoverProvider(value: unknown): value is VoiceoverProviderKey {
  return typeof value === 'string' && value in VOICEOVER_PROVIDERS;
}

export function voiceoverProviderOrDefault(value: unknown): VoiceoverProviderKey {
  return isVoiceoverProvider(value) ? value : DEFAULT_VOICEOVER_PROVIDER;
}

export function voiceoverProvider(key: VoiceoverProviderKey): VoiceoverProviderConfig {
  return VOICEOVER_PROVIDERS[key];
}

export function voiceForProvider(key: VoiceoverProviderKey, voiceId: string): string {
  const config = VOICEOVER_PROVIDERS[key];
  if (!voiceId) return config.defaultVoice;
  if (config.catalog) return voiceId;
  return config.voices.some((voice) => voice.id === voiceId) ? voiceId : config.defaultVoice;
}

export function modelForProvider(key: VoiceoverProviderKey, modelId: string): string {
  const config = VOICEOVER_PROVIDERS[key];
  return config.models.some((model) => model.id === modelId) ? modelId : config.defaultModel;
}
