import type { VoiceProvider } from './transcribe';

export const VOICE_KEY_SETTINGS = [
  'voiceProvider',
  'voiceApiKey',
  'voiceBaseUrl',
  'voiceModel',
  'aiProvider',
  'aiApiKey',
  'aiProfiles',
  'aiBaseUrl',
] as const;

export interface VoiceKeySettings {
  voiceProvider?: unknown;
  voiceApiKey?: unknown;
  voiceBaseUrl?: unknown;
  voiceModel?: unknown;
  aiProvider?: unknown;
  aiApiKey?: unknown;
  aiProfiles?: unknown;
  aiBaseUrl?: unknown;
}

export type VoiceApiKeySource = 'voice' | 'ai' | 'none';

export interface ResolvedVoiceApiKey {
  provider: VoiceProvider;
  apiKey: string;
  source: VoiceApiKeySource;
  baseUrl?: string;
  model?: string;
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeVoiceProvider(value: unknown): VoiceProvider {
  if (value === 'groq') return 'groq';
  if (typeof value === 'string' && value.startsWith('profile:')) return 'openai';
  return 'openai';
}

export function isVoiceProfileProvider(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('profile:');
}

export function getVoiceProfileId(value: string): string {
  return value.slice('profile:'.length);
}

export function resolveVoiceApiKey(settings: VoiceKeySettings): ResolvedVoiceApiKey {
  const rawProvider = typeof settings.voiceProvider === 'string' ? settings.voiceProvider : 'openai';
  const baseUrl = trimmed(settings.voiceBaseUrl);
  const model = trimmed(settings.voiceModel);

  // Profile-backed voice provider reuses AI profile
  if (typeof rawProvider === 'string' && rawProvider.startsWith('profile:')) {
    const id = getVoiceProfileId(rawProvider);
    const profiles = Array.isArray(settings.aiProfiles) ? (settings.aiProfiles as Array<Record<string, unknown>>) : [];
    const p = profiles.find((x) => x.id === id) as { baseUrl?: string; apiKey?: string; model?: string } | undefined;
    if (p) {
      const own = trimmed(settings.voiceApiKey) || trimmed(p.apiKey);
      const r: ResolvedVoiceApiKey = { provider: 'openai', apiKey: own, source: 'voice' as const };
      if (p.baseUrl) r.baseUrl = p.baseUrl;
      if (p.model) r.model = p.model;
      return r;
    }
  }

  const provider = normalizeVoiceProvider(rawProvider);
  const own = trimmed(settings.voiceApiKey);
  if (own) {
    const r: ResolvedVoiceApiKey = { provider, apiKey: own, source: 'voice' };
    if (baseUrl) r.baseUrl = baseUrl;
    if (model) r.model = model;
    return r;
  }

  const shared = trimmed(settings.aiApiKey);
  const aiProvider = trimmed(settings.aiProvider) || 'openai';
  if (provider !== 'openai' || aiProvider !== 'openai' || !shared) {
    const r: ResolvedVoiceApiKey = { provider, apiKey: '', source: 'none' };
    if (baseUrl) r.baseUrl = baseUrl;
    if (model) r.model = model;
    return r;
  }

  const r: ResolvedVoiceApiKey = { provider, apiKey: shared, source: 'ai' };
  if (baseUrl) r.baseUrl = baseUrl;
  if (model) r.model = model;
  return r;
}

export function hasVoiceApiKey(settings: VoiceKeySettings): boolean {
  const r = resolveVoiceApiKey(settings);
  // keyless allowed for local/custom baseUrls
  if (!r.apiKey && r.baseUrl) {
    const lu = r.baseUrl.toLowerCase();
    if (lu.includes('localhost') || lu.includes('127.0.0.1') || lu.startsWith('http://')) return true;
  }
  return r.apiKey.length > 0;
}
