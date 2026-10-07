import type { ApiKeys } from '@mimik/core/capture/ai/keys';
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

export type ListVoices = (provider: VoiceoverProviderKey, apiKey: string) => Promise<VoiceoverVoice[]>;

export function useVoiceoverSettings(
  keys: ApiKeys,
  listVoices?: ListVoices,
  onChange?: (patch: Record<string, unknown>) => void,
) {
  const [provider, setProviderState] = useState<VoiceoverProviderKey>(DEFAULT_VOICEOVER_PROVIDER);
  const [voiceId, setVoiceIdState] = useState(VOICEOVER_PROVIDERS.openai.defaultVoice);
  const [modelId, setModelIdState] = useState(VOICEOVER_PROVIDERS.openai.defaultModel);
  const [voices, setVoices] = useState<VoiceoverVoice[]>(VOICEOVER_PROVIDERS.openai.voices);
  const apiKey = (keys[provider] ?? '').trim();

  useEffect(() => {
    localStorage.get(VOICEOVER_SETTINGS).then((stored) => {
      const config = resolveVoiceoverConfig(stored);
      setProviderState(config.provider);
      setVoiceIdState(config.voiceId);
      setModelIdState(config.modelId);
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
      setProviderState(next);
      setVoiceIdState(config.defaultVoice);
      setModelIdState(config.defaultModel);
      save({ voiceoverProvider: next, voiceoverVoiceId: config.defaultVoice, voiceoverModelId: config.defaultModel });
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

  return { provider, voiceId, modelId, voices, hasKey: apiKey.length > 0, setProvider, setVoiceId, setModelId };
}
