import { useKeyCheck as useSharedKeyCheck } from '@mimik/ui/shared/key-status';
import { useCallback } from 'react';
import { sendMessage } from '@/lib/messaging';

export type { KeyStatus, KeyWarning } from '@mimik/ui/shared/key-status';
export { KeyStatusNote, KeyWarningNote, ModelList, SecretInput } from '@mimik/ui/shared/key-status';

export function useKeyCheck() {
  return useSharedKeyCheck(
    useCallback(
      (provider: string, apiKey: string, baseUrl?: string, model?: string) =>
        sendMessage('validateApiKey', { provider, apiKey, baseUrl, model }),
      [],
    ),
  );
}
