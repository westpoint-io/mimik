import { localStorage } from '@mimik/core/env';
import { resolveVoiceoverConfig, VOICEOVER_SETTINGS } from '@mimik/core/export/voiceover/config';
import {
  DEFAULT_VOICEOVER_PROVIDER,
  VOICEOVER_PROVIDERS,
  type VoiceoverProviderKey,
  type VoiceoverVoice,
  voiceoverProvider,
} from '@mimik/core/export/voiceover/providers';
import { useCallback, useEffect, useState } from 'react';
import type { ApiKeysState } from '../../ai/hooks/use-api-keys';

export type ListVoices = (provider: VoiceoverProviderKey, apiKey: string) => Promise<VoiceoverVoice[]>;

function storedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function useVoiceoverSettings(
  keys: ApiKeysState,
  listVoices?: ListVoices,
  onChange?: (patch: Record<string, unknown>) => void,
) {
  const [provider, setProviderState] = useState<VoiceoverProviderKey>(DEFAULT_VOICEOVER_PROVIDER);
  const [voiceId, setVoiceIdState] = useState(VOICEOVER_PROVIDERS.openai.defaultVoice);
  const [modelId, setModelIdState] = useState(VOICEOVER_PROVIDERS.openai.defaultModel);
  const [voices, setVoices] = useState<VoiceoverVoice[]>(VOICEOVER_PROVIDERS.openai.voices);
  const onServer = provider === 'server';
  const apiKey = (onServer ? keys.server.apiKey : (keys.keys[provider] ?? '')).trim();
  const serverReady = Boolean(keys.server.url.trim()) && keys.server.protocol === 'openai';

  useEffect(() => {
    localStorage.get(VOICEOVER_SETTINGS).then((stored) => {
      const config = resolveVoiceoverConfig(stored);
      setProviderState(config.provider);
      const custom = config.provider === 'server';
      setVoiceIdState(custom ? storedText(stored.voiceoverVoiceId) : config.voiceId);
      setModelIdState(custom ? storedText(stored.voiceoverModelId) : config.modelId);
    });
  }, []);

  useEffect(() => {
    const config = voiceoverProvider(provider);
    setVoices(config.voices);
    if (!config.catalog || !apiKey || !listVoices) return;
    let active = true;
    const timer = window.setTimeout(() => {
      listVoices(provider, apiKey)
        .then((found) => {
          if (active && found.length > 0) setVoices(found);
        })
        .catch(() => undefined);
    }, 600);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [provider, apiKey, listVoices]);

  const save = useCallback(
    (patch: Record<string, unknown>) => {
      void localStorage.set(patch);
      onChange?.(patch);
    },
    [onChange],
  );

  const setProvider = useCallback(
    (next: VoiceoverProviderKey) => {
      const config = voiceoverProvider(next);
      const voice = next === 'server' ? '' : config.defaultVoice;
      const model = next === 'server' ? '' : config.defaultModel;
      setProviderState(next);
      setVoiceIdState(voice);
      setModelIdState(model);
      save({ voiceoverProvider: next, voiceoverVoiceId: voice, voiceoverModelId: model });
    },
    [save],
  );

  const setVoiceId = useCallback(
    (next: string) => {
      setVoiceIdState(next);
      save({ voiceoverVoiceId: next });
    },
    [save],
  );

  const setModelId = useCallback(
    (next: string) => {
      setModelIdState(next);
      save({ voiceoverModelId: next });
    },
    [save],
  );

  return {
    provider,
    voiceId,
    modelId,
    voices,
    serverReady,
    hasKey: onServer ? serverReady : apiKey.length > 0,
    setProvider,
    setVoiceId,
    setModelId,
  };
}
