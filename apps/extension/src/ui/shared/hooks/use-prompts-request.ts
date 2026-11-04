import type { PromptSection } from '@mimik/core/capture/ai/custom-prompts';
import { useCallback, useEffect, useState } from 'react';
import { browser } from '#imports';
import { PROMPTS_REQUEST_KEY } from '@/ui/shared/lib/open-prompts-editor';

export function usePromptsRequest(enabled: boolean) {
  const [section, setSection] = useState<PromptSection | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const take = (value: unknown) => {
      if (value !== 'steps' && value !== 'guide') return;
      setSection(value);
      void browser.storage.local.remove(PROMPTS_REQUEST_KEY);
    };
    const onChanged = (changes: Record<string, { newValue?: unknown }>) => take(changes[PROMPTS_REQUEST_KEY]?.newValue);
    void browser.storage.local.get(PROMPTS_REQUEST_KEY).then((stored) => take(stored[PROMPTS_REQUEST_KEY]));
    browser.storage.local.onChanged.addListener(onChanged);
    return () => browser.storage.local.onChanged.removeListener(onChanged);
  }, [enabled]);

  const clear = useCallback(() => setSection(null), []);

  return { section, clear };
}
