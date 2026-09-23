import { logger } from '@mimik/core/logger';
import { localVoiceHost } from './local-voice-host';

export function startSidepanelVoiceHost(): void {
  if (import.meta.env.BROWSER !== 'firefox') return;

  void import('./start-voice-host')
    .then(({ startVoiceHost }) => {
      const host = startVoiceHost();
      localVoiceHost.current = host;
      window.addEventListener('pagehide', () => host.surrender());
      logger.debug('voice: sidebar microphone host ready');
    })
    .catch((error) => logger.error('voice: sidebar microphone host failed to load', error));
}
