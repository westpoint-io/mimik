import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMessageToTab = vi.fn();
const stored = vi.fn();

vi.mock('@/lib/browser-api/send-message-to-tab', () => ({
  sendMessageToTab: (tabId: number, msg: unknown) => sendMessageToTab(tabId, msg),
}));
vi.mock('@/lib/browser-api/local-storage', () => ({ localStorage: { get: () => stored() } }));

import { withCardHidden } from '../card';

function typesSent(): string[] {
  return sendMessageToTab.mock.calls.map(([, msg]) => (msg as { type: string }).type);
}

beforeEach(() => {
  vi.clearAllMocks();
  stored.mockResolvedValue({ recordingCard: true });
  sendMessageToTab.mockResolvedValue({ hidden: true });
});

describe('withCardHidden', () => {
  it('hides the card for the screenshot and shows it again', async () => {
    const run = vi.fn(async () => {
      expect(typesSent()).toEqual(['HIDE_CARD']);
      return 'done';
    });
    await expect(withCardHidden(4, run)).resolves.toBe('done');
    expect(typesSent()).toEqual(['HIDE_CARD', 'SHOW_CARD']);
  });

  it('shows the card again when the capture throws', async () => {
    await expect(withCardHidden(4, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(typesSent()).toEqual(['HIDE_CARD', 'SHOW_CARD']);
  });

  it('sends nothing with the side panel setting', async () => {
    stored.mockResolvedValue({});
    await withCardHidden(4, async () => undefined);
    expect(typesSent()).toEqual([]);
  });

  it('does not ask to show a card that no frame answered for', async () => {
    sendMessageToTab.mockRejectedValueOnce(new Error('no receiver'));
    await withCardHidden(4, async () => undefined);
    expect(typesSent()).toEqual(['HIDE_CARD']);
  });
});
