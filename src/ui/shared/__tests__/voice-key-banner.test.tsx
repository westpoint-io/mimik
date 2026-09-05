// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: Record<string, unknown> = {};

vi.mock('@/lib/browser-api', () => ({
  localStorage: {
    get: (keys: string[]) =>
      Promise.resolve(Object.fromEntries(keys.filter((key) => key in store).map((key) => [key, store[key]]))),
    set: (items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    },
  },
}));

import SettingsView from '../SettingsView';

function configureAzureVoice(overrides: Record<string, unknown> = {}) {
  Object.assign(store, {
    voiceProvider: 'azure',
    voiceApiKey: 'az-key',
    voiceBaseUrl: 'https://my-res.openai.azure.com',
    voiceModel: 'whisper',
    ...overrides,
  });
}

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe('voice narration key banner', () => {
  it('does not warn about a missing key when an azure setup is complete', async () => {
    configureAzureVoice();
    render(<SettingsView />);

    await waitFor(() => expect((screen.getByDisplayValue('az-key') as HTMLInputElement).value).toBe('az-key'));
    expect(screen.queryByText('settings.voiceNoKey')).toBeNull();
  });

  it('still warns when the azure setup has no deployment name', async () => {
    configureAzureVoice({ voiceModel: '' });
    render(<SettingsView />);

    await waitFor(() => expect(screen.getByText('settings.voiceNoKey')).toBeTruthy());
  });
});
