import { validateApiKey } from '@mimik/core/capture/ai/validate';
import { AISetupStep, GitHubStarStep, OnboardingFlow, VoiceStep } from '@mimik/ui';
import { useMicrophoneGate } from './hooks/use-microphone-gate';
import { requestMicrophoneAccess } from './lib/request-microphone-access';

const ONBOARDING_STEPS = [AISetupStep, VoiceStep, GitHubStarStep];

export function DesktopOnboarding({ onFinish }: { onFinish: () => void }) {
  const microphone = useMicrophoneGate();
  return (
    <OnboardingFlow
      steps={ONBOARDING_STEPS}
      validate={validateApiKey}
      requestMicrophoneAccess={requestMicrophoneAccess}
      microphoneAccess={microphone.row}
      microphoneLocked={microphone.locked}
      onFinish={onFinish}
    />
  );
}
