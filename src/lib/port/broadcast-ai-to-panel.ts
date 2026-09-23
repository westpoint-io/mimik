import { broadcastTo } from './broadcast-to';
import { panelPorts } from './state';
import type { PanelAiUpdate } from './types';

export function broadcastAiToPanel(update: PanelAiUpdate): void {
  broadcastTo(panelPorts, update);
}
