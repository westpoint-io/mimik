import { logger } from '@mimik/core/logger';
import { setLocalVoiceHost } from './voice-local';

export function startSidepanelVoiceHost(): void {
  if (import.meta.env.BROWSER !== 'firefox') return;

  void import('./voice-host')
    .then(({ startVoiceHost }) => {
      const host = startVoiceHost();
      setLocalVoiceHost(host);
      window.addEventListener('pagehide', () => host.surrender());
      logger.debug('voice: sidebar microphone host ready');
    })
    .catch((error) => logger.error('voice: sidebar microphone host failed to load', error));
}
