// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateInputStep = vi.fn().mockResolvedValue({ updated: true });
const sink = {
  captureStep: vi.fn().mockResolvedValue({ stepId: 'step-1' }),
  updateInputStep,
  finalizeInputStep: vi.fn().mockResolvedValue({ updated: true }),
} as unknown as CaptureSink;

import type { CaptureSink } from '@/core/capture/sink';
import { InputSession } from '../input-session';

function field(value: string, label = 'Email'): HTMLInputElement {
  const input = document.createElement('input');
  input.setAttribute('aria-label', label);
  input.value = value;
  document.body.appendChild(input);
  return input;
}

function lastUpdate(): { description: string; inputValue?: string } {
  return updateInputStep.mock.calls.at(-1)?.[0] as { description: string; inputValue?: string };
}

function session(): InputSession {
  const s = new InputSession('guide-1', sink);
  s.stepId = 'step-1';
  return s;
}

describe('InputSession describes typing through i18n', () => {
  beforeEach(() => {
    updateInputStep.mockClear();
    document.body.innerHTML = '';
  });

  it('asks for the typed-value message with the value first and the label second', () => {
    session().update(field('bonjour'));
    expect(lastUpdate().description).toBe('steps.typeValueInto[bonjour,Email]');
  });

  it('names only what was typed when nothing labels the field', () => {
    const input = document.createElement('input');
    input.value = 'bonjour';
    document.body.appendChild(input);

    session().update(input);

    expect(lastUpdate().description).toBe('steps.type[bonjour]');
  });

  it('asks for the cleared-field message with just the label', () => {
    session().update(field(''));
    expect(lastUpdate().description).toBe('steps.clearField[Email]');
  });

  it('sends the typed value alongside the description, for redaction on export', () => {
    session().update(field('bonjour'));
    expect(lastUpdate().inputValue).toBe('bonjour');
  });

  it('sends no value for a cleared field', () => {
    session().update(field(''));
    expect(lastUpdate().inputValue).toBeUndefined();
  });

  it('describes a password field without echoing the value', () => {
    const input = document.createElement('input');
    input.type = 'password';
    input.setAttribute('aria-label', 'Password');
    input.value = 'hunter2';
    document.body.appendChild(input);

    session().update(input);
    const update = lastUpdate();
    expect(update.description).toBe('steps.typeSecret');
    expect(update.description).not.toContain('hunter2');
    expect(update.inputValue).toBeUndefined();
  });

  it('describes a blurred field without echoing the value', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-mimik-redact', '');
    const input = field('bonjour', 'Notes');
    wrapper.appendChild(input);
    document.body.appendChild(wrapper);

    session().update(input);
    const update = lastUpdate();
    expect(update.description).toBe('steps.typeInto[Notes]');
    expect(update.description).not.toContain('bonjour');
    expect(update.inputValue).toBeUndefined();
  });
});

describe('InputSession reports whether anything was typed', () => {
  const finalizeInputStep = sink.finalizeInputStep as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    finalizeInputStep.mockClear();
    document.body.innerHTML = '';
  });

  it('marks a field that was clicked and left as untyped', async () => {
    const s = new InputSession('guide-1', sink);
    await s.start(field(''));
    await s.finalize();
    expect(finalizeInputStep).toHaveBeenCalledWith(expect.objectContaining({ typed: false }));
  });

  it('marks a field that received input as typed', async () => {
    const s = new InputSession('guide-1', sink);
    const input = field('');
    await s.start(input);
    input.value = 'bonjour';
    s.update(input);
    await s.finalize();
    expect(finalizeInputStep).toHaveBeenCalledWith(expect.objectContaining({ typed: true }));
  });
});

describe('InputSession titles a field as a click until something is typed', () => {
  beforeEach(() => {
    updateInputStep.mockClear();
    document.body.innerHTML = '';
  });

  it('titles the step as a click as soon as the field is clicked', async () => {
    await new InputSession('guide-1', sink).start(field(''));
    expect(lastUpdate().description).toBe('steps.click[Email]');
  });

  it('retitles the step once something is typed', async () => {
    const s = new InputSession('guide-1', sink);
    const input = field('');
    await s.start(input);
    input.value = 'bonjour';
    s.update(input);
    expect(lastUpdate().description).toBe('steps.typeValueInto[bonjour,Email]');
  });
});
