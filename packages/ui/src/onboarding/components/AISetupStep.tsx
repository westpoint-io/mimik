import { SERVER } from '@mimik/core/capture/ai/keys';
import { CUSTOM_MODEL_VALUE } from '@mimik/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { i18n } from '@mimik/core/env';
import { ProviderKeyRow } from '../../ai/components/ProviderKeyRow';
import { ProviderSelect } from '../../ai/components/ProviderSelect';
import { ServerSettings } from '../../ai/components/ServerSettings';
import { useAiSettings } from '../../ai/hooks/use-ai-settings';
import { useApiKeys } from '../../ai/hooks/use-api-keys';
import { aiProviderOptions } from '../../ai/lib/ai-provider-options';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import type { StepProps } from '../types';
import { ProgressDots } from './ProgressDots';

const FIELD = 'w-full h-11 rounded-xl px-4 text-sm focus:border-accent focus:ring-accent/10';

export function AISetupStep({ onNext, onSkip, onBack, index, total, validate }: StepProps) {
  const keys = useApiKeys({ reloadOnFocus: true });
  const ai = useAiSettings({ reloadOnFocus: true });
  const provider = ai.provider;

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
              <ProviderSelect
                value={provider}
                onChange={ai.setProvider}
                options={aiProviderOptions(() => true)}
                triggerClassName={FIELD}
              />
            </div>

            {provider === SERVER ? (
              <ServerSettings server={keys.server} onChange={keys.setServer} validate={validate} />
            ) : (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {i18n.t('settings.apiKey')}
                </label>
                <ProviderKeyRow
                  key={provider}
                  bare
                  provider={provider}
                  value={keys.keys[provider] ?? ''}
                  onChange={(next) => keys.setKey(provider, next)}
                  validate={validate}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">{i18n.t('onboarding.keySaved')}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{i18n.t('settings.model')}</label>
              {ai.models.length > 0 && (
                <Select value={ai.usingCustomModel ? CUSTOM_MODEL_VALUE : ai.model} onValueChange={ai.setModel}>
                  <SelectTrigger className={FIELD}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ai.models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {ai.usingCustomModel && (
                <Input
                  type="text"
                  value={ai.model}
                  onChange={(e) => ai.setModel(e.target.value)}
                  placeholder={ai.defaultModel || 'llama3.2'}
                  aria-label={i18n.t('settings.modelCustom')}
                  className={`${ai.models.length > 0 ? 'mt-1.5 ' : ''}${FIELD}`}
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {i18n.t('settings.aiLanguage')}
              </label>
              <Select value={ai.language} onValueChange={(v) => ai.setLanguage(v as AILanguageCode)}>
                <SelectTrigger className={FIELD}>
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
