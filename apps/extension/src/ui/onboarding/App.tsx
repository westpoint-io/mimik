import { OnboardingFlow } from '@mimik/ui';
import { requestMicrophoneAccess } from '@/ui/shared/lib/request-microphone-access';
import { validateApiKey } from '@/ui/shared/lib/validate-api-key';
import { openMimik } from './lib/open-mimik';
import { BlurRow } from './steps/BlurRow';
import { PinCard } from './steps/PinCard';

export function OnboardingApp() {
  return (
    <OnboardingFlow
      validate={validateApiKey}
      requestMicrophoneAccess={requestMicrophoneAccess}
      voice={import.meta.env.BROWSER !== 'firefox'}
      extraRows={<BlurRow />}
      readyAside={<PinCard />}
      onFinish={() => void openMimik()}
    />
  );
}
