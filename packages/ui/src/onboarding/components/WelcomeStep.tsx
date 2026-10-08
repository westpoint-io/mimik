import { i18n } from '@mimik/core/env';
import { Power, Shield, Star } from 'lucide-react';
import { MascotIcon } from '../../common/components/MascotIcon';
import { StepNav } from './StepNav';

const CHIPS = [
  { key: 'onboarding.chipDevice', Icon: Shield },
  { key: 'onboarding.chipAccount', Icon: Power },
  { key: 'onboarding.chipFree', Icon: Star },
] as const;

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <section className="flex flex-col items-center gap-3.5 rounded-[18px] border border-lavender/60 bg-card px-7 py-9 text-center max-[640px]:px-4">
        <MascotIcon size={96} />
        <h1 className="text-[26px] leading-tight font-bold text-balance text-foreground">
          {i18n.t('onboarding.helloTitle')}
        </h1>
        <p className="max-w-[52ch] text-[13.5px] text-muted-foreground">{i18n.t('onboarding.helloMessage')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {CHIPS.map(({ key, Icon }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12.5px] font-medium text-foreground"
            >
              <Icon size={14} />
              {i18n.t(key)}
            </span>
          ))}
        </div>
      </section>
      <StepNav onNext={onNext} nextLabel={i18n.t('onboarding.getStarted')} />
    </>
  );
}
