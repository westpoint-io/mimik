import { type AiServer, requestHeaders, type ServerHeader } from '@mimik/core/capture/ai/keys';
import { i18n } from '@mimik/core/env';
import { Plus, Server, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Segmented } from '../../common/components/Segmented';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Button } from '../../components/ui/button';
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
    if (next.url.trim())
      void check(next.protocol, next.apiKey.trim(), next.url.trim(), undefined, requestHeaders(next.headers));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: checks the saved key once, when the screen opens
  useEffect(() => {
    probe(server);
  }, []);

  const change = (patch: Partial<AiServer>) => {
    reset();
    onChange(patch);
  };

  const setHeader = (index: number, patch: Partial<ServerHeader>) =>
    change({ headers: server.headers.map((header, i) => (i === index ? { ...header, ...patch } : header)) });

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
        <div className="flex items-start gap-3 py-2.5">
          <span className="w-[152px] shrink-0 pt-1.5 text-[13px] font-semibold text-foreground">
            {i18n.t('settings.serverHeaders')}
          </span>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            {server.headers.map((header, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity besides their position
              <div key={index} className="flex w-full items-center gap-2">
                <Input
                  value={header.name}
                  onChange={(e) => setHeader(index, { name: e.target.value })}
                  onBlur={() => probe(server)}
                  placeholder={i18n.t('settings.headerName')}
                  aria-label={i18n.t('settings.headerName')}
                  className="h-8 w-36 shrink-0 text-[13px] rounded-lg border-border"
                />
                <SecretInput
                  value={header.value}
                  onChange={(value) => setHeader(index, { value })}
                  onBlur={() => probe(server)}
                  placeholder={i18n.t('settings.headerValue')}
                  className="h-8 text-[13px] rounded-lg border-border"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    const headers = server.headers.filter((_, i) => i !== index);
                    change({ headers });
                    probe({ ...server, headers });
                  }}
                  aria-label={i18n.t('settings.removeHeader')}
                  title={i18n.t('settings.removeHeader')}
                  className="text-muted-foreground"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => change({ headers: [...server.headers, { name: '', value: '' }] })}
              className="text-[12px] font-semibold text-muted-foreground"
            >
              <Plus />
              {i18n.t('settings.addHeader')}
            </Button>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
