import { PORT_NAME } from './constants';
import { openPort } from './open-port';
import type { PanelAiUpdate, PanelCardUpdate, PanelStateUpdate, PanelVoiceUpdate } from './types';

export function connectToBackground(
  callbacks: {
    onStateUpdate: (update: PanelStateUpdate) => void;
    onConnect: () => void;
    onDisconnect: () => void;
    onVoiceUpdate?: (update: PanelVoiceUpdate) => void;
    onAiUpdate?: (update: PanelAiUpdate) => void;
    onCardUpdate?: (update: PanelCardUpdate) => void;
  },
  name = PORT_NAME,
): () => void {
  return openPort(
    name,
    (msg) => {
      if (msg.type === 'STATE_UPDATE') {
        callbacks.onStateUpdate(msg);
      } else if (msg.type === 'VOICE_UPDATE') {
        callbacks.onVoiceUpdate?.(msg);
      } else if (msg.type === 'AI_UPDATE') {
        callbacks.onAiUpdate?.(msg);
      } else if (msg.type === 'CARD_UPDATE') {
        callbacks.onCardUpdate?.(msg);
      }
    },
    callbacks.onConnect,
    callbacks.onDisconnect,
  );
}
