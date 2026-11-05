// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { localStorage } from '@mimik/core/env';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiKeysState } from '../../hooks/use-api-keys';
import { AiSettings } from '../AiSettings';

Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const keys: ApiKeysState = {
  loaded: true,
  keys: {},
  server: { url: '', protocol: 'openai', apiKey: '', headers: [] },
  setKey: () => {},
  setServer: () => {},
};

describe('AiSettings', () => {
  beforeEach(async () => {
    await localStorage.set({ aiForSteps: false, aiForGuide: false, aiPrompts: {}, aiLanguage: 'en' });
  });

  it('renders the prompts row once', () => {
    render(<AiSettings keys={keys} />);
    expect(screen.getAllByRole('button', { name: 'editor.edit: settings.aiForSteps' })).toHaveLength(1);
  });

  it('places the prompts row after the unused note', async () => {
    render(<AiSettings keys={keys} />);
    const note = await waitFor(() => screen.getByText('settings.aiUnusedNote'));
    const button = screen.getByRole('button', { name: 'editor.edit: settings.aiForSteps' });
    expect(note.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reloads the language when the window gains focus', async () => {
    render(<AiSettings keys={keys} />);
    await localStorage.set({ aiLanguage: 'fr' });
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(screen.getByText('Français')).toBeInTheDocument());
  });

  it('updates the card language when the dialog saves a different one', async () => {
    render(<AiSettings keys={keys} />);
    fireEvent.click(screen.getByRole('button', { name: 'editor.edit: settings.aiForSteps' }));
    const trigger = await screen.findByRole('combobox', { name: 'settings.aiLanguage' });
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('option', { name: 'Español' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(async () => expect((await localStorage.get(['aiLanguage'])).aiLanguage).toBe('es'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Español')).toBeInTheDocument();
  });

  it('keeps an empty custom model input across a window focus', async () => {
    await localStorage.set({ aiModel: 'gpt-4o-mini' });
    render(<AiSettings keys={keys} />);
    const trigger = (await screen.findByText('GPT-4o Mini')).closest('button') as HTMLElement;
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('option', { name: 'Custom' }));
    const input = screen.getByLabelText('settings.modelCustom') as HTMLInputElement;
    expect(input.value).toBe('');
    window.dispatchEvent(new Event('focus'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'my-model' } });
    await waitFor(async () => expect((await localStorage.get(['aiModel'])).aiModel).toBe('my-model'));
  });
});
