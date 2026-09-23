import { updateGuideDescription } from '@mimik/core/guides/service';
import { useCallback, useState } from 'react';
import { send } from '../../env';
import { guideDescriptionErrorMessage } from '../lib/guide-description-error';

export interface GuideDescription {
  text: string;
  set: (next: string) => void;
  generating: boolean;
  error: string | null;
  hasApiKey: boolean;
  setHasApiKey: (has: boolean) => void;
  clearError: () => void;
  commit: (next: string) => void;
  generate: () => Promise<void>;
}

export function useGuideDescription(guideId: string, onWritten: (next: string) => void): GuideDescription {
  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  const commit = useCallback(
    (next: string) => {
      setText(next);
      void updateGuideDescription(guideId, next);
      onWritten(next);
    },
    [guideId, onWritten],
  );

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await send('generateGuideDescription', { guideId });
      if (result.error) {
        setError(guideDescriptionErrorMessage(result.error));
        return;
      }
      if (!result.description) return;
      setText(result.description);
      onWritten(result.description);
    } catch {
      setError(guideDescriptionErrorMessage('generation-failed'));
    } finally {
      setGenerating(false);
    }
  }, [guideId, onWritten]);

  return {
    text,
    set: setText,
    generating,
    error,
    clearError: () => setError(null),
    hasApiKey,
    setHasApiKey,
    commit,
    generate,
  };
}
