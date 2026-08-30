import { AI_PROVIDERS, type AIProfile, getProfileId, isProfileProvider, profileProviderId } from './models';

export interface ResolvedAIConfig {
  providerSdk: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  baseUrl?: string;
  label: string;
  profileId?: string;
}

type StorageLike = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asProfiles(v: unknown): AIProfile[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (p): p is AIProfile =>
      p !== null &&
      typeof p === 'object' &&
      typeof (p as AIProfile).id === 'string' &&
      typeof (p as AIProfile).baseUrl === 'string' &&
      typeof (p as AIProfile).model === 'string',
  ) as AIProfile[];
}

export function resolveAIConfig(settings: StorageLike): ResolvedAIConfig | null {
  const rawProvider = asString(settings.aiProvider) || 'openai';
  const profiles = asProfiles(settings.aiProfiles);

  if (isProfileProvider(rawProvider)) {
    const id = getProfileId(rawProvider);
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return null;
    return {
      providerSdk: 'openai',
      model: profile.model.trim(),
      apiKey: profile.apiKey ?? '',
      baseUrl: profile.baseUrl.trim(),
      label: profile.name || profile.baseUrl,
      profileId: id,
    };
  }

  if (rawProvider === 'anthropic') {
    return {
      providerSdk: 'anthropic',
      model: asString(settings.aiModel) || AI_PROVIDERS.anthropic.defaultModel,
      apiKey: asString(settings.aiApiKey),
      label: AI_PROVIDERS.anthropic.label,
    };
  }

  // openai (with optional baseUrl override)
  const baseUrl = asString(settings.aiBaseUrl) || asString(settings.aiEndpoint);
  return {
    providerSdk: 'openai',
    model: asString(settings.aiModel) || AI_PROVIDERS.openai.defaultModel,
    apiKey: asString(settings.aiApiKey),
    baseUrl: baseUrl.trim() || undefined,
    label: AI_PROVIDERS.openai.label,
  };
}

export function hasAIKey(settings: StorageLike): boolean {
  const c = resolveAIConfig(settings);
  if (!c) return false;
  // keyless allowed for local/custom baseUrls; otherwise require key
  if (c.baseUrl && c.providerSdk === 'openai' && c.apiKey.trim() === '') {
    const lu = c.baseUrl.toLowerCase();
    if (lu.includes('localhost') || lu.includes('127.0.0.1') || lu.startsWith('http://')) return true;
  }
  return c.apiKey.trim().length > 0;
}

export function migrateLegacyToProfiles(settings: StorageLike): { aiProfiles: AIProfile[]; aiProvider: string } | null {
  const profiles = asProfiles(settings.aiProfiles);
  if (profiles.length > 0) return null;
  // Legacy single custom stored as aiProvider = 'openai-compatible' / 'custom' with aiBaseUrl
  const legacyProvider = asString(settings.aiProvider);
  const legacyBase = asString(settings.aiBaseUrl) || asString(settings.aiEndpoint);
  const legacyModel = asString(settings.aiModel);
  const legacyKey = asString(settings.aiApiKey);
  if ((legacyProvider === 'openai-compatible' || legacyProvider === 'custom') && legacyBase) {
    const id = Math.random().toString(36).slice(2, 10);
    const profile: AIProfile = {
      id,
      name: 'Custom',
      baseUrl: legacyBase,
      apiKey: legacyKey,
      model: legacyModel,
    };
    return { aiProfiles: [profile], aiProvider: profileProviderId(id) };
  }
  return null;
}
