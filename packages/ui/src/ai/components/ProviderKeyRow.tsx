import { KEY_PLACEHOLDERS, KEY_PROVIDER_LABELS, type KeyProvider } from '@mimik/core/capture/ai/keys';
import { useEffect } from 'react';
import { useKeyCheck } from '../hooks/use-key-check';
import type { ValidateKey } from '../types';
import { KeyStatusIcon } from './KeyStatusIcon';
import { KeyStatusNote } from './KeyStatusNote';
import { KeyWarningNote } from './KeyWarningNote';
import { ProviderLogo } from './ProviderLogo';
import { SecretInput } from './SecretInput';

interface ProviderKeyRowProps {
  provider: KeyProvider;
  value: string;
  onChange: (value: string) => void;
  validate: ValidateKey;
}

export function ProviderKeyRow({ provider, value, onChange, validate }: ProviderKeyRowProps) {
  const keyCheck = useKeyCheck(validate);
  const { check, reset } = keyCheck;

  useEffect(() => {
    if (value.trim()) void check(provider, value.trim());
  }, []);

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 rounded-lg bg-secondary text-foreground flex items-center justify-center shrink-0">
          <ProviderLogo provider={provider} />
        </span>
        <span className="w-24 shrink-0 text-[13px] font-semibold text-foreground">{KEY_PROVIDER_LABELS[provider]}</span>
        <SecretInput
          value={value}
          onChange={(next) => {
            reset();
            onChange(next);
          }}
          onBlur={() => {
            if (value.trim()) void check(provider, value.trim());
          }}
          placeholder={KEY_PLACEHOLDERS[provider]}
          className="h-8 text-[13px] rounded-lg border-border"
        />
        <span className="w-4 shrink-0 flex justify-center">
          <KeyStatusIcon status={keyCheck.status} />
        </span>
      </div>
      {keyCheck.status !== 'valid' && keyCheck.status !== 'checking' && (
        <div className="pl-10">
          <KeyStatusNote status={keyCheck.status} />
        </div>
      )}
      <div className="pl-10">
        <KeyWarningNote warning={keyCheck.warning} />
      </div>
    </div>
  );
}
