import { broadcastTo } from './broadcast-to';
import { panelPorts } from './state';
import type { PanelCardUpdate } from './types';

export function broadcastCardToPanel(update: PanelCardUpdate): void {
  broadcastTo(panelPorts, update);
}
