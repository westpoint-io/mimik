// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { localStorage } from '@mimik/core/env';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceNarrationRow } from '../VoiceNarrationRow';

vi.mock('../../../voice/components/MicrophonePicker', () => ({ MicrophonePicker: () => null }));

Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const SERVER = { aiServerUrl: 'https://llm.example/v1', aiServerProtocol: 'openai' } as const;

const renderRow = () =>
  render(
    <VoiceNarrationRow
      aiProvider="server"
      validate={vi.fn(async () => ({ valid: true }))}
      requestMicrophoneAccess={async () => {}}
    />,
  );

describe('VoiceNarrationRow', () => {
  beforeEach(async () => {
    await localStorage.set({
      voiceEnabled: true,
      voiceProvider: undefined,
      voiceServerModel: '',
      aiServerUrl: '',
      aiServerProtocol: 'openai',
    });
  });

  it('offers OpenAI, Groq and the server in the picker', async () => {
    await localStorage.set(SERVER);
    renderRow();
    fireEvent.keyDown(await screen.findByRole('combobox'), { key: 'ArrowDown' });
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['OpenAI', 'Groq', 'settings.ownServer']);
  });

  it('keeps the server picked once the settings load', async () => {
    await localStorage.set({ ...SERVER, voiceProvider: 'server' });
    renderRow();
    expect(await screen.findByText('settings.transcriptionModel')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await localStorage.get(['voiceProvider'])).voiceProvider).toBe('server');
  });

  it('says the server has no address yet', async () => {
    await localStorage.set({ voiceProvider: 'server' });
    renderRow();
    expect(await screen.findByText('settings.noServer')).toBeInTheDocument();
  });

  it('asks for a key when a hosted provider is picked', async () => {
    await localStorage.set({ ...SERVER, voiceProvider: 'groq' });
    renderRow();
    await waitFor(() => expect(screen.getByText('onboarding.voiceNeedsKey')).toBeInTheDocument());
    expect(screen.queryByText('settings.transcriptionModel')).not.toBeInTheDocument();
  });
});
