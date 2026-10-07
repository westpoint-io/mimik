import { type AIApiKeys, keyFor, migrateApiKeys, withKeyFor } from '@mimik/core/capture/ai/keys';
import {
  AI_PROVIDERS,
  type AIProviderKey,
  CUSTOM_MODEL_VALUE,
  DEFAULT_AI_PROVIDER,
  isCustomBaseUrl,
  isCustomModel,
  providerOrDefault,
} from '@mimik/core/capture/ai/models';
import type { AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { localStorage } from '@mimik/core/env';
import { useCallback, useEffect, useState } from 'react';

const AI_KEYS = ['aiProvider', 'aiModel', 'aiApiKey', 'aiApiKeys', 'aiBaseUrl', 'aiLanguage'] as const;

export interface AiSettingsState {
  provider: AIProviderKey;
  model: string;
  apiKey: string;
  baseUrl: string;
  language: AILanguageCode;
  ownServer: boolean;
  usingCustomModel: boolean;
  providerConfig: (typeof AI_PROVIDERS)[AIProviderKey];
  setProvider: (provider: AIProviderKey) => void;
  setModel: (model: string) => void;
  setApiKey: (apiKey: string) => void;
  setBaseUrl: (baseUrl: string) => void;
  setLanguage: (language: AILanguageCode) => void;
  toggleOwnServer: () => void;
}

interface Options {
  onDirty?: (patch: Record<string, unknown>) => void;
  reloadOnFocus?: boolean;
}

export function useAiSettings({ onDirty, reloadOnFocus = false }: Options = {}): AiSettingsState {
  const [provider, setProviderState] = useState<AIProviderKey>(DEFAULT_AI_PROVIDER);
  const [model, setModelState] = useState(AI_PROVIDERS[DEFAULT_AI_PROVIDER].defaultModel);
  const [apiKey, setApiKeyState] = useState('');
  const [apiKeys, setApiKeys] = useState<AIApiKeys>({});
  const [baseUrl, setBaseUrlState] = useState('');
  const [language, setLanguageState] = useState<AILanguageCode>('en');
  const [ownServer, setOwnServer] = useState(false);
  const [customModel, setCustomModel] = useState(false);

  useEffect(() => {
    const load = () =>
      localStorage.get(AI_KEYS).then((stored) => {
        const next = providerOrDefault(stored.aiProvider);
        const keys = migrateApiKeys(stored);
        setProviderState(next);
        setApiKeys(keys);
        setApiKeyState(keyFor(keys, next));
        if (typeof stored.aiModel === 'string') setModelState(stored.aiModel);
        if (isCustomBaseUrl(AI_PROVIDERS[next], stored.aiBaseUrl as string)) {
          setBaseUrlState(stored.aiBaseUrl as string);
          setOwnServer(true);
        }
        if (typeof stored.aiLanguage === 'string') setLanguageState(stored.aiLanguage as AILanguageCode);
      });

    void load();
    if (!reloadOnFocus) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reloadOnFocus]);

  const dirty = useCallback(
    (patch: Record<string, unknown>) => {
      void localStorage.set(patch as never);
      onDirty?.(patch);
    },
    [onDirty],
  );

  const setProvider = useCallback(
    (next: AIProviderKey) => {
      const nextModel = AI_PROVIDERS[next].defaultModel;
      const nextKey = keyFor(apiKeys, next);
      setProviderState(next);
      setModelState(nextModel);
      setApiKeyState(nextKey);
      setCustomModel(false);
      setOwnServer(false);
      setBaseUrlState('');
      dirty({ aiProvider: next, aiModel: nextModel, aiBaseUrl: '', aiApiKey: nextKey });
    },
    [apiKeys, dirty],
  );

  const setModel = useCallback(
    (next: string) => {
      if (next === CUSTOM_MODEL_VALUE) {
        setCustomModel(true);
        setModelState('');
        return;
      }
      setCustomModel(false);
      setModelState(next);
      dirty({ aiModel: next });
    },
    [dirty],
  );

  const setApiKey = useCallback(
    (next: string) => {
      const keys = withKeyFor(apiKeys, provider, next);
      setApiKeyState(next);
      setApiKeys(keys);
      dirty({ aiApiKey: next, aiApiKeys: keys });
    },
    [apiKeys, provider, dirty],
  );

  const setBaseUrl = useCallback(
    (next: string) => {
      setBaseUrlState(next);
      dirty({ aiBaseUrl: next });
    },
    [dirty],
  );

  const setLanguage = useCallback(
    (next: AILanguageCode) => {
      setLanguageState(next);
      dirty({ aiLanguage: next });
    },
    [dirty],
  );

  const toggleOwnServer = useCallback(() => {
    setOwnServer((on) => {
      if (on) {
        setBaseUrlState('');
        dirty({ aiBaseUrl: '' });
      }
      return !on;
    });
  }, [dirty]);

  const providerConfig = AI_PROVIDERS[provider] ?? AI_PROVIDERS[DEFAULT_AI_PROVIDER];

  return {
    provider,
    model,
    apiKey,
    baseUrl,
    language,
    ownServer,
    usingCustomModel: customModel || isCustomModel(model, providerConfig),
    providerConfig,
    setProvider,
    setModel,
    setApiKey,
    setBaseUrl,
    setLanguage,
    toggleOwnServer,
  };
}
