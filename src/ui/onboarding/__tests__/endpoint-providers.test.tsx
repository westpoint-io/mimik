// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  getActiveTab: vi.fn().mockResolvedValue(undefined),
  openSidebar: vi.fn(),
  requestHostPermissions: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/offscreen', () => ({ openMicPermissionPage: vi.fn().mockResolvedValue(undefined) }));

import OnboardingApp from '../App';

async function openAiStep() {
  render(<OnboardingApp />);
  fireEvent.click(screen.getAllByText('onboarding.getStarted')[0]);
  await screen.findByText('onboarding.aiTitle');
}

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe('onboarding with an endpoint-driven provider', () => {
  it('asks for the endpoint when the provider needs one', async () => {
    store.aiProvider = 'azure';
    await openAiStep();

    await waitFor(() => expect(screen.getByPlaceholderText('https://your-resource.openai.azure.com')).toBeTruthy());
  });

  it('offers a free-text model box, since it cannot know the user deployment names', async () => {
    store.aiProvider = 'azure';
    await openAiStep();

    await waitFor(() => expect(screen.getByLabelText('settings.modelCustom')).toBeTruthy());
  });

  it('keeps the deployment name the user typed', async () => {
    store.aiProvider = 'azure';
    await openAiStep();

    const field = await waitFor(() => screen.getByLabelText('settings.modelCustom') as HTMLInputElement);
    fireEvent.change(field, { target: { value: 'my-deployment' } });

    await waitFor(() => expect(store.aiModel).toBe('my-deployment'));
  });

  it('does not ask a plain openai user for an endpoint', async () => {
    store.aiProvider = 'openai';
    await openAiStep();

    await waitFor(() => expect(screen.queryByPlaceholderText('https://your-resource.openai.azure.com')).toBeNull());
  });
});
