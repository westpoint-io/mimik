import { KEY_PROVIDER_LABELS } from '@mimik/core/capture/ai/keys';
import { normalizeVoiceProvider } from '@mimik/core/capture/voice/api-key';
import type { VoiceProvider } from '@mimik/core/capture/voice/transcribe';
import { i18n, localStorage } from '@mimik/core/env';
import { Mic } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { MissingKeyNote } from '../../ai/components/MissingKeyNote';
import { ProviderSelect } from '../../ai/components/ProviderSelect';
import type { ApiKeysState } from '../../ai/hooks/use-api-keys';
import { SettingsCard } from '../../common/components/SettingsCard';
import { MicrophonePicker } from './MicrophonePicker';

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

  useEffect(() => {
    localStorage.get(['voiceProvider', 'voiceMicrophoneId']).then((stored) => {
      setProvider(normalizeVoiceProvider(stored.voiceProvider));
      setMicrophoneId(stored.voiceMicrophoneId ?? '');
    });
  }, []);

  const save = (patch: { voiceProvider?: VoiceProvider; voiceMicrophoneId?: string }) => {
    void localStorage.set(patch);
    onChange?.(patch);
  };

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
          options={(['openai', 'groq'] as const).map((key) => ({
            value: key,
            label: KEY_PROVIDER_LABELS[key],
            logo: key,
            available: Boolean(keys.keys[key]),
          }))}
        />
        {!keys.keys[provider] && (
          <MissingKeyNote text={i18n.t('settings.noKeyFor', [KEY_PROVIDER_LABELS[provider]])} onOpenKeys={onOpenKeys} />
        )}
      </div>

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
