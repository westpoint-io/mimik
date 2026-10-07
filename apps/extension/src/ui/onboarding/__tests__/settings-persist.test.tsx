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

const savedKeys = async () =>
  ((await fakeBrowser.storage.local.get('apiKeys')).apiKeys ?? {}) as Record<string, string | undefined>;

function press(label: string) {
  fireEvent.click(screen.getAllByText(label)[0]!);
}

async function goToStep(title: string) {
  render(<OnboardingApp />);
  press('onboarding.getStarted');
  await screen.findByText('onboarding.aiTitle');
  if (title === 'onboarding.aiTitle') return;
  press('common.continue');
  await screen.findByText(title);
}

function apiKeyField() {
  return screen.getByPlaceholderText('sk-...') as HTMLInputElement;
}

beforeEach(async () => {
  for (const key of Object.keys(store)) delete store[key];
  await fakeBrowser.storage.local.clear();
});

describe('onboarding keeps what was typed', () => {
  it('holds on to the narration key when the step is left through Skip', async () => {
    await goToStep('onboarding.voiceTitle');

    fireEvent.change(apiKeyField(), { target: { value: 'sk-narration' } });
    press('common.skip');

    await waitFor(async () => expect((await savedKeys()).openai).toBe('sk-narration'));
  });

  it('holds on to the description key when the step is left through Skip', async () => {
    await goToStep('onboarding.aiTitle');

    fireEvent.change(apiKeyField(), { target: { value: 'sk-descriptions' } });
    press('common.skip');

    await waitFor(async () => expect((await savedKeys()).openai).toBe('sk-descriptions'));
  });

  it('clears the narration key when the field is emptied', async () => {
    await fakeBrowser.storage.local.set({ voiceApiKey: 'sk-old' });
    await goToStep('onboarding.voiceTitle');
    await waitFor(() => expect(apiKeyField().value).toBe('sk-old'));

    fireEvent.change(apiKeyField(), { target: { value: '' } });

    await waitFor(async () => expect((await savedKeys()).openai).toBeUndefined());
  });

  it('clears the description key when the field is emptied', async () => {
    await fakeBrowser.storage.local.set({ aiApiKey: 'sk-old' });
    await goToStep('onboarding.aiTitle');
    await waitFor(() => expect(apiKeyField().value).toBe('sk-old'));

    fireEvent.change(apiKeyField(), { target: { value: '' } });

    await waitFor(async () => expect(await fakeBrowser.storage.local.get('apiKeys')).toEqual({ apiKeys: {} }));
  });

  it('picks up a key changed elsewhere when the tab comes back into view', async () => {
    await goToStep('onboarding.voiceTitle');

    await fakeBrowser.storage.local.set({ apiKeys: { openai: 'sk-set-in-settings' } });
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => expect(apiKeyField().value).toBe('sk-set-in-settings'));
  });
});
