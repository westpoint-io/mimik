// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from '#imports';
import type { CaptureSink, CaptureStepData } from '@/core/capture/sink';
import { type CaptureHandle, startCapture } from '../handlers';

vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
}));

let handle: CaptureHandle;
let captured: CaptureStepData[];

const sink: CaptureSink = {
  captureStep: async (data) => {
    captured.push(data);
    return { stepId: `step-${captured.length}` };
  },
  updateInputStep: async () => ({ updated: true }),
  finalizeInputStep: async () => ({ updated: true }),
};

function pressCtrlK(on: Element) {
  on.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
}

async function settle(turns = 16) {
  for (let i = 0; i < turns; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await browser.storage.local.clear();
  document.body.innerHTML = '';
  captured = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    setTimeout(() => cb(0), 0);
    return 0;
  });
});

afterEach(() => {
  handle?.stop();
  vi.unstubAllGlobals();
});

describe('settings changed during a recording', () => {
  it('starts recording shortcuts the moment Record keys is switched on, named with the held keys', async () => {
    handle = startCapture('guide-1', true, sink);
    const button = document.body.appendChild(document.createElement('button'));
    await settle();

    pressCtrlK(button);
    await settle();
    expect(captured).toHaveLength(0);

    await browser.storage.local.set({ recordKeys: true });
    pressCtrlK(button);
    await settle();

    expect(captured.map((step) => step.action)).toEqual(['keydown:Ctrl+K']);
  });

  it('ignores setting changes once the recording stops', async () => {
    handle = startCapture('guide-1', true, sink);
    const button = document.body.appendChild(document.createElement('button'));
    await handle.stop();

    await browser.storage.local.set({ recordKeys: true });
    pressCtrlK(button);
    await settle();

    expect(captured).toHaveLength(0);
  });
});
