import { SERVER } from '@mimik/core/capture/ai/keys';
import { AI_LANGUAGES, type AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { i18n } from '@mimik/core/env';
import { type ReactNode, useState } from 'react';
import { ProviderKeyRow } from '../../ai/components/ProviderKeyRow';
import { ProviderSelect } from '../../ai/components/ProviderSelect';
import { ServerSettings } from '../../ai/components/ServerSettings';
import { useAiSettings } from '../../ai/hooks/use-ai-settings';
import { useApiKeys } from '../../ai/hooks/use-api-keys';
import { aiProviderOptions } from '../../ai/lib/ai-provider-options';
import type { ValidateKey } from '../../ai/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import type { StepProps } from '../types';
import { OnboardingCard } from './OnboardingCard';
import { StepNav } from './StepNav';
import { VoiceNarrationRow } from './VoiceNarrationRow';
import { WritingChoice } from './WritingChoice';

const FIELD = 'h-10 w-full rounded-[9px] px-3 text-[12.5px]';

interface WriteStepsStepProps extends StepProps {
  validate: ValidateKey;
  voice: boolean;
  requestMicrophoneAccess: () => Promise<void>;
  microphoneAccess?: ReactNode;
  microphoneLocked?: boolean;
}

export function WriteStepsStep({
  onNext,
  onBack,
  validate,
  voice,
  requestMicrophoneAccess,
  microphoneAccess,
  microphoneLocked,
}: WriteStepsStepProps) {
  const keys = useApiKeys({ reloadOnFocus: true });
  const ai = useAiSettings({ reloadOnFocus: true });
  const [picked, setPicked] = useState<'basic' | 'ai' | null>(null);
  const provider = ai.provider;
  const keyed = provider === SERVER ? Boolean(keys.server.url) : Boolean(keys.keys[provider]);
  const mode = picked ?? (ai.forSteps && keyed ? 'ai' : 'basic');

  const choose = (next: 'basic' | 'ai') => {
    setPicked(next);
    ai.setForSteps(next === 'ai');
    ai.setForGuide(next === 'ai');
  };

  return (
    <>
      <OnboardingCard title={i18n.t('onboarding.writeTitle')} message={i18n.t('onboarding.writeMessage')}>
        <div className="grid w-full grid-cols-2 gap-3 max-[640px]:grid-cols-1">
          <WritingChoice
            selected={mode === 'basic'}
            badge={i18n.t('stepSource.basic')}
            example={i18n.t('onboarding.basicExample')}
            title={i18n.t('onboarding.basicTitle')}
            message={i18n.t('onboarding.basicMessage')}
            best={i18n.t('onboarding.basicBest')}
            onSelect={() => choose('basic')}
          />
          <WritingChoice
            ai
            selected={mode === 'ai'}
            badge={i18n.t('stepSource.ai')}
            example={i18n.t('onboarding.aiExample')}
            title={i18n.t('onboarding.aiChoiceTitle')}
            message={i18n.t(voice ? 'onboarding.aiChoiceMessage' : 'onboarding.aiChoiceMessageNoVoice')}
            best={i18n.t('onboarding.aiBest')}
            onSelect={() => choose('ai')}
          />
        </div>

        {mode === 'ai' && (
          <div className="flex w-full flex-col gap-2 text-left">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 max-[640px]:grid-cols-1">
              <ProviderSelect
                value={provider}
                onChange={ai.setProvider}
                options={aiProviderOptions(() => true)}
                triggerClassName={FIELD}
              />
              <Select value={ai.language} onValueChange={(v) => ai.setLanguage(v as AILanguageCode)}>
                <SelectTrigger className={FIELD} aria-label={i18n.t('settings.aiLanguage')}>
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
            {provider === SERVER ? (
              <ServerSettings server={keys.server} onChange={keys.setServer} validate={validate} />
            ) : (
              <ProviderKeyRow
                key={provider}
                bare
                provider={provider}
                value={keys.keys[provider] ?? ''}
                onChange={(next) => keys.setKey(provider, next)}
                validate={validate}
              />
            )}
            <p className="text-center text-[11.5px] text-muted-foreground">{i18n.t('onboarding.keyPrivacy')}</p>
            {voice && (
              <VoiceNarrationRow
                aiProvider={provider}
                validate={validate}
                requestMicrophoneAccess={requestMicrophoneAccess}
                microphoneAccess={microphoneAccess}
                microphoneLocked={microphoneLocked}
              />
            )}
          </div>
        )}
      </OnboardingCard>
      <StepNav onNext={onNext} onBack={onBack} />
    </>
  );
}
