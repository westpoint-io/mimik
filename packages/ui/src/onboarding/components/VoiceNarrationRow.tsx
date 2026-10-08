import { type AiChoice, KEY_PROVIDER_LABELS } from '@mimik/core/capture/ai/keys';
import type { VoiceProvider } from '@mimik/core/capture/voice/transcribe';
import { i18n, localStorage } from '@mimik/core/env';
import { Mic } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { ProviderKeyRow } from '../../ai/components/ProviderKeyRow';
import { type ProviderOption, ProviderSelect } from '../../ai/components/ProviderSelect';
import { useApiKeys } from '../../ai/hooks/use-api-keys';
import type { ValidateKey } from '../../ai/types';
import { Switch } from '../../common/components/Switch';
import { MicrophonePicker } from '../../voice/components/MicrophonePicker';

const VOICE_PROVIDERS: ProviderOption<VoiceProvider>[] = [
  { value: 'openai', label: KEY_PROVIDER_LABELS.openai, logo: 'openai', available: true },
  { value: 'groq', label: KEY_PROVIDER_LABELS.groq, logo: 'groq', available: true },
];

interface VoiceNarrationRowProps {
  aiProvider: AiChoice;
  validate: ValidateKey;
  requestMicrophoneAccess: () => Promise<void>;
  microphoneAccess?: ReactNode;
  microphoneLocked?: boolean;
}

export function VoiceNarrationRow({
  aiProvider,
  validate,
  requestMicrophoneAccess,
  microphoneAccess,
  microphoneLocked = false,
}: VoiceNarrationRowProps) {
  const keys = useApiKeys({ reloadOnFocus: true });
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<VoiceProvider>('openai');
  const [microphoneId, setMicrophoneId] = useState('');
  const sharesKey = aiProvider === 'openai';

  useEffect(() => {
    void localStorage.get(['voiceEnabled', 'voiceProvider', 'voiceMicrophoneId']).then((stored) => {
      setEnabled(stored.voiceEnabled === true);
      if (stored.voiceProvider === 'openai' || stored.voiceProvider === 'groq') setProvider(stored.voiceProvider);
      if (typeof stored.voiceMicrophoneId === 'string') setMicrophoneId(stored.voiceMicrophoneId);
    });
  }, []);

  const choose = (next: VoiceProvider) => {
    setProvider(next);
    void localStorage.set({ voiceProvider: next });
  };

  const toggle = (on: boolean) => {
    setEnabled(on);
    void localStorage.set({ voiceEnabled: on });
    if (on && sharesKey) choose('openai');
  };

  return (
    <div className="flex w-full flex-col gap-2.5 rounded-xl border border-lavender/60 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-secondary text-foreground">
          <Mic size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">{i18n.t('onboarding.voiceToggleTitle')}</p>
          <p className="text-[11.5px] leading-snug text-muted-foreground">{i18n.t('onboarding.voiceToggleHint')}</p>
        </div>
        <Switch checked={enabled} label={i18n.t('onboarding.voiceToggleTitle')} onChange={toggle} />
      </div>
      {enabled && (
        <>
          {!sharesKey && (
            <div className="flex flex-col gap-2">
              <p className="text-[11.5px] text-muted-foreground">{i18n.t('onboarding.voiceNeedsKey')}</p>
              <ProviderSelect
                value={provider}
                onChange={choose}
                options={VOICE_PROVIDERS}
                triggerClassName="h-10 w-full rounded-[9px] px-3 text-[12.5px]"
              />
              <ProviderKeyRow
                key={provider}
                bare
                provider={provider}
                value={keys.keys[provider] ?? ''}
                onChange={(next) => keys.setKey(provider, next)}
                validate={validate}
              />
            </div>
          )}
          {microphoneAccess}
          <MicrophonePicker
            live
            disabled={microphoneLocked}
            value={microphoneId}
            onChange={(id) => {
              setMicrophoneId(id);
              void localStorage.set({ voiceMicrophoneId: id });
            }}
            onRequestAccess={requestMicrophoneAccess}
            triggerClassName="h-10 px-3 text-[12.5px]"
          />
        </>
      )}
    </div>
  );
}
