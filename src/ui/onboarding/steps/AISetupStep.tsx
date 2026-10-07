import {
  Input,
  KeyStatusNote,
  KeyWarningNote,
  ModelList,
  SecretInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useAiSettings,
} from '@mimik/ui';
import { Globe } from 'lucide-react';
import { i18n } from '#imports';
import { AI_PROVIDERS, type AIProviderKey, CUSTOM_MODEL_VALUE } from '@/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@/core/capture/ai/prompts';
import { useKeyCheck } from '@/ui/shared/hooks/use-key-check';
import { ProgressDots } from '../ProgressDots';
import type { StepProps } from '../types';

export function AISetupStep({ onNext, onSkip, onBack, index, total }: StepProps) {
  const aiKeyCheck = useKeyCheck();
  const ai = useAiSettings({ onDirty: aiKeyCheck.reset, reloadOnFocus: true });
  const {
    provider,
    model,
    apiKey,
    baseUrl,
    language: aiLanguage,
    ownServer,
    usingCustomModel,
    providerConfig,
    setProvider: handleProviderChange,
    setModel: handleModelChange,
    setApiKey: handleApiKeyChange,
    setBaseUrl: handleBaseUrlChange,
    setLanguage: handleLanguageChange,
    toggleOwnServer: handleOwnServerToggle,
  } = ai;

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
                <SelectTrigger className="w-full h-11 rounded-xl px-4 text-sm focus:border-accent focus:ring-accent/10">
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

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{i18n.t('settings.model')}</label>
              <Select value={usingCustomModel ? CUSTOM_MODEL_VALUE : model} onValueChange={handleModelChange}>
                <SelectTrigger className="w-full h-11 rounded-xl px-4 text-sm focus:border-accent focus:ring-accent/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerConfig.models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usingCustomModel && (
                <Input
                  type="text"
                  value={model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  placeholder={providerConfig.defaultModel}
                  className="w-full mt-1.5 h-11 rounded-xl px-4 text-sm focus:border-accent focus:ring-accent/10"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{i18n.t('settings.apiKey')}</label>
              <SecretInput
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="sk-..."
                className="w-full h-11 rounded-xl px-4 text-sm focus:border-accent focus:ring-accent/10"
                buttonClassName="right-3"
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  disabled={!apiKey || aiKeyCheck.status === 'checking'}
                  onClick={() => {
                    if (aiKeyCheck.status !== 'checking') void aiKeyCheck.check(provider, apiKey, baseUrl, model);
                  }}
                  className="px-4 py-2 bg-card text-foreground border border-border rounded-lg font-semibold text-xs hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {i18n.t('settings.checkKey')}
                </button>
                <div className="min-w-0">
                  <KeyStatusNote status={aiKeyCheck.status} />
                  <KeyWarningNote warning={aiKeyCheck.warning} />
                </div>
              </div>
              {aiKeyCheck.models && <ModelList models={aiKeyCheck.models} />}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Globe size={12} className="-mt-px" />
                  {i18n.t('settings.useOwnServer')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ownServer}
                  aria-label={i18n.t('settings.useOwnServer')}
                  onClick={handleOwnServerToggle}
                  className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${
                    ownServer ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      ownServer ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {ownServer && (
                <div className="mt-2 space-y-2">
                  <Input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => handleBaseUrlChange(e.target.value)}
                    placeholder={providerConfig.defaultBaseUrl}
                    aria-label={i18n.t('settings.baseUrl')}
                    className="w-full h-11 rounded-xl px-4 text-sm focus:border-accent focus:ring-accent/10"
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {i18n.t(
                      providerConfig.protocol === 'anthropic'
                        ? 'settings.ownServerHintAnthropic'
                        : 'settings.ownServerHintOpenai',
                    )}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {i18n.t('settings.aiLanguage')}
              </label>
              <Select value={aiLanguage} onValueChange={(v) => handleLanguageChange(v as AILanguageCode)}>
                <SelectTrigger className="w-full h-11 rounded-xl px-4 text-sm focus:border-accent focus:ring-accent/10">
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
