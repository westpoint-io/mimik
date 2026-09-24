// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMessageMock = vi.fn().mockResolvedValue({ stepId: 'step-1' });
vi.mock('@/lib/messaging', () => ({ sendMessage: (...args: unknown[]) => sendMessageMock(...args) }));

import { InputSession } from '../input-session';

function field(value: string, label = 'Email'): HTMLInputElement {
  const input = document.createElement('input');
  input.setAttribute('aria-label', label);
  input.value = value;
  document.body.appendChild(input);
  return input;
}

function lastUpdate(): { description: string; inputValue?: string } {
  const calls = sendMessageMock.mock.calls.filter(([name]) => name === 'updateInputStep');
  return calls.at(-1)?.[1] as { description: string; inputValue?: string };
}

function session(): InputSession {
  const s = new InputSession('guide-1');
  s.stepId = 'step-1';
  return s;
}

describe('InputSession describes typing through i18n', () => {
  beforeEach(() => {
    sendMessageMock.mockClear();
    document.body.innerHTML = '';
  });

  it('asks for the typed-value message with the value first and the label second', () => {
    session().update(field('bonjour'));
    expect(lastUpdate().description).toBe('steps.typeValueInto[bonjour,Email]');
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
    wrapper.setAttribute('data-mimik-blur', '');
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
