import type { VoiceProvider } from '@mimik/core/capture/voice/transcribe';
import { client, i18n, localStorage } from '@mimik/core/env';
import { Mic, MousePointerClick, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProviderKeyRow } from '../../ai/components/ProviderKeyRow';
import { type ProviderOption, ProviderSelect } from '../../ai/components/ProviderSelect';
import { useApiKeys } from '../../ai/hooks/use-api-keys';
import { MicrophonePicker } from '../../voice/components/MicrophonePicker';
import type { StepProps } from '../types';
import { ProgressDots } from './ProgressDots';

const VOICE_PROVIDERS: ProviderOption<VoiceProvider>[] = [
  { value: 'openai', label: 'OpenAI', logo: 'openai', available: true },
  { value: 'groq', label: 'Groq', logo: 'groq', available: true },
];

export function VoiceStep({ onNext, onSkip, onBack, index, total, validate, requestMicrophoneAccess }: StepProps) {
  const [provider, setProvider] = useState<VoiceProvider>('openai');
  const [microphoneId, setMicrophoneId] = useState('');
  const keys = useApiKeys({ reloadOnFocus: true });
  const apiKey = keys.keys[provider] ?? '';

  useEffect(() => {
    const load = () =>
      localStorage.get(['voiceProvider', 'voiceMicrophoneId']).then((stored) => {
        if (stored.voiceProvider === 'openai' || stored.voiceProvider === 'groq') setProvider(stored.voiceProvider);
        if (typeof stored.voiceMicrophoneId === 'string') setMicrophoneId(stored.voiceMicrophoneId);
      });

    void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const handleMicrophoneChange = (deviceId: string) => {
    setMicrophoneId(deviceId);
    void localStorage.set({ voiceMicrophoneId: deviceId });
  };

  const handleProviderChange = (nextProvider: VoiceProvider) => {
    setProvider(nextProvider);
    void localStorage.set({ voiceProvider: nextProvider });
  };

  const handleApiKeyChange = (nextKey: string) => keys.setKey(provider, nextKey);

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center overflow-y-auto" style={{ padding: '64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.stepOf', [String(index), String(total)])}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {i18n.t('onboarding.voiceTitle')}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{i18n.t('onboarding.voiceMessage')}</p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {i18n.t('settings.provider')}
              </label>
              <ProviderSelect
                value={provider}
                onChange={handleProviderChange}
                options={VOICE_PROVIDERS}
                triggerClassName="w-full h-11 rounded-xl px-4 text-sm focus:border-accent focus:ring-accent/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{i18n.t('settings.apiKey')}</label>
              <ProviderKeyRow
                key={provider}
                bare
                provider={provider}
                value={apiKey}
                onChange={handleApiKeyChange}
                validate={validate}
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">{i18n.t('onboarding.keySaved')}</p>
            </div>

            <MicrophonePicker
              value={microphoneId}
              onChange={handleMicrophoneChange}
              onRequestAccess={requestMicrophoneAccess}
              triggerClassName="h-11 px-4 text-sm"
            />

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-secondary text-[11px] text-muted-foreground leading-relaxed">
              <Mic size={12} className="shrink-0 mt-0.5 text-accent" />
              <span>
                {i18n.t(client() === 'desktop' ? 'onboarding.voiceRecordHintDesktop' : 'onboarding.voiceRecordHint')}
              </span>
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-secondary text-[11px] text-muted-foreground leading-relaxed">
              <Shield size={12} className="shrink-0 mt-0.5 text-accent" />
              <span>{i18n.t('onboarding.voiceDataNotice')}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-8 py-3 bg-card text-foreground border border-border rounded-xl font-semibold text-sm hover:border-accent hover:text-accent transition-colors"
            >
              {i18n.t('common.back')}
            </button>
            <button
              onClick={onNext}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {i18n.t('common.continue')}
            </button>
            <button
              onClick={onSkip}
              className="ml-2 px-6 py-3 text-muted-foreground rounded-xl font-semibold text-sm hover:text-foreground transition-colors"
            >
              {i18n.t('common.skip')}
            </button>
          </div>

          <div className="mt-6">
            <ProgressDots current={index} total={total} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(79,70,229,0.22),transparent_70%)] top-[15%] right-[-5%]" />
        <div className="animate-[float_4s_ease-in-out_infinite] relative z-10">
          <div className="bg-white rounded-2xl p-7 shadow-lg" style={{ minWidth: 340 }}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
              {i18n.t('onboarding.voiceDemoLabel')}
            </p>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Mic size={13} className="text-accent" />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-accent">
                  {i18n.t('onboarding.voiceDemoSay')}
                </p>
                <p className="text-sm text-foreground leading-relaxed mt-0.5">{i18n.t('onboarding.voiceDemoQuote')}</p>
              </div>
            </div>

            <div className="ml-3.5 my-1.5 h-5 w-px bg-border" />

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <MousePointerClick size={13} className="text-accent" />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {i18n.t('onboarding.voiceDemoAct')}
                </p>
                <p className="text-sm text-foreground leading-relaxed mt-0.5">{i18n.t('onboarding.voiceDemoAction')}</p>
              </div>
            </div>

            <div className="border-t border-border my-4" />

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <p className="text-sm text-foreground leading-relaxed">{i18n.t('onboarding.voiceDemoQuote')}</p>
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-accent bg-secondary px-2 py-0.5 rounded mt-2">
                  <Mic size={9} />
                  {i18n.t('onboarding.voiceDemoBadge')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
