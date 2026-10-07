import { useCallback, useRef, useState } from 'react';
import type { KeyStatus, KeyWarning, ValidateKey } from '../types';

export function useKeyCheck(validate: ValidateKey) {
  const [status, setStatus] = useState<KeyStatus>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [warning, setWarning] = useState<KeyWarning | null>(null);
  const validated = useRef('');
  const requestId = useRef(0);

  const check = useCallback(
    async (provider: string, apiKey: string, baseUrl?: string, model?: string) => {
      const fingerprint = `${provider}:${apiKey}:${baseUrl ?? ''}:${model ?? ''}`;
      if (validated.current === fingerprint) {
        setStatus('valid');
        return;
      }
      const currentRequestId = ++requestId.current;
      setStatus('checking');
      setModels(null);
      setWarning(null);
      const result = await validate(provider, apiKey, baseUrl, model).catch(() => null);
      if (requestId.current !== currentRequestId) return;
      if (result?.valid) validated.current = fingerprint;
      setModels(result?.models?.length ? result.models : null);
      setWarning(result?.valid && result.warning ? result.warning : null);
      setStatus(
        result?.valid
          ? 'valid'
          : result?.reason === 'rejected'
            ? 'rejected'
            : result?.reason === 'model-required'
              ? 'model-required'
              : result?.reason === 'model-invalid'
                ? 'model-invalid'
                : 'unreachable',
      );
    },
    [validate],
  );

  const reset = useCallback(() => {
    requestId.current += 1;
    validated.current = '';
    setStatus(null);
    setModels(null);
    setWarning(null);
  }, []);

  return { status, models, warning, check, reset };
}
