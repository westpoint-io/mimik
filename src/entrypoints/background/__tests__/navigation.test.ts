import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { captureMachine } from '@/core/capture/machine';

let actor: ReturnType<typeof createActor<typeof captureMachine>>;

const { listeners, capture } = vi.hoisted(() => {
  const map = new Map<string, (...args: unknown[]) => unknown>();
  return {
    listeners: map,
    capture: (name: string) => (fn: (...args: unknown[]) => unknown) => map.set(name, fn),
  };
});

const injectContentScript = vi.fn();
const sendMessageToTab = vi.fn();

vi.mock('@/lib/browser-api', () => ({
  onNavigationCompleted: capture('navigated'),
  onHistoryStateUpdated: capture('pushState'),
  onTabActivated: capture('tabActivated'),
  onTabUpdated: capture('tabUpdated'),
  getTab: (id: number) => Promise.resolve({ id, url: 'https://app.test' }),
  sendMessageToTab: (...args: unknown[]) => sendMessageToTab(...args),
}));

vi.mock('../actor', () => ({ getActor: () => actor, waitUntilReady: () => Promise.resolve() }));
vi.mock('../tab-manager', () => ({
  injectContentScript: (id: number) => injectContentScript(id),
  isInjectableTab: () => true,
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { registerNavigationListeners } from '../navigation';

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  actor = createActor(captureMachine);
  actor.start();
  actor.send({ type: 'START_RECORDING', url: 'https://app.test/a' });
  registerNavigationListeners();
});

function url() {
  return actor.getSnapshot().context.currentUrl;
}

describe('URL tracking', () => {
  it('follows a navigation while recording', async () => {
    await listeners.get('navigated')?.({ frameId: 0, url: 'https://app.test/b' });
    expect(url()).toBe('https://app.test/b');
  });

  it('follows a navigation while paused', async () => {
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'blur' });

    await listeners.get('navigated')?.({ frameId: 0, url: 'https://app.test/b' });

    expect(url()).toBe('https://app.test/b');
  });

  it('follows an SPA route change while paused', async () => {
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'manual' });

    await listeners.get('pushState')?.({ frameId: 0, url: 'https://app.test/c' });

    expect(url()).toBe('https://app.test/c');
  });

  it('ignores a subframe navigation', async () => {
    await listeners.get('navigated')?.({ frameId: 3, url: 'https://ads.test' });
    expect(url()).toBe('https://app.test/a');
  });

  it('ignores navigation once the recording has ended', async () => {
    actor.send({ type: 'STOP_RECORDING' });

    await listeners.get('navigated')?.({ frameId: 0, url: 'https://app.test/b' });

    expect(url()).toBe('');
  });
});

describe('content script injection', () => {
  it('injects into a tab activated while paused', async () => {
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'manual' });
    sendMessageToTab.mockRejectedValue(new Error('no receiving end'));

    await listeners.get('tabActivated')?.({ tabId: 4 });

    expect(injectContentScript).toHaveBeenCalledWith(4);
  });

  it('injects into a tab that finishes loading while paused', async () => {
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'blur' });
    sendMessageToTab.mockRejectedValue(new Error('no receiving end'));

    await listeners.get('tabUpdated')?.(5, { status: 'complete' }, { id: 5, url: 'https://app.test' });

    expect(injectContentScript).toHaveBeenCalledWith(5);
  });

  it('does not inject once the recording has ended', async () => {
    actor.send({ type: 'STOP_RECORDING' });
    sendMessageToTab.mockRejectedValue(new Error('no receiving end'));

    await listeners.get('tabActivated')?.({ tabId: 4 });

    expect(injectContentScript).not.toHaveBeenCalled();
  });
});
