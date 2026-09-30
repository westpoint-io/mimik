import type { AiServer } from '@mimik/core/capture/ai/keys';
import { i18n } from '@mimik/core/env';
import { Server } from 'lucide-react';
import { useEffect } from 'react';
import { Segmented } from '../../common/components/Segmented';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Input } from '../../components/ui/input';
import { useKeyCheck } from '../hooks/use-key-check';
import type { ValidateKey } from '../types';
import { KeyStatusNote } from './KeyStatusNote';
import { KeyStatusPill } from './KeyStatusPill';
import { ProviderLogo } from './ProviderLogo';
import { SecretInput } from './SecretInput';

interface ServerSettingsProps {
  server: AiServer;
  onChange: (patch: Partial<AiServer>) => void;
  validate: ValidateKey;
}

export function ServerSettings({ server, onChange, validate }: ServerSettingsProps) {
  const keyCheck = useKeyCheck(validate);
  const { check, reset } = keyCheck;
  const probe = (next: AiServer) => {
    if (next.url.trim()) void check(next.protocol, next.apiKey.trim(), next.url.trim());
  };

  useEffect(() => {
    probe(server);
  }, []);

  const change = (patch: Partial<AiServer>) => {
    reset();
    onChange(patch);
  };

  return (
    <SettingsCard
      icon={Server}
      title={i18n.t('settings.ownServer')}
      hint={i18n.t(
        server.protocol === 'anthropic' ? 'settings.ownServerHintAnthropic' : 'settings.ownServerHintOpenai',
      )}
      className="pb-1"
    >
      <div className="-mt-1 divide-y divide-secondary">
        <div className="py-2.5">
          <label className="flex items-center gap-3">
            <span className="w-[152px] shrink-0 text-[13px] font-semibold text-foreground">
              {i18n.t('settings.baseUrl')}
            </span>
            <span className="relative flex min-w-0 flex-1">
              <Input
                value={server.url}
                onChange={(e) => change({ url: e.target.value })}
                onBlur={() => probe(server)}
                placeholder="http://localhost:11434/v1"
                className={`h-8 flex-1 text-[13px] rounded-lg border-border ${keyCheck.status ? 'pr-32' : ''}`}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2">
                <KeyStatusPill status={keyCheck.status} />
              </span>
            </span>
          </label>
          <div className="pl-[164px]">
            <KeyStatusNote status={keyCheck.status} />
          </div>
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <span className="w-[152px] shrink-0 text-[13px] font-semibold text-foreground">
            {i18n.t('settings.apiKey')}
          </span>
          <SecretInput
            value={server.apiKey}
            onChange={(apiKey) => change({ apiKey })}
            onBlur={() => probe(server)}
            placeholder={i18n.t('settings.optional')}
            className="h-8 text-[13px] rounded-lg border-border"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 py-2.5">
          <span className="w-[152px] shrink-0 text-[13px] font-semibold text-foreground">
            {i18n.t('settings.serverSpeaks')}
          </span>
          <Segmented
            label={i18n.t('settings.serverSpeaks')}
            value={server.protocol}
            options={[
              {
                value: 'openai' as const,
                label: i18n.t('settings.protocolOpenai'),
                logo: <ProviderLogo provider="openai" />,
              },
              {
                value: 'anthropic' as const,
                label: i18n.t('settings.protocolAnthropic'),
                logo: <ProviderLogo provider="anthropic" />,
              },
            ]}
            onChange={(protocol) => {
              change({ protocol });
              probe({ ...server, protocol });
            }}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
