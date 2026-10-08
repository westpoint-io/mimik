// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: Record<string, unknown> = {};

vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: {
    get: (keys: string[]) =>
      Promise.resolve(Object.fromEntries(keys.filter((key) => key in store).map((key) => [key, store[key]]))),
    set: (items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    },
  },
}));
vi.mock('@/lib/browser-api/get-active-tab', () => ({ getActiveTab: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/browser-api/open-sidebar', () => ({ openSidebar: vi.fn() }));
vi.mock('@/lib/browser-api/request-host-permissions', () => ({
  requestHostPermissions: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/offscreen/open-mic-permission-page', () => ({
  openMicPermissionPage: vi.fn().mockResolvedValue(undefined),
}));

import { fakeBrowser } from 'wxt/testing/fake-browser';
import { OnboardingApp } from '../App';

const saved = async (key: string) => (await fakeBrowser.storage.local.get(key))[key];

const savedKeys = async () =>
  ((await fakeBrowser.storage.local.get('apiKeys')).apiKeys ?? {}) as Record<string, string | undefined>;

function press(label: string) {
  fireEvent.click(screen.getAllByText(label)[0]!);
}

async function openAiSetup() {
  render(<OnboardingApp />);
  press('onboarding.getStarted');
  await screen.findByText('onboarding.writeTitle');
  press('onboarding.aiChoiceTitle');
  await screen.findByPlaceholderText('sk-...');
}

function apiKeyField() {
  return screen.getByPlaceholderText('sk-...') as HTMLInputElement;
}

beforeEach(async () => {
  for (const key of Object.keys(store)) delete store[key];
  await fakeBrowser.storage.local.clear();
});

describe('onboarding keeps what was typed', () => {
  it('saves the description key as it is typed and turns AI on for steps', async () => {
    await openAiSetup();

    fireEvent.change(apiKeyField(), { target: { value: 'sk-descriptions' } });

    await waitFor(async () => expect((await savedKeys()).openai).toBe('sk-descriptions'));
    expect(await saved('aiForSteps')).toBe(true);
  });

  it('turns AI off for steps when basic titles are picked', async () => {
    await openAiSetup();

    press('onboarding.basicTitle');

    await waitFor(async () => expect(await saved('aiForSteps')).toBe(false));
  });

  it('clears the description key when the field is emptied', async () => {
    await fakeBrowser.storage.local.set({ aiApiKey: 'sk-old' });
    await openAiSetup();
    await waitFor(() => expect(apiKeyField().value).toBe('sk-old'));

    fireEvent.change(apiKeyField(), { target: { value: '' } });

    await waitFor(async () => expect(await fakeBrowser.storage.local.get('apiKeys')).toEqual({ apiKeys: {} }));
  });

  it('narrates with the same OpenAI key once narration is switched on', async () => {
    await openAiSetup();

    fireEvent.click(screen.getByRole('switch', { name: 'onboarding.voiceToggleTitle' }));

    await waitFor(async () => expect(await saved('voiceEnabled')).toBe(true));
    expect(await saved('voiceProvider')).toBe('openai');
  });

  it('picks up a key changed elsewhere when the tab comes back into view', async () => {
    await openAiSetup();

    await fakeBrowser.storage.local.set({ apiKeys: { openai: 'sk-set-in-settings' } });
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => expect(apiKeyField().value).toBe('sk-set-in-settings'));
  });
});
