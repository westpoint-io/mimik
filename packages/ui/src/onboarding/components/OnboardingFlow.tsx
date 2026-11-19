import { Fragment, type ReactNode, useState } from 'react';
import type { ValidateKey } from '../../ai/types';
import { MascotIcon } from '../../common/components/MascotIcon';
import type { StepProps } from '../types';
import { LetterStep } from './LetterStep';
import { MakeItYoursStep } from './MakeItYoursStep';
import { ReadyStep } from './ReadyStep';
import { WelcomeStep } from './WelcomeStep';
import { WriteStepsStep } from './WriteStepsStep';

interface OnboardingFlowProps {
  validate: ValidateKey;
  requestMicrophoneAccess: () => Promise<void>;
  microphoneAccess?: ReactNode;
  microphoneLocked?: boolean;
  voice?: boolean;
  extraRows?: ReactNode;
  extraStep?: (nav: StepProps) => ReactNode;
  readyAside: ReactNode;
  onFinish: () => void;
}

export function OnboardingFlow({
  validate,
  requestMicrophoneAccess,
  microphoneAccess,
  microphoneLocked,
  voice = true,
  extraRows,
  extraStep,
  readyAside,
  onFinish,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const last = extraStep ? 5 : 4;
  const next = () => setStep((s) => Math.min(s + 1, last));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const steps = [
    <WelcomeStep key="welcome" onNext={next} />,
    <WriteStepsStep
      key="write"
      onNext={next}
      onBack={back}
      validate={validate}
      voice={voice}
      requestMicrophoneAccess={requestMicrophoneAccess}
      microphoneAccess={microphoneAccess}
      microphoneLocked={microphoneLocked}
    />,
    ...(extraStep ? [<Fragment key="extra">{extraStep({ onNext: next, onBack: back })}</Fragment>] : []),
    <MakeItYoursStep key="make" onNext={next} onBack={back} extraRows={extraRows} />,
    <ReadyStep key="ready" aside={readyAside} onNext={next} />,
    <LetterStep key="letter" onFinish={onFinish} />,
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 px-6 pt-5 text-[17px] font-bold">
        <MascotIcon size={32} />
        Mimik
      </header>
      <main
        className={`mx-auto flex w-full flex-1 flex-col justify-center gap-3.5 px-4 py-6 ${step === last - 1 ? 'max-w-[1040px]' : 'max-w-[640px]'}`}
      >
        {steps[step]}
      </main>
    </div>
  );
}
