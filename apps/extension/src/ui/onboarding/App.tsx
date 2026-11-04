import { OnboardingFlow } from '@mimik/ui';
import { useCardOnIcon } from '@/ui/shared/hooks/use-card-on-icon';
import { useRecordingCard } from '@/ui/shared/hooks/use-recording-card';
import { requestMicrophoneAccess } from '@/ui/shared/lib/request-microphone-access';
import { validateApiKey } from '@/ui/shared/lib/validate-api-key';
import { openMimik } from './lib/open-mimik';
import { BlurRow } from './steps/BlurRow';
import { PinCard } from './steps/PinCard';
import { RecordingStep } from './steps/RecordingStep';

export function OnboardingApp() {
  const card = useRecordingCard();
  useCardOnIcon();

  return (
    <OnboardingFlow
      validate={validateApiKey}
      requestMicrophoneAccess={requestMicrophoneAccess}
      voice={import.meta.env.BROWSER !== 'firefox'}
      extraRows={<BlurRow />}
      extraStep={(nav) => <RecordingStep {...nav} />}
      readyAside={<PinCard />}
      onFinish={() => void openMimik(card)}
    />
  );
}
