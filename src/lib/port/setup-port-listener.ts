import { browser } from '#imports';
import { OBSERVER_PORT_NAME, PORT_NAME } from './constants';
import { postTo } from './post-to';
import { lastVoice, observerPorts, panelPorts } from './state';
import type { Port } from './types';

export function setupPortListener(onPanelConnect?: (port: Port) => void) {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === OBSERVER_PORT_NAME) {
      observerPorts.add(port);
      if (lastVoice.current) postTo(port, lastVoice.current);
      port.onDisconnect.addListener(() => {
        observerPorts.delete(port);
      });
      return;
    }

    if (port.name !== PORT_NAME) return;

    panelPorts.add(port);
    onPanelConnect?.(port);

    port.onDisconnect.addListener(() => {
      panelPorts.delete(port);
    });
  });
}
