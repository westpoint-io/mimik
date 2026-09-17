import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryTabs = vi.fn();
const sendMessageToTab = vi.fn();

vi.mock('@/lib/browser-api', () => ({
  executeScript: vi.fn(),
  queryTabs: (...args: unknown[]) => queryTabs(...args),
  sendMessageToTab: (tabId: number, msg: unknown) => sendMessageToTab(tabId, msg),
}));

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  broadcastClearBlur,
  broadcastDismissBlur,
  broadcastStopCaptureAndFlush,
  isInjectableTab,
} from '../tab-manager';

function typesSent(): string[] {
  return sendMessageToTab.mock.calls.map(([, msg]) => (msg as { type: string }).type);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryTabs.mockResolvedValue([
    { id: 1, url: 'https://a.test' },
    { id: 2, url: 'https://b.test' },
  ]);
  sendMessageToTab.mockResolvedValue(undefined);
});

describe('blur broadcasts', () => {
  // Swapping these two silently destroys the masks the user just picked, so the
  // message each one sends is worth pinning by name.
  it('dismiss asks every tab to close the overlay and keep the masks', async () => {
    await broadcastDismissBlur();
    expect(typesSent()).toEqual(['DISMISS_BLUR', 'DISMISS_BLUR']);
  });

  it('clear asks every tab to remove the masks', async () => {
    await broadcastClearBlur();
    expect(typesSent()).toEqual(['CLEAR_BLUR', 'CLEAR_BLUR']);
  });
});

describe('broadcastStopCaptureAndFlush', () => {
  it('waits for every tab to answer before resolving', async () => {
    let answered = 0;
    sendMessageToTab.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            answered++;
            resolve(undefined);
          }, 5);
        }),
    );

    await broadcastStopCaptureAndFlush();

    expect(answered).toBe(2);
    expect(typesSent()).toEqual(['STOP_CAPTURE', 'STOP_CAPTURE']);
  });

  // A tab with no content script rejects, and a frozen one never answers at
  // all — neither may hold the pause open.
  it('resolves even when a tab never answers', async () => {
    sendMessageToTab.mockImplementation(() => new Promise(() => {}));
    await expect(broadcastStopCaptureAndFlush()).resolves.toBeUndefined();
  });

  it('resolves when a tab rejects', async () => {
    sendMessageToTab.mockRejectedValue(new Error('no receiving end'));
    await expect(broadcastStopCaptureAndFlush()).resolves.toBeUndefined();
  });
});

describe('isInjectableTab', () => {
  it.each([
    ['https://example.com', true],
    ['http://localhost:3000', true],
    ['chrome://extensions', false],
    ['chrome-extension://abc/fullview.html', false],
    ['about:blank', false],
    ['', false],
  ])('%s → %s', (url, expected) => {
    expect(isInjectableTab({ url })).toBe(expected);
  });
});
