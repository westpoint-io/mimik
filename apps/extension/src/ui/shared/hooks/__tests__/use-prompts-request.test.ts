// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { openPromptsEditor, PROMPTS_REQUEST_KEY } from '../../lib/open-prompts-editor';
import { usePromptsRequest } from '../use-prompts-request';

const pending = async () => (await fakeBrowser.storage.local.get(PROMPTS_REQUEST_KEY))[PROMPTS_REQUEST_KEY];

describe('usePromptsRequest', () => {
  beforeEach(async () => {
    await fakeBrowser.storage.local.clear();
    fakeBrowser.runtime.openOptionsPage = vi.fn().mockResolvedValue(undefined);
  });

  it('takes a request made before the page opened', async () => {
    await openPromptsEditor('guide');
    const { result } = renderHook(() => usePromptsRequest(true));
    await waitFor(() => expect(result.current.section).toBe('guide'));
    await waitFor(async () => expect(await pending()).toBeUndefined());
  });

  it('takes a request made while the page is open, and focuses it', async () => {
    const { result } = renderHook(() => usePromptsRequest(true));
    await act(() => openPromptsEditor('steps'));
    await waitFor(() => expect(result.current.section).toBe('steps'));
    expect(fakeBrowser.runtime.openOptionsPage).toHaveBeenCalledOnce();
  });

  it('takes the same section again after it was handled', async () => {
    const { result } = renderHook(() => usePromptsRequest(true));
    await act(() => openPromptsEditor('guide'));
    await waitFor(() => expect(result.current.section).toBe('guide'));
    await waitFor(async () => expect(await pending()).toBeUndefined());
    act(() => result.current.clear());
    expect(result.current.section).toBeNull();
    await act(() => openPromptsEditor('guide'));
    await waitFor(() => expect(result.current.section).toBe('guide'));
  });

  it('leaves the request alone where the dialog cannot open', async () => {
    const { result } = renderHook(() => usePromptsRequest(false));
    await act(() => openPromptsEditor('guide'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.section).toBeNull();
    expect(await pending()).toBe('guide');
  });

  it('ignores a value that is not a section', async () => {
    await fakeBrowser.storage.local.set({ [PROMPTS_REQUEST_KEY]: 'other' });
    const { result } = renderHook(() => usePromptsRequest(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.section).toBeNull();
  });
});
