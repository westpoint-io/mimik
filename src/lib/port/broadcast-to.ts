import { postTo } from './post-to';
import type { Port, PortMessage } from './types';

export function broadcastTo(ports: Set<Port>, message: PortMessage): void {
  for (const port of ports) {
    if (!postTo(port, message)) ports.delete(port);
  }
}
