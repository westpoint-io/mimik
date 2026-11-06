import { type AiChoice, type AiServer, KEY_PROVIDER_LABELS, SERVER } from '@mimik/core/capture/ai/keys';
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
import { TranscriptionModelField } from '../../voice/components/TranscriptionModelField';

type KeyedVoiceProvider = Exclude<VoiceProvider, 'server'>;

const VOICE_PROVIDERS: ProviderOption<KeyedVoiceProvider>[] = [
  { value: 'openai', label: KEY_PROVIDER_LABELS.openai, logo: 'openai', available: true },
  { value: 'groq', label: KEY_PROVIDER_LABELS.groq, logo: 'groq', available: true },
];

interface VoiceNarrationRowProps {
  aiProvider: AiChoice;
  server: AiServer;
  validate: ValidateKey;
  requestMicrophoneAccess: () => Promise<void>;
  microphoneAccess?: ReactNode;
  microphoneLocked?: boolean;
}

export function VoiceNarrationRow({
  aiProvider,
  server,
  validate,
  requestMicrophoneAccess,
  microphoneAccess,
  microphoneLocked = false,
}: VoiceNarrationRowProps) {
  const keys = useApiKeys({ reloadOnFocus: true });
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<VoiceProvider>('openai');
  const [microphoneId, setMicrophoneId] = useState('');
  const [serverModel, setServerModel] = useState('');
  const sharesKey = aiProvider === 'openai';
  const sharesServer = aiProvider === SERVER && server.protocol === 'openai' && Boolean(server.url.trim());
  const keyedProvider: KeyedVoiceProvider = provider === SERVER ? 'openai' : provider;

  useEffect(() => {
    void localStorage.get(['voiceEnabled', 'voiceProvider', 'voiceMicrophoneId', 'voiceServerModel']).then((stored) => {
      setEnabled(stored.voiceEnabled === true);
      if (stored.voiceProvider === 'openai' || stored.voiceProvider === 'groq' || stored.voiceProvider === SERVER) {
        setProvider(stored.voiceProvider);
      }
      if (typeof stored.voiceMicrophoneId === 'string') setMicrophoneId(stored.voiceMicrophoneId);
      if (typeof stored.voiceServerModel === 'string') setServerModel(stored.voiceServerModel);
    });
  }, []);

  const choose = (next: VoiceProvider) => {
    setProvider(next);
    void localStorage.set({ voiceProvider: next });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the AI choice only while narration is on
  useEffect(() => {
    if (!enabled) return;
    if (sharesServer && provider !== SERVER) choose(SERVER);
    else if (!sharesServer && provider === SERVER) choose('openai');
  }, [enabled, sharesServer]);

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
          {sharesServer && (
            <TranscriptionModelField
              value={serverModel}
              onChange={(next) => {
                setServerModel(next);
                void localStorage.set({ voiceServerModel: next });
              }}
              inputClassName="h-10 rounded-[9px] px-3 text-[12.5px]"
            />
          )}
          {!sharesKey && !sharesServer && (
            <div className="flex flex-col gap-2">
              <p className="text-[11.5px] text-muted-foreground">{i18n.t('onboarding.voiceNeedsKey')}</p>
              <ProviderSelect
                value={keyedProvider}
                onChange={choose}
                options={VOICE_PROVIDERS}
                triggerClassName="h-10 w-full rounded-[9px] px-3 text-[12.5px]"
              />
              <ProviderKeyRow
                key={keyedProvider}
                bare
                provider={keyedProvider}
                value={keys.keys[keyedProvider] ?? ''}
                onChange={(next) => keys.setKey(keyedProvider, next)}
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
