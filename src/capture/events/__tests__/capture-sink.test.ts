// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaptureSink, CaptureStepData } from '@/core/capture/sink';
import { type CaptureHandle, startCapture } from '../handlers';

vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
}));

let handle: CaptureHandle;
let captured: CaptureStepData[];

function recordingSink(): CaptureSink {
  return {
    captureStep: async (data) => {
      captured.push(data);
      return { stepId: `step-${captured.length}` };
    },
    updateInputStep: async () => ({ updated: true }),
    finalizeInputStep: async () => ({ updated: true }),
  };
}

function place(tag: string): HTMLElement {
  const el = document.createElement(tag);
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ x: 4, y: 6, top: 6, left: 4, right: 124, bottom: 46, width: 120, height: 40 }),
  });
  document.body.appendChild(el);
  return el;
}

function userClick(el: Element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
  Object.defineProperty(event, 'isTrusted', { configurable: true, value: true });
  el.dispatchEvent(event);
}

async function settle(turns = 16) {
  for (let i = 0; i < turns; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
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

describe('startCapture against a sink that is not the extension', () => {
  it('emits steps into whatever sink it is handed', async () => {
    handle = startCapture('guide-1', true, recordingSink());
    const button = place('button');
    button.textContent = 'Save';

    userClick(button);
    await settle();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ guideId: 'guide-1', action: 'click' });
    expect(captured[0]!.elementMeta.source).toBe('dom');
  });

  it('never reaches for extension messaging to do it', async () => {
    const messaging = await import('@/lib/messaging');
    const spy = vi.spyOn(messaging, 'sendMessage');

    handle = startCapture('guide-2', true, recordingSink());
    userClick(place('button'));
    await settle();

    expect(captured).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
  });
});
