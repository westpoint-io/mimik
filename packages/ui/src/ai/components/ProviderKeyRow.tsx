import { KEY_PLACEHOLDERS, KEY_PROVIDER_LABELS, type KeyProvider } from '@mimik/core/capture/ai/keys';
import { i18n } from '@mimik/core/env';
import { useEffect } from 'react';
import { useKeyCheck } from '../hooks/use-key-check';
import type { ValidateKey } from '../types';
import { KeyStatusNote } from './KeyStatusNote';
import { KeyStatusPill } from './KeyStatusPill';
import { KeyWarningNote } from './KeyWarningNote';
import { ProviderLogo } from './ProviderLogo';
import { SecretInput } from './SecretInput';

interface ProviderKeyRowProps {
  provider: KeyProvider;
  value: string;
  onChange: (value: string) => void;
  validate: ValidateKey;
  bare?: boolean;
}

export function ProviderKeyRow({ provider, value, onChange, validate, bare = false }: ProviderKeyRowProps) {
  const keyCheck = useKeyCheck(validate);
  const { check, reset } = keyCheck;

  useEffect(() => {
    if (value.trim()) void check(provider, value.trim());
  }, []);

  return (
    <div className={bare ? '' : 'py-2.5'}>
      <div className="flex items-center gap-3">
        {!bare && (
          <>
            <span className="w-7 h-7 rounded-lg bg-secondary text-foreground flex items-center justify-center shrink-0">
              <ProviderLogo provider={provider} />
            </span>
            <span className="w-28 shrink-0 text-[13px] font-semibold text-foreground">
              {KEY_PROVIDER_LABELS[provider]}
            </span>
          </>
        )}
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
          status={<KeyStatusPill status={keyCheck.status} />}
          aria-label={bare ? i18n.t('settings.apiKey') : undefined}
          className={bare ? 'h-11 rounded-xl pl-4 text-sm border-border' : 'h-8 text-[13px] rounded-lg border-border'}
        />
      </div>
      <div className={bare ? '' : 'pl-10'}>
        <KeyStatusNote status={keyCheck.status} />
      </div>
      <div className={bare ? '' : 'pl-10'}>
        <KeyWarningNote warning={keyCheck.warning} />
      </div>
    </div>
  );
}
