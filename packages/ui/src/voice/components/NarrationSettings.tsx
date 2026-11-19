import { KEY_PROVIDER_LABELS, SERVER } from '@mimik/core/capture/ai/keys';
import { normalizeVoiceProvider } from '@mimik/core/capture/voice/api-key';
import type { VoiceProvider } from '@mimik/core/capture/voice/transcribe';
import { i18n, localStorage } from '@mimik/core/env';
import { Mic } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { MissingKeyNote } from '../../ai/components/MissingKeyNote';
import { type ProviderOption, ProviderSelect } from '../../ai/components/ProviderSelect';
import type { ApiKeysState } from '../../ai/hooks/use-api-keys';
import { SettingsCard } from '../../common/components/SettingsCard';
import { MicrophonePicker } from './MicrophonePicker';
import { TranscriptionModelField } from './TranscriptionModelField';

interface NarrationSettingsProps {
  keys: ApiKeysState;
  onOpenKeys?: () => void;
  onChange?: (patch: Record<string, unknown>) => void;
  onRequestAccess?: () => Promise<void>;
  access?: ReactNode;
  microphoneLocked?: boolean;
  liveMeter?: boolean;
}

export function NarrationSettings({
  keys,
  onOpenKeys,
  onChange,
  onRequestAccess,
  access,
  microphoneLocked = false,
  liveMeter = false,
}: NarrationSettingsProps) {
  const [provider, setProvider] = useState<VoiceProvider>('openai');
  const [microphoneId, setMicrophoneId] = useState('');
  const [serverModel, setServerModel] = useState('');
  const serverSpeaksOpenai = keys.server.protocol === 'openai';
  const serverReady = Boolean(keys.server.url.trim()) && serverSpeaksOpenai;

  useEffect(() => {
    localStorage.get(['voiceProvider', 'voiceMicrophoneId', 'voiceServerModel']).then((stored) => {
      setProvider(normalizeVoiceProvider(stored.voiceProvider));
      setMicrophoneId(stored.voiceMicrophoneId ?? '');
      setServerModel(stored.voiceServerModel ?? '');
    });
  }, []);

  const save = (patch: { voiceProvider?: VoiceProvider; voiceMicrophoneId?: string; voiceServerModel?: string }) => {
    void localStorage.set(patch);
    onChange?.(patch);
  };

  const options: ProviderOption<VoiceProvider>[] = [
    ...(['openai', 'groq'] as const).map((key) => ({
      value: key,
      label: KEY_PROVIDER_LABELS[key],
      logo: key,
      available: Boolean(keys.keys[key]),
    })),
    { value: SERVER, label: i18n.t('settings.ownServer'), logo: SERVER, available: serverReady },
  ];

  const missing =
    provider === SERVER
      ? !serverReady && i18n.t(serverSpeaksOpenai ? 'settings.noServer' : 'settings.voiceServerNeedsOpenai')
      : !keys.keys[provider] && i18n.t('settings.noKeyFor', [KEY_PROVIDER_LABELS[provider]]);

  return (
    <SettingsCard icon={Mic} title={i18n.t('settings.voiceNarration')} hint={i18n.t('settings.voiceNarrationHint')}>
      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.provider')}</label>
        <ProviderSelect
          value={provider}
          onChange={(next) => {
            setProvider(next);
            save({ voiceProvider: next });
          }}
          onOpenKeys={onOpenKeys}
          options={options}
        />
        {missing && <MissingKeyNote text={missing} onOpenKeys={onOpenKeys} />}
      </div>

      {provider === SERVER && (
        <TranscriptionModelField
          value={serverModel}
          onChange={(next) => {
            setServerModel(next);
            save({ voiceServerModel: next });
          }}
          inputClassName="h-8 text-[13px] rounded-lg border-border"
        />
      )}

      {access}

      {onRequestAccess && (
        <MicrophonePicker
          live={liveMeter}
          disabled={microphoneLocked}
          value={microphoneId}
          onChange={(next) => {
            setMicrophoneId(next);
            save({ voiceMicrophoneId: next });
          }}
          onRequestAccess={onRequestAccess}
          triggerClassName="h-8"
        />
      )}
    </SettingsCard>
  );
}
