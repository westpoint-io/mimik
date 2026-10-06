import { i18n } from '@mimik/core/env';
import { MicrophoneAccessRow } from '@mimik/ui';
import { useMicrophoneAccess } from './use-microphone-access';

export function useMicrophoneGate() {
  const { access, request } = useMicrophoneAccess();
  const refused = access === 'denied';
  const row =
    access && access !== 'granted' ? (
      <MicrophoneAccessRow
        refused={refused}
        hint={i18n.t(refused ? 'desktop.micAccessRefused' : 'desktop.micAccessAsk')}
        action={i18n.t(refused ? 'desktop.micAccessOpen' : 'settings.microphoneAccessAllow')}
        external={refused}
        onRequest={() => void request()}
      />
    ) : null;
  return { row, locked: access !== 'granted' };
}
