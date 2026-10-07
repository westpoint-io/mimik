import { type AiChoice, aiChoice, SERVER } from '@mimik/core/capture/ai/keys';
import {
  AI_PROVIDERS,
  type AIModelOption,
  CUSTOM_MODEL_VALUE,
  DEFAULT_AI_PROVIDER,
  isCustomModel,
} from '@mimik/core/capture/ai/models';
import type { AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { localStorage } from '@mimik/core/env';
import { useCallback, useEffect, useState } from 'react';

const AI_KEYS = [
  'aiProvider',
  'aiModel',
  'aiBaseUrl',
  'aiServerUrl',
  'aiLanguage',
  'aiForSteps',
  'aiForGuide',
] as const;

export interface AiSettingsState {
  provider: AiChoice;
  model: string;
  language: AILanguageCode;
  forSteps: boolean;
  forGuide: boolean;
  usingCustomModel: boolean;
  models: AIModelOption[];
  defaultModel: string;
  setProvider: (provider: AiChoice) => void;
  setModel: (model: string) => void;
  setLanguage: (language: AILanguageCode) => void;
  setForSteps: (on: boolean) => void;
  setForGuide: (on: boolean) => void;
}

interface Options {
  onDirty?: (patch: Record<string, unknown>) => void;
  reloadOnFocus?: boolean;
}

function defaultModelFor(provider: AiChoice): string {
  return provider === SERVER ? '' : AI_PROVIDERS[provider].defaultModel;
}

export function useAiSettings({ onDirty, reloadOnFocus = false }: Options = {}): AiSettingsState {
  const [provider, setProviderState] = useState<AiChoice>(DEFAULT_AI_PROVIDER);
  const [model, setModelState] = useState(AI_PROVIDERS[DEFAULT_AI_PROVIDER].defaultModel);
  const [language, setLanguageState] = useState<AILanguageCode>('en');
  const [customModel, setCustomModel] = useState(false);
  const [forSteps, setForStepsState] = useState(true);
  const [forGuide, setForGuideState] = useState(true);

  useEffect(() => {
    const load = () =>
      localStorage.get(AI_KEYS).then((stored) => {
        const next = aiChoice(stored);
        setProviderState(next);
        setModelState(typeof stored.aiModel === 'string' ? stored.aiModel : defaultModelFor(next));
        if (typeof stored.aiLanguage === 'string') setLanguageState(stored.aiLanguage as AILanguageCode);
        setForStepsState(stored.aiForSteps !== false);
        setForGuideState(stored.aiForGuide !== false);
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
    (next: AiChoice) => {
      const nextModel = defaultModelFor(next);
      setProviderState(next);
      setModelState(nextModel);
      setCustomModel(false);
      dirty({ aiProvider: next, aiModel: nextModel, aiBaseUrl: '' });
    },
    [dirty],
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

  const setLanguage = useCallback(
    (next: AILanguageCode) => {
      setLanguageState(next);
      dirty({ aiLanguage: next });
    },
    [dirty],
  );

  const setForSteps = useCallback(
    (on: boolean) => {
      setForStepsState(on);
      dirty({ aiForSteps: on });
    },
    [dirty],
  );

  const setForGuide = useCallback(
    (on: boolean) => {
      setForGuideState(on);
      dirty({ aiForGuide: on });
    },
    [dirty],
  );

  const config = provider === SERVER ? null : AI_PROVIDERS[provider];

  return {
    provider,
    model,
    language,
    forSteps,
    forGuide,
    usingCustomModel: config === null || customModel || isCustomModel(model, config),
    models: config?.models ?? [],
    defaultModel: config?.defaultModel ?? '',
    setProvider,
    setModel,
    setLanguage,
    setForSteps,
    setForGuide,
  };
}
