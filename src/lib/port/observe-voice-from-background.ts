import { OBSERVER_PORT_NAME } from './constants';
import { openPort } from './open-port';
import type { PanelVoiceUpdate } from './types';

export function observeVoiceFromBackground(
  onVoiceUpdate: (update: PanelVoiceUpdate) => void,
  onConnect?: () => void,
): () => void {
  return openPort(
    OBSERVER_PORT_NAME,
    (msg) => {
      if (msg.type === 'VOICE_UPDATE') onVoiceUpdate(msg);
    },
    onConnect,
  );
}
