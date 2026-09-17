import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { PanelStateUpdate, PanelVoiceUpdate } from '../port';

type PanelMessage = PanelStateUpdate | PanelVoiceUpdate;

class FakePort {
  received: PanelMessage[] = [];
  broken = false;
  private disconnectHandlers: Array<() => void> = [];

  constructor(public name: string) {}

  onMessage = { addListener: () => {} };

  onDisconnect = {
    addListener: (handler: () => void) => {
      this.disconnectHandlers.push(handler);
    },
  };

  postMessage(message: PanelMessage) {
    if (this.broken) throw new Error('port is gone');
    this.received.push(message);
  }

  disconnect() {
    for (const handler of this.disconnectHandlers) handler();
  }
}

const STATE: PanelStateUpdate = {
  type: 'STATE_UPDATE',
  state: 'IDLE',
  stepCount: 0,
  currentGuideId: null,
  pauseReason: null,
};
const TRANSCRIBING: PanelVoiceUpdate = { type: 'VOICE_UPDATE', phase: 'transcribing' };
const DONE: PanelVoiceUpdate = { type: 'VOICE_UPDATE', phase: 'idle', narrated: 3 };

const connectListeners: Array<(port: FakePort) => void> = [];

let port: typeof import('../port');
let onPanelConnect: Mock<(port: unknown) => void>;

async function loadBackground() {
  connectListeners.length = 0;
  vi.resetModules();

  const { fakeBrowser } = await import('wxt/testing');
  const onConnect = fakeBrowser.runtime.onConnect as unknown as {
    addListener: (handler: (port: FakePort) => void) => void;
  };
  onConnect.addListener = (handler) => {
    connectListeners.push(handler);
  };

  port = await import('../port');
  onPanelConnect = vi.fn<(port: unknown) => void>();
  port.setupPortListener(onPanelConnect);
}

function connect(name: string): FakePort {
  const fake = new FakePort(name);
  for (const listener of connectListeners) listener(fake);
  return fake;
}

beforeEach(loadBackground);

describe('observer ports', () => {
  it('follow narration without being handed the capture state feed', () => {
    const observer = connect('mimik-panel-observer');

    port.broadcastStateToPanel(STATE);
    port.broadcastVoiceToPanel(TRANSCRIBING);

    expect(observer.received).toEqual([TRANSCRIBING]);
  });

  it('stay out of the side panel lifecycle that cancels a Guide Me run', () => {
    connect('mimik-panel-observer');
    expect(onPanelConnect).not.toHaveBeenCalled();

    connect('mimik-panel');
    expect(onPanelConnect).toHaveBeenCalledTimes(1);
  });

  it('are caught up on the narration already in flight when they arrive late', () => {
    port.broadcastVoiceToPanel(TRANSCRIBING);
    const observer = connect('mimik-panel-observer');

    expect(observer.received).toEqual([TRANSCRIBING]);
  });

  it('hear nothing on arrival when no narration has been reported yet', () => {
    expect(connect('mimik-panel-observer').received).toEqual([]);
  });

  it('are replayed only the latest phase, not the whole history', () => {
    port.broadcastVoiceToPanel(TRANSCRIBING);
    port.broadcastVoiceToPanel(DONE);

    expect(connect('mimik-panel-observer').received).toEqual([DONE]);
  });

  it('stop receiving once they disconnect', () => {
    const observer = connect('mimik-panel-observer');
    observer.disconnect();

    port.broadcastVoiceToPanel(TRANSCRIBING);

    expect(observer.received).toEqual([]);
  });

  it('are dropped when posting to them throws', () => {
    const observer = connect('mimik-panel-observer');
    observer.broken = true;
    port.broadcastVoiceToPanel(TRANSCRIBING);

    observer.broken = false;
    port.broadcastVoiceToPanel(DONE);

    expect(observer.received).toEqual([]);
  });
});

describe('panel ports', () => {
  it('keep receiving both feeds', () => {
    const panel = connect('mimik-panel');

    port.broadcastStateToPanel(STATE);
    port.broadcastVoiceToPanel(TRANSCRIBING);

    expect(panel.received).toEqual([STATE, TRANSCRIBING]);
  });

  it('are not replayed to on connect, since the background greets them itself', () => {
    port.broadcastVoiceToPanel(TRANSCRIBING);

    expect(connect('mimik-panel').received).toEqual([]);
  });
});

describe('unknown ports', () => {
  it('are ignored entirely', () => {
    const stranger = connect('something-else');

    port.broadcastStateToPanel(STATE);
    port.broadcastVoiceToPanel(TRANSCRIBING);

    expect(stranger.received).toEqual([]);
    expect(onPanelConnect).not.toHaveBeenCalled();
  });
});
