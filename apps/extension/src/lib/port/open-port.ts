import { logger } from '@mimik/core/logger';
import { browser } from '#imports';
import type { Port, PortMessage } from './types';

export function openPort(
  name: string,
  onPortMessage: (msg: PortMessage) => void,
  onConnect?: () => void,
  onDisconnect?: () => void,
): () => void {
  let port: Port | null = null;
  let destroyed = false;

  function connect() {
    if (destroyed) return;

    try {
      port = browser.runtime.connect({ name });
      logger.debug('Port connected to background', name);
      onConnect?.();

      port.onMessage.addListener(onPortMessage);

      port.onDisconnect.addListener(() => {
        port = null;
        if (!destroyed) {
          logger.debug('Port disconnected, reconnecting in 1s...');
          onDisconnect?.();
          setTimeout(connect, 1000);
        }
      });
    } catch {
      if (!destroyed) {
        logger.debug('Port connect failed, retrying in 1s...');
        setTimeout(connect, 1000);
      }
    }
  }

  connect();

  return () => {
    destroyed = true;
    port?.disconnect();
    port = null;
  };
}
