import { Mic, MousePointerClick, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser, i18n } from '#imports';
import { PRESET_LABELS, type PresetKey } from '@/core/blur/regexes';
import { isInsecureEndpoint } from '@/core/capture/ai/endpoint';
import { AI_PROVIDERS, type AIProviderKey, CUSTOM_MODEL_VALUE, isCustomModel } from '@/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@/core/capture/ai/prompts';
import type { VoiceProvider } from '@/core/capture/voice/transcribe';
import { localStorage, openSidebar, requestHostPermissions } from '@/lib/browser-api';
import { Input } from '@/ui/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select';
import MicrophonePicker from '@/ui/shared/MicrophonePicker';

interface StepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  index: number;
  total: number;
}

const REPO_URL = 'https://github.com/westpoint-io/mimik';

const BLUR_PRESET_I18N: Record<PresetKey, string> = {
  email: 'email',
  phone: 'phoneNumbers',
  ssn: 'ssn',
  creditCard: 'creditCard',
  ipAddress: 'ipAddress',
  macAddress: 'macAddress',
};

function MascotLarge({ size = 280 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <circle cx="40" cy="70" r="4" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite' }} />
      <circle cx="165" cy="60" r="3.5" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.3s' }} />
      <circle cx="42" cy="155" r="3" fill="#A5B4FC" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.6s' }} />
      <circle
        cx="162"
        cy="150"
        r="3.5"
        fill="#818CF8"
        style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.9s' }}
      />
      <circle cx="100" cy="110" r="55" fill="#C7D2FE" />
      <rect x="55" y="110" width="90" height="44" rx="5" fill="#1E1B4B" />
      <path d="M55 110 L55 98 Q55 80 100 80 Q145 80 145 98 L145 110Z" fill="#3730A3" />
      <path d="M55 110 L55 98 Q55 80 100 80 Q145 80 145 98 L145 110Z" fill="#4F46E5" />
      <rect x="55" y="109" width="90" height="2" fill="#C7D2FE" />
      <path d="M80 128 Q86 120 92 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M108 128 Q114 120 120 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M90 140 Q100 148 110 140" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <style>{`@keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </svg>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, position) => position + 1).map((i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === current ? 'w-8 bg-accent' : i < current ? 'w-2 bg-accent/40' : 'w-2 bg-border'
          }`}
        />
      ))}
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-lg">
          <span className="inline-flex text-xs font-semibold text-accent bg-secondary px-3.5 py-1.5 rounded-full mb-6">
            {i18n.t('onboarding.welcomeBadge')}
          </span>
          <h1 className="text-4xl font-extrabold text-foreground leading-tight mb-3 tracking-tight">
            {i18n.t('onboarding.welcomeTitle')}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-10 max-w-md">
            {i18n.t('onboarding.welcomeMessage')}
          </p>
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            {i18n.t('onboarding.getStarted')}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(79,70,229,0.2),transparent_70%)] top-[10%] right-[-10%]" />
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(56,189,248,0.1),transparent_70%)] bottom-[10%] left-[10%]" />
        <div className="animate-[float_3s_ease-in-out_infinite]">
          <MascotLarge size={280} />
        </div>
      </div>
    </div>
  );
}

function AISetupStep({ onNext, onSkip, onBack, index, total }: StepProps) {
  const [provider, setProvider] = useState<AIProviderKey>('openai');
  const [model, setModel] = useState(AI_PROVIDERS.openai.defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [aiLanguage, setAiLanguage] = useState<AILanguageCode>('en');
  const [customModel, setCustomModel] = useState(false);

  useEffect(() => {
    const load = () =>
      localStorage.get(['aiProvider', 'aiModel', 'aiApiKey', 'aiBaseUrl', 'aiLanguage']).then((stored) => {
        if (typeof stored.aiProvider === 'string' && stored.aiProvider in AI_PROVIDERS) {
          setProvider(stored.aiProvider as AIProviderKey);
        }
        if (typeof stored.aiModel === 'string') setModel(stored.aiModel);
        if (typeof stored.aiApiKey === 'string') setApiKey(stored.aiApiKey);
        if (typeof stored.aiBaseUrl === 'string') setBaseUrl(stored.aiBaseUrl);
        if (typeof stored.aiLanguage === 'string') setAiLanguage(stored.aiLanguage as AILanguageCode);
      });

    void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const providerConfig = AI_PROVIDERS[provider];
  const usingCustomModel = customModel || providerConfig.models.length === 0 || isCustomModel(model, providerConfig);

  const handleProviderChange = (newProvider: AIProviderKey) => {
    const nextModel = AI_PROVIDERS[newProvider].defaultModel;
    setProvider(newProvider);
    setCustomModel(false);
    setModel(nextModel);
    setBaseUrl('');
    void localStorage.set({ aiProvider: newProvider, aiModel: nextModel, aiBaseUrl: '' });
  };

  const handleBaseUrlChange = (nextBaseUrl: string) => {
    setBaseUrl(nextBaseUrl);
    void localStorage.set({ aiBaseUrl: nextBaseUrl });
  };

  const handleModelChange = (nextModel: string) => {
    if (nextModel === CUSTOM_MODEL_VALUE) {
      setCustomModel(true);
      setModel('');
      return;
    }
    setCustomModel(false);
    setModel(nextModel);
    void localStorage.set({ aiModel: nextModel });
  };

  const handleCustomModelChange = (nextModel: string) => {
    setModel(nextModel);
    void localStorage.set({ aiModel: nextModel });
  };

  const handleApiKeyChange = (nextKey: string) => {
    setApiKey(nextKey);
    void localStorage.set({ aiApiKey: nextKey });
  };

  const handleLanguageChange = (nextLanguage: AILanguageCode) => {
    setAiLanguage(nextLanguage);
    void localStorage.set({ aiLanguage: nextLanguage });
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.stepOf', [String(index), String(total)])}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">{i18n.t('onboarding.aiTitle')}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.aiMessage')}</p>

          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {i18n.t('settings.provider')}
              </label>
              <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProviderKey)}>
                <SelectTrigger className="w-full rounded-xl px-4 py-2.5 text-sm focus:border-accent focus:ring-accent/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AI_PROVIDERS).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {providerConfig.requiresEndpoint && (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {i18n.t('settings.endpoint')}
                </label>
                <Input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => handleBaseUrlChange(e.target.value)}
                  placeholder={providerConfig.endpointExample}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:border-accent focus:ring-accent/10"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{i18n.t('settings.endpointHint')}</p>
                {isInsecureEndpoint(baseUrl) && (
                  <p className="mt-1.5 text-xs text-destructive" role="alert">
                    {i18n.t('settings.endpointInsecure')}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{i18n.t('settings.model')}</label>
              <Select value={usingCustomModel ? CUSTOM_MODEL_VALUE : model} onValueChange={handleModelChange}>
                <SelectTrigger className="w-full rounded-xl px-4 py-2.5 text-sm focus:border-accent focus:ring-accent/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerConfig.models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_MODEL_VALUE}>{i18n.t('settings.modelCustom')}</SelectItem>
                </SelectContent>
              </Select>
              {usingCustomModel && (
                <Input
                  value={model}
                  onChange={(e) => handleCustomModelChange(e.target.value)}
                  placeholder={providerConfig.defaultModel}
                  aria-label={i18n.t('settings.modelCustom')}
                  className="mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm focus:border-accent focus:ring-accent/10"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{i18n.t('settings.apiKey')}</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:border-accent focus:ring-accent/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {i18n.t('settings.aiLanguage')}
              </label>
              <Select value={aiLanguage} onValueChange={(v) => handleLanguageChange(v as AILanguageCode)}>
                <SelectTrigger className="w-full rounded-xl px-4 py-2.5 text-sm focus:border-accent focus:ring-accent/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      <div className="w-1/2 bg-secondary flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(79,70,229,0.06),transparent_70%)] top-[20%] left-[30%]" />
        <div className="animate-[float_4s_ease-in-out_infinite] relative">
          <svg
            className="absolute -top-4 right-6 w-6 h-6 text-violet-light opacity-40"
            style={{ animation: 'sparkle 2s ease-in-out infinite' }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
          </svg>
          <svg
            className="absolute bottom-3 -left-3 w-4 h-4 text-violet-light opacity-40"
            style={{ animation: 'sparkle 2s ease-in-out infinite 0.5s' }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
          </svg>
          <div className="bg-white rounded-2xl p-9 shadow-lg max-w-sm">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
              {i18n.t('onboarding.aiGeneratedDescription')}
            </p>
            <div className="flex gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <p className="text-sm text-foreground leading-relaxed">
                  Click on the{' '}
                  <span className="bg-accent/10 text-accent font-semibold px-1 rounded">Pull requests</span> tab in the
                  repository navigation
                </p>
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-accent bg-secondary px-2 py-0.5 rounded mt-2">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
                  </svg>
                  {i18n.t('onboarding.aiGenerated')}
                </span>
              </div>
            </div>
            <div className="border-t border-border my-4" />
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                4
              </div>
              <div>
                <p className="text-sm text-foreground leading-relaxed">
                  Click on <span className="bg-accent/10 text-accent font-semibold px-1 rounded">Sort</span> dropdown to
                  change the ordering
                </p>
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-accent bg-secondary px-2 py-0.5 rounded mt-2">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
                  </svg>
                  {i18n.t('onboarding.aiGenerated')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoiceStep({ onNext, onSkip, onBack, index, total }: StepProps) {
  const [provider, setProvider] = useState<VoiceProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [microphoneId, setMicrophoneId] = useState('');

  useEffect(() => {
    const load = () =>
      localStorage
        .get(['voiceProvider', 'voiceApiKey', 'voiceBaseUrl', 'voiceModel', 'voiceMicrophoneId'])
        .then((stored) => {
          if (stored.voiceProvider === 'openai' || stored.voiceProvider === 'groq' || stored.voiceProvider === 'azure')
            setProvider(stored.voiceProvider);
          if (typeof stored.voiceApiKey === 'string') setApiKey(stored.voiceApiKey);
          if (typeof stored.voiceBaseUrl === 'string') setBaseUrl(stored.voiceBaseUrl);
          if (typeof stored.voiceModel === 'string') setModel(stored.voiceModel);
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
    setBaseUrl('');
    setModel('');
    void localStorage.set({ voiceProvider: nextProvider, voiceBaseUrl: '', voiceModel: '' });
  };

  const handleApiKeyChange = (nextKey: string) => {
    setApiKey(nextKey);
    void localStorage.set({ voiceApiKey: nextKey });
  };

  const handleBaseUrlChange = (nextBaseUrl: string) => {
    setBaseUrl(nextBaseUrl);
    void localStorage.set({ voiceBaseUrl: nextBaseUrl });
  };

  const handleModelChange = (nextModel: string) => {
    setModel(nextModel);
    void localStorage.set({ voiceModel: nextModel });
  };

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

          <div className="border border-border rounded-2xl p-4 space-y-3 mb-6">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {i18n.t('settings.provider')}
                </label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as VoiceProvider)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-[13px] text-foreground bg-card font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                >
                  <option value="openai">OpenAI</option>
                  <option value="groq">Groq</option>
                  <option value="azure">Azure OpenAI</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {i18n.t('settings.apiKey')}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder={provider === 'groq' ? 'gsk_...' : provider === 'azure' ? '' : 'sk-...'}
                  className="w-full border border-border rounded-xl px-3 py-2 text-[13px] text-foreground bg-card font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {provider === 'azure' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    {i18n.t('settings.endpoint')}
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => handleBaseUrlChange(e.target.value)}
                    placeholder="https://your-resource.openai.azure.com"
                    className="w-full border border-border rounded-xl px-3 py-2 text-[13px] text-foreground bg-card font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.endpointHint')}</p>
                  {isInsecureEndpoint(baseUrl) && (
                    <p className="mt-1 text-[11px] text-destructive" role="alert">
                      {i18n.t('settings.endpointInsecure')}
                    </p>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    {i18n.t('settings.voiceDeployment')}
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-2 text-[13px] text-foreground bg-card font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                </div>
              </div>
            )}

            <MicrophonePicker value={microphoneId} onChange={handleMicrophoneChange} />

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-secondary text-[11px] text-muted-foreground leading-relaxed">
              <Mic size={12} className="shrink-0 mt-0.5 text-accent" />
              <span>{i18n.t('onboarding.voiceRecordHint')}</span>
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

function SmartBlurStep({ onNext, onBack, index, total }: StepProps) {
  const [blurPresets, setBlurPresets] = useState<Record<PresetKey, boolean>>({
    email: true,
    phone: true,
    ssn: false,
    creditCard: false,
    ipAddress: false,
    macAddress: false,
  });

  useEffect(() => {
    localStorage.get(['blurPresets']).then((stored) => {
      if (stored.blurPresets && typeof stored.blurPresets === 'object') {
        setBlurPresets((prev) => ({ ...prev, ...(stored.blurPresets as Record<PresetKey, boolean>) }));
      }
    });
  }, []);

  const handleToggle = (key: PresetKey) => {
    setBlurPresets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.set({ blurPresets: next });
      return next;
    });
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.stepOf', [String(index), String(total)])}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {i18n.t('onboarding.blurTitle')}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.blurMessage')}</p>

          <div className="space-y-1 mb-8 border border-border rounded-2xl p-4">
            {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key, i, arr) => (
              <div
                key={key}
                className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-secondary' : ''}`}
              >
                <span className="text-sm font-medium text-foreground">
                  {i18n.t(`blurPresets.${BLUR_PRESET_I18N[key]}`)}
                </span>
                <button
                  onClick={() => handleToggle(key)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    blurPresets[key] ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      blurPresets[key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
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
          </div>

          <div className="mt-6">
            <ProgressDots current={index} total={total} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[350px] h-[350px] bg-[radial-gradient(circle,rgba(79,70,229,0.25),transparent_70%)] bottom-[20%] right-[20%]" />
        <div className="animate-[float_4s_ease-in-out_infinite] relative z-10">
          <div className="bg-white rounded-2xl p-7 shadow-lg" style={{ minWidth: 320 }}>
            <p className="text-xs font-semibold text-foreground mb-4">{i18n.t('onboarding.screenshotPreview')}</p>
            {[
              { icon: '@', label: i18n.t('blurPresets.email'), value: 'luis@company.com', blurred: true },
              { icon: '#', label: i18n.t('blurPresets.phoneNumbers'), value: '(555) 867-5309', blurred: true },
              { icon: 'ID', label: i18n.t('blurPresets.ssn'), value: i18n.t('onboarding.notEnabled'), blurred: false },
              {
                icon: '$',
                label: i18n.t('blurPresets.creditCard'),
                value: i18n.t('onboarding.notEnabled'),
                blurred: false,
              },
              {
                icon: 'IP',
                label: i18n.t('blurPresets.ipAddress'),
                value: i18n.t('onboarding.notEnabled'),
                blurred: false,
              },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className={`flex items-center gap-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center text-[10px] font-semibold text-accent">
                  {row.icon}
                </div>
                <span className="text-xs text-muted-foreground flex-1">{row.label}</span>
                <span
                  className={`text-xs font-semibold ${row.blurred ? 'text-foreground blur-[4px] select-none' : 'text-muted-foreground font-normal'}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-success bg-success/10 px-2.5 py-1 rounded mt-3">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {i18n.t('onboarding.categoriesProtected', ['2'])}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PinExtensionStep({ onNext, onBack, index, total }: StepProps) {
  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.stepOf', [String(index), String(total)])}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {i18n.t('onboarding.pinTitle')}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.pinMessage')}</p>

          <ol className="space-y-4 mb-8">
            <li className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent text-xs font-bold">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{i18n.t('onboarding.pinStep1Title')}</p>
                <p className="text-xs text-muted-foreground">{i18n.t('onboarding.pinStep1Sub')}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent text-xs font-bold">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{i18n.t('onboarding.pinStep2Title')}</p>
                <p className="text-xs text-muted-foreground">{i18n.t('onboarding.pinStep2Sub')}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent text-xs font-bold">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{i18n.t('onboarding.pinStep3Title')}</p>
                <p className="text-xs text-muted-foreground">{i18n.t('onboarding.pinStep3Sub')}</p>
              </div>
            </li>
          </ol>

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
          </div>

          <div className="mt-6">
            <ProgressDots current={index} total={total} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(79,70,229,0.2),transparent_70%)] top-[10%] right-[-10%]" />
        <div className="animate-[float_4s_ease-in-out_infinite] relative z-10">
          <img
            src="/pin-screenshot.png"
            alt={i18n.t('onboarding.pinScreenshotAlt')}
            className="rounded-xl shadow-2xl max-w-[400px]"
          />
        </div>
      </div>
    </div>
  );
}

function MascotWithStar({ size = 300 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <circle cx="34" cy="96" r="4" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite' }} />
      <circle cx="168" cy="86" r="3.5" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.5s' }} />
      <circle cx="46" cy="30" r="3" fill="#A5B4FC" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.9s' }} />
      <g transform="translate(72 2) scale(2.333)">
        <path
          d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
          fill="#FACC15"
        />
      </g>
      <circle cx="100" cy="110" r="55" fill="#C7D2FE" />
      <rect x="55" y="110" width="90" height="44" rx="5" fill="#1E1B4B" />
      <path d="M55 110 L55 98 Q55 80 100 80 Q145 80 145 98 L145 110Z" fill="#4F46E5" />
      <rect x="55" y="109" width="90" height="2" fill="#C7D2FE" />
      <path d="M80 128 Q86 120 92 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M108 128 Q114 120 120 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M90 140 Q100 149 110 140" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function GitHubStarStep({ onSkip, onBack, index, total }: StepProps) {
  const handleStar = () => {
    browser.tabs.create({ url: REPO_URL, active: true });
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.stepOf', [String(index), String(total)])}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {i18n.t('onboarding.starTitle')}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.starMessage')}</p>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-8 py-3 bg-card text-foreground border border-border rounded-xl font-semibold text-sm hover:border-accent hover:text-accent transition-colors"
            >
              {i18n.t('common.back')}
            </button>
            <button
              onClick={handleStar}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {i18n.t('onboarding.starAction')}
            </button>
            <button
              onClick={onSkip}
              className="ml-2 px-6 py-3 text-muted-foreground rounded-xl font-semibold text-sm hover:text-foreground transition-colors"
            >
              {i18n.t('onboarding.starLater')}
            </button>
          </div>

          <div className="mt-6">
            <ProgressDots current={index} total={total} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(79,70,229,0.2),transparent_70%)] top-[10%] right-[-10%]" />
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(250,204,21,0.08),transparent_70%)] bottom-[14%] left-[8%]" />
        <div className="animate-[float_3s_ease-in-out_infinite] relative z-10">
          <MascotWithStar size={300} />
        </div>
      </div>
    </div>
  );
}

function DoneStep() {
  useEffect(() => {
    localStorage.set({ onboardingCompleted: true });
  }, []);

  const handleOpen = async () => {
    openSidebar();
    const permissionsPromise = requestHostPermissions();
    await permissionsPromise;
    browser.tabs.create({ url: browser.runtime.getURL('/fullview.html') });
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-8 animate-[float_3s_ease-in-out_infinite]">
          <MascotLarge size={120} />
        </div>
        <h1 className="text-4xl font-extrabold text-foreground mb-3 tracking-tight">
          {i18n.t('onboarding.doneTitle')}
        </h1>
        <p className="text-base text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
          {i18n.t('onboarding.doneMessage')}
        </p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            {
              label: i18n.t('onboarding.featureAutoCapture'),
              icon: (
                <>
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </>
              ),
            },
            {
              label: i18n.t('onboarding.featureVoice'),
              icon: (
                <>
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                </>
              ),
            },
            {
              label: i18n.t('onboarding.featureAIAssist'),
              icon: <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />,
            },
            {
              label: i18n.t('onboarding.featureAnnotate'),
              icon: (
                <>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </>
              ),
            },
            {
              label: i18n.t('onboarding.featureSmartBlur'),
              icon: (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ),
            },
            {
              label: i18n.t('onboarding.featureExports'),
              icon: (
                <>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5M12 15V3" />
                </>
              ),
            },
          ].map((f) => (
            <div key={f.label} className="bg-secondary rounded-xl px-3 py-4 text-center">
              <div className="text-accent flex justify-center mb-2">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  {f.icon}
                </svg>
              </div>
              <p className="text-xs font-semibold text-foreground">{f.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleOpen}
          className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          {i18n.t('onboarding.openMimik')}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const CONFIG_STEPS =
  import.meta.env.BROWSER === 'firefox'
    ? [AISetupStep, SmartBlurStep, PinExtensionStep, GitHubStarStep]
    : [AISetupStep, VoiceStep, SmartBlurStep, PinExtensionStep, GitHubStarStep];

export default function OnboardingApp() {
  const [step, setStep] = useState(0);

  const lastStep = CONFIG_STEPS.length + 1;
  const next = () => setStep((s) => Math.min(s + 1, lastStep));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const CurrentStep = CONFIG_STEPS[step - 1];

  return (
    <div className="min-h-screen bg-card text-foreground">
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
      {step === 0 && <WelcomeStep onNext={next} />}
      {CurrentStep && (
        <CurrentStep onNext={next} onSkip={next} onBack={back} index={step} total={CONFIG_STEPS.length} />
      )}
      {step === lastStep && <DoneStep />}
    </div>
  );
}
