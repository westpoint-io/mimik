import { useState } from 'react';
import { AISetupStep } from './steps/AISetupStep';
import { DoneStep } from './steps/DoneStep';
import { GitHubStarStep } from './steps/GitHubStarStep';
import { PinExtensionStep } from './steps/PinExtensionStep';
import { SmartBlurStep } from './steps/SmartBlurStep';
import { VoiceStep } from './steps/VoiceStep';
import { WelcomeStep } from './steps/WelcomeStep';

const CONFIG_STEPS =
  import.meta.env.BROWSER === 'firefox'
    ? [AISetupStep, SmartBlurStep, PinExtensionStep, GitHubStarStep]
    : [AISetupStep, VoiceStep, SmartBlurStep, PinExtensionStep, GitHubStarStep];

export function OnboardingApp() {
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
