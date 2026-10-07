import { broadcastTo } from './broadcast-to';
import { panelPorts } from './state';
import type { PanelStateUpdate } from './types';

export function broadcastStateToPanel(update: PanelStateUpdate): void {
  broadcastTo(panelPorts, update);
}
