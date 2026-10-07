import { AISetupStep, GitHubStarStep, OnboardingFlow, VoiceStep } from '@mimik/ui';
import { requestMicrophoneAccess } from '@/ui/shared/lib/request-microphone-access';
import { validateApiKey } from '@/ui/shared/lib/validate-api-key';
import { openMimik } from './lib/open-mimik';
import { PinExtensionStep } from './steps/PinExtensionStep';
import { SmartBlurStep } from './steps/SmartBlurStep';

const CONFIG_STEPS =
  import.meta.env.BROWSER === 'firefox'
    ? [AISetupStep, SmartBlurStep, PinExtensionStep, GitHubStarStep]
    : [AISetupStep, VoiceStep, SmartBlurStep, PinExtensionStep, GitHubStarStep];

export function OnboardingApp() {
  return (
    <OnboardingFlow
      steps={CONFIG_STEPS}
      validate={validateApiKey}
      requestMicrophoneAccess={requestMicrophoneAccess}
      onFinish={() => void openMimik()}
    />
  );
}
