import type { Port, PortMessage } from './types';

export function postTo(port: Port, message: PortMessage): boolean {
  try {
    port.postMessage(message);
    return true;
  } catch {
    return false;
  }
}
