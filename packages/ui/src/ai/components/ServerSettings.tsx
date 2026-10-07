import type { AiServer } from '@mimik/core/capture/ai/keys';
import { i18n } from '@mimik/core/env';
import { Server } from 'lucide-react';
import { useEffect } from 'react';
import { Segmented } from '../../common/components/Segmented';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Input } from '../../components/ui/input';
import { useKeyCheck } from '../hooks/use-key-check';
import type { ValidateKey } from '../types';
import { KeyStatusIcon } from './KeyStatusIcon';
import { KeyStatusNote } from './KeyStatusNote';
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
            <span className="w-24 shrink-0 text-[13px] font-semibold text-foreground">
              {i18n.t('settings.baseUrl')}
            </span>
            <Input
              value={server.url}
              onChange={(e) => change({ url: e.target.value })}
              onBlur={() => probe(server)}
              placeholder="http://localhost:11434/v1"
              className="h-8 flex-1 text-[13px] rounded-lg border-border font-mono"
            />
            <span className="w-4 shrink-0 flex justify-center">
              <KeyStatusIcon status={keyCheck.status} />
            </span>
          </label>
          {keyCheck.status !== 'valid' && keyCheck.status !== 'checking' && (
            <div className="pl-[108px]">
              <KeyStatusNote status={keyCheck.status} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <span className="w-24 shrink-0 text-[13px] font-semibold text-foreground">{i18n.t('settings.apiKey')}</span>
          <SecretInput
            value={server.apiKey}
            onChange={(apiKey) => change({ apiKey })}
            onBlur={() => probe(server)}
            placeholder={i18n.t('settings.optional')}
            className="h-8 text-[13px] rounded-lg border-border"
          />
          <span className="w-4 shrink-0" />
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <span className="w-24 shrink-0 text-[13px] font-semibold text-foreground">
            {i18n.t('settings.serverSpeaks')}
          </span>
          <Segmented
            label={i18n.t('settings.serverSpeaks')}
            value={server.protocol}
            options={[
              { value: 'openai' as const, label: i18n.t('settings.protocolOpenai') },
              { value: 'anthropic' as const, label: i18n.t('settings.protocolAnthropic') },
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
