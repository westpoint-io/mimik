import { useKeyCheck as useSharedKeyCheck } from '@mimik/ui';
import { useCallback } from 'react';
import { sendMessage } from '@/lib/messaging';

export function useKeyCheck() {
  return useSharedKeyCheck(
    useCallback(
      (provider: string, apiKey: string, baseUrl?: string, model?: string) =>
        sendMessage('validateApiKey', { provider, apiKey, baseUrl, model }),
      [],
    ),
  );
}
