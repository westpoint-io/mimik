// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageRedactor } from '@/core/blur/redactor';
import { extractDOMContext } from '@/core/capture/dom/context';
import { isRedactedField } from '@/core/capture/dom/element-utils';
import type { CaptureSink } from '@/core/capture/sink';
import { sendMessage } from '@/lib/messaging';
import { startCapture } from '../handlers';
import { InputSession } from '../input-session';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
}));

const updateInputStep = vi.fn();
const sink: CaptureSink = {
  captureStep: vi.fn(async () => ({ stepId: 'step-1' })),
  updateInputStep,
  finalizeInputStep: vi.fn(async () => ({ updated: true })),
};

function blurredInput(value: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'text';
  el.value = value;
  el.setAttribute('aria-label', 'API key');
  el.setAttribute('data-mimik-redact', 'field');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
  updateInputStep.mockReset();
  updateInputStep.mockResolvedValue({ updated: true });
});

describe('isRedactedField', () => {
  it('reports a field the scanner blurred', () => {
    expect(isRedactedField(blurredInput('sk-live-1'))).toBe(true);
  });

  it('reports a field inside a manually blurred container', () => {
    const box = document.createElement('div');
    box.setAttribute('data-mimik-redact', 'manual');
    const el = document.createElement('input');
    box.appendChild(el);
    document.body.appendChild(box);
    expect(isRedactedField(el)).toBe(true);
  });

  it('does not report an unblurred field', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    expect(isRedactedField(el)).toBe(false);
  });
});

describe('DOM context sent to the AI', () => {
  it('masks a blurred value', () => {
    const el = blurredInput('sk-live-abcdef');
    expect(extractDOMContext(el, 'input').target.value).toBe('***');
  });

  it('still carries an unblurred value', () => {
    const el = document.createElement('input');
    el.type = 'text';
    el.value = 'ada@example.com';
    document.body.appendChild(el);
    expect(extractDOMContext(el, 'input').target.value).toBe('value=ada@example.com');
  });
});

describe('InputSession.update on a blurred field', () => {
  it('stores no value and keeps it out of the description', async () => {
    const el = blurredInput('sk-live-abcdef');
    const session = new InputSession('guide-1', sink);
    await session.start(el);
    updateInputStep.mockClear();

    session.update(el);

    const [payload] = updateInputStep.mock.calls[0]!;
    expect(payload).not.toHaveProperty('inputValue');
    expect(JSON.stringify(payload)).not.toContain('sk-live-abcdef');
  });

  it('still stores the value for an unblurred field', async () => {
    const el = document.createElement('input');
    el.type = 'text';
    el.value = 'ada';
    el.setAttribute('aria-label', 'Name');
    document.body.appendChild(el);
    const session = new InputSession('guide-1', sink);
    await session.start(el);
    updateInputStep.mockClear();

    session.update(el);

    const [payload] = updateInputStep.mock.calls[0]!;
    expect(payload).toMatchObject({ inputValue: 'ada' });
  });
});

describe('recording a step on a field Smart Blur covered', () => {
  it('keeps the field blurred when the step screenshot is taken', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      setTimeout(() => cb(0), 0);
      return 0;
    });
    const field = document.createElement('input');
    field.type = 'text';
    field.value = 'ada@example.com';
    field.setAttribute('aria-label', 'Email');
    document.body.appendChild(field);
    const redactor = new PageRedactor();
    redactor.start(['email']);
    redactor.detach();

    const filters: string[] = [];
    vi.mocked(sendMessage).mockImplementation((async (type: string) => {
      if (type === 'captureStep') filters.push(field.style.filter);
      return { stepId: 'step-1' };
    }) as unknown as typeof sendMessage);
    const handle = startCapture('guide-1');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
    Object.defineProperty(click, 'isTrusted', { configurable: true, value: true });
    field.dispatchEvent(click);
    for (let i = 0; i < 16; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    handle.stop();
    vi.unstubAllGlobals();

    expect(filters).toEqual(['blur(10px)']);
  });
});
