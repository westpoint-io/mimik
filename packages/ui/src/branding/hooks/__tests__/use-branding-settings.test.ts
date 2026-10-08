// @vitest-environment jsdom
import { localStorage } from '@mimik/core/env';
import { DEFAULT_BRAND_COLOR } from '@mimik/core/export/branding';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { useBrandingSettings } from '../use-branding-settings';

describe('useBrandingSettings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('keeps the brand color when only the click highlight changes', async () => {
    const { result } = renderHook(() => useBrandingSettings());
    await waitFor(async () => expect((await localStorage.get(['brandColor'])).brandColor).toBe(DEFAULT_BRAND_COLOR));

    act(() => result.current.setTargetColor('#3B82F6'));

    expect(result.current.brandColor).toBe(DEFAULT_BRAND_COLOR);
    expect(await localStorage.get(['brandColor', 'targetColor'])).toEqual({
      brandColor: DEFAULT_BRAND_COLOR,
      targetColor: '#3B82F6',
    });
  });

  it('carries a highlight color picked before the split over as the brand color', async () => {
    await localStorage.set({ targetColor: '#F43F5E' });
    const { result } = renderHook(() => useBrandingSettings());
    await waitFor(async () => expect((await localStorage.get(['brandColor'])).brandColor).toBe('#F43F5E'));

    act(() => result.current.setTargetColor('#3B82F6'));

    expect((await localStorage.get(['brandColor'])).brandColor).toBe('#F43F5E');
  });
});
