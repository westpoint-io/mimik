import { KEY_PROVIDERS } from '@mimik/core/capture/ai/keys';
import { KeyRound } from 'lucide-react';
import { SettingsCard } from '../../common/components/SettingsCard';
import type { ApiKeysState } from '../hooks/use-api-keys';
import type { ValidateKey } from '../types';
import { ProviderKeyRow } from './ProviderKeyRow';
import { ServerSettings } from './ServerSettings';

interface ApiKeysSettingsProps {
  state: ApiKeysState;
  validate: ValidateKey;
  title?: string;
}

export function ApiKeysSettings({ state, validate, title }: ApiKeysSettingsProps) {
  if (!state.loaded) return null;
  return (
    <>
      <SettingsCard icon={KeyRound} title={title} className={title ? 'pb-1' : 'py-1'}>
        <div className="divide-y divide-secondary">
          {KEY_PROVIDERS.map((provider) => (
            <ProviderKeyRow
              key={provider}
              provider={provider}
              value={state.keys[provider] ?? ''}
              onChange={(value) => state.setKey(provider, value)}
              validate={validate}
            />
          ))}
        </div>
      </SettingsCard>
      <ServerSettings server={state.server} onChange={state.setServer} validate={validate} />
    </>
  );
}
