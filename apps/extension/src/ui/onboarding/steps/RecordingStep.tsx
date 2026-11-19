import { OnboardingCard, OnboardingChoice, StepNav, type StepProps } from '@mimik/ui';
import { useEffect, useState } from 'react';
import { i18n } from '#imports';
import { localStorage } from '@/lib/browser-api/local-storage';
import { RecordingPicture } from './RecordingPicture';

export function RecordingStep({ onNext, onBack }: StepProps) {
  const [card, setCard] = useState(false);

  useEffect(() => {
    void localStorage.get(['recordingCard']).then((stored) => setCard(stored.recordingCard === true));
  }, []);

  const choose = (value: boolean) => {
    setCard(value);
    void localStorage.set({ recordingCard: value });
  };

  return (
    <>
      <OnboardingCard title={i18n.t('onboarding.recordTitle')} message={i18n.t('onboarding.recordMessage')}>
        <div className="grid w-full grid-cols-2 gap-3 max-[640px]:grid-cols-1">
          <OnboardingChoice
            selected={!card}
            picture={<RecordingPicture card={false} />}
            title={i18n.t('settings.recordingInPanel')}
            message={i18n.t('onboarding.panelMessage')}
            best={i18n.t('onboarding.panelBest')}
            onSelect={() => choose(false)}
          />
          <OnboardingChoice
            selected={card}
            picture={<RecordingPicture card />}
            title={i18n.t('settings.recordingInCard')}
            message={i18n.t('onboarding.cardMessage')}
            best={i18n.t('onboarding.cardBest')}
            onSelect={() => choose(true)}
          />
        </div>
      </OnboardingCard>
      <StepNav onNext={onNext} onBack={onBack} />
    </>
  );
}
