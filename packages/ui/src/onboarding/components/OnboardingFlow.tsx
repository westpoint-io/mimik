import { type ComponentType, type ReactNode, useState } from 'react';
import type { ValidateKey } from '../../ai/types';
import type { StepProps } from '../types';
import { DoneStep } from './DoneStep';
import { WelcomeStep } from './WelcomeStep';

interface OnboardingFlowProps {
  steps: ComponentType<StepProps>[];
  validate: ValidateKey;
  requestMicrophoneAccess: () => Promise<void>;
  microphoneAccess?: ReactNode;
  microphoneLocked?: boolean;
  onFinish: () => void;
}

const KEYFRAMES =
  '@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}';

export function OnboardingFlow({
  steps,
  validate,
  requestMicrophoneAccess,
  microphoneAccess,
  microphoneLocked,
  onFinish,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(0);

  const lastStep = steps.length + 1;
  const next = () => setStep((s) => Math.min(s + 1, lastStep));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const CurrentStep = steps[step - 1];

  return (
    <div className="min-h-screen bg-card text-foreground">
      <style>{KEYFRAMES}</style>
      {step === 0 && <WelcomeStep onNext={next} />}
      {CurrentStep && (
        <CurrentStep
          onNext={next}
          onSkip={next}
          onBack={back}
          index={step}
          total={steps.length}
          validate={validate}
          requestMicrophoneAccess={requestMicrophoneAccess}
          microphoneAccess={microphoneAccess}
          microphoneLocked={microphoneLocked}
        />
      )}
      {step === lastStep && <DoneStep onOpen={onFinish} />}
    </div>
  );
}
