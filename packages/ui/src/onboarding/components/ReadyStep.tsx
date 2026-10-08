import { client, i18n, localStorage } from '@mimik/core/env';
import { FileText, MousePointerClick } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { MascotIcon } from '../../common/components/MascotIcon';
import { CaptureDemo } from './CaptureDemo';
import { OnboardingCard } from './OnboardingCard';
import { StarCard } from './StarCard';
import { StepNav } from './StepNav';

const STEPS = [
  { phase: 1, dot: 'bg-primary' },
  { phase: 2, dot: 'bg-destructive' },
  { phase: 3, dot: 'bg-success' },
] as const;

export function ReadyStep({ aside, onNext }: { aside: ReactNode; onNext: () => void }) {
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const desktop = client() === 'desktop';
  const labels = [
    i18n.t(desktop ? 'onboarding.readyStepStart' : 'onboarding.readyStepOpen'),
    i18n.t('onboarding.readyStepClick'),
    i18n.t('onboarding.readyStepGuide'),
  ];
  const icons = [
    <MascotIcon key="open" size={26} />,
    <MousePointerClick key="click" size={18} />,
    <FileText key="guide" size={18} />,
  ];

  useEffect(() => {
    void localStorage.set({ onboardingCompleted: true });
  }, []);

  return (
    <>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:[&:has(>:only-child)]:grid-cols-1">
        <OnboardingCard
          title={i18n.t('onboarding.readyTitle')}
          className="lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:items-stretch lg:justify-items-center"
        >
          <ol className="flex w-full items-start justify-center gap-1">
            {STEPS.map(({ phase: n, dot }, i) => (
              <li
                key={n}
                className={`flex max-w-[150px] flex-1 flex-col items-center gap-2 text-[12.5px] font-semibold transition-opacity duration-300 ${
                  phase === n ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <span
                  className={`relative flex h-10 w-[52px] items-center justify-center rounded-full bg-secondary text-foreground ${
                    phase === n ? 'shadow-[0_0_0_2px_var(--color-primary)]' : ''
                  }`}
                >
                  <em
                    className={`absolute -top-1.5 -left-1 flex size-[18px] items-center justify-center rounded-full text-[10.5px] font-bold text-white not-italic ${dot}`}
                  >
                    {n}
                  </em>
                  {icons[i]}
                </span>
                {labels[i]}
              </li>
            ))}
          </ol>
          <CaptureDemo onPhase={setPhase} />
        </OnboardingCard>
        {aside}
      </div>
      <StarCard />
      <StepNav onNext={onNext} />
    </>
  );
}
