// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { localStorage } from '@mimik/core/env';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiKeysState } from '../../../ai/hooks/use-api-keys';
import { NarrationSettings } from '../NarrationSettings';

Element.prototype.hasPointerCapture = () => false;
Element.prototype.scrollIntoView = () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const keysWith = (server: Partial<ApiKeysState['server']>): ApiKeysState => ({
  loaded: true,
  keys: {},
  server: { url: '', protocol: 'openai', apiKey: '', headers: [], ...server },
  setKey: () => {},
  setServer: () => {},
});

describe('NarrationSettings with the server picked', () => {
  beforeEach(async () => {
    await localStorage.set({ voiceProvider: 'server' });
  });

  it('says the server has no address yet', async () => {
    render(<NarrationSettings keys={keysWith({})} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('settings.noServer');
  });

  it('says the server must speak the OpenAI protocol', async () => {
    render(<NarrationSettings keys={keysWith({ url: 'https://llm.example/v1', protocol: 'anthropic' })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('settings.voiceServerNeedsOpenai');
  });

  it('says nothing once the server is ready', async () => {
    render(<NarrationSettings keys={keysWith({ url: 'https://llm.example/v1' })} />);
    expect(await screen.findByText('settings.transcriptionModel')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
