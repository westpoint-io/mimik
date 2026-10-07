import { broadcastTo } from './broadcast-to';
import { lastVoice, observerPorts, panelPorts } from './state';
import type { PanelVoiceUpdate } from './types';

export function broadcastVoiceToPanel(update: PanelVoiceUpdate): void {
  lastVoice.current = update;
  broadcastTo(panelPorts, update);
  broadcastTo(observerPorts, update);
}
