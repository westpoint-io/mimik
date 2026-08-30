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

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe('settings with a provider this build does not know', () => {
  it('still renders instead of blanking the page', async () => {
    store.aiProvider = 'some-future-provider';
    store.aiApiKey = 'sk-left-over';
    store.aiModel = 'mystery-model';

    render(<SettingsView />);

    await waitFor(() => expect(screen.getByText('settings.title')).toBeTruthy());
  });

  it('falls back to openai so the picker stays usable', async () => {
    store.aiProvider = 'some-future-provider';

    render(<SettingsView />);

    await waitFor(() => expect(screen.getByText('settings.title')).toBeTruthy());
    const picker = document.querySelector('[data-slot="select-value"]');
    expect(picker?.textContent).toBe('OpenAI');
  });
});
