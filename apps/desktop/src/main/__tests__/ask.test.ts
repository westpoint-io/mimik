import type { WebContents } from 'electron';
import { describe, expect, it, vi } from 'vitest';

const listeners = new Map<string, (event: unknown, result: unknown) => void>();

vi.mock('electron', () => ({
  ipcMain: {
    once: (channel: string, listener: (event: unknown, result: unknown) => void) => listeners.set(channel, listener),
    removeAllListeners: (channel: string) => listeners.delete(channel),
  },
}));

import { ask } from '../ask';

function renderer(reply: unknown): WebContents {
  return {
    isDestroyed: () => false,
    send: (_channel: string, replyChannel: string) => listeners.get(replyChannel)?.({}, reply),
  } as unknown as WebContents;
}

describe('ask', () => {
  it('resolves with what the renderer answered', async () => {
    await expect(ask(renderer('guide-1'), 'mimik:capture:createGuide')).resolves.toBe('guide-1');
  });

  it('rejects when the renderer answered with the error its handler threw', async () => {
    await expect(ask(renderer({ error: 'QuotaExceededError' }), 'mimik:capture:createGuide')).rejects.toThrow(
      'mimik:capture:createGuide: QuotaExceededError',
    );
  });
});
