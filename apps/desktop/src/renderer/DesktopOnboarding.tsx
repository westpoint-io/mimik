import { validateApiKey } from '@mimik/core/capture/ai/validate';
import { OnboardingFlow } from '@mimik/ui';
import { useMicrophoneGate } from './hooks/use-microphone-gate';
import { requestMicrophoneAccess } from './lib/request-microphone-access';
import { StartAtLoginRow } from './onboarding/StartAtLoginRow';
import { TrayCard } from './onboarding/TrayCard';

export function DesktopOnboarding({ onFinish }: { onFinish: () => void }) {
  const microphone = useMicrophoneGate();
  return (
    <OnboardingFlow
      validate={validateApiKey}
      requestMicrophoneAccess={requestMicrophoneAccess}
      microphoneAccess={microphone.row}
      microphoneLocked={microphone.locked}
      extraRows={<StartAtLoginRow />}
      readyAside={<TrayCard />}
      onFinish={onFinish}
    />
  );
}
