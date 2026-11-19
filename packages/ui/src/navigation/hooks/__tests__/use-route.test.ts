// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { navigate } from '../../lib/navigate';
import { useRoute } from '../use-route';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useRoute', () => {
  it('carries copied steps through the hash, then drops them from the address', () => {
    const { result } = renderHook(() => useRoute());

    act(() => {
      navigate({ page: 'guide', guideId: 'g2', copied: { stepIds: ['a', 'b'], from: 'Set up payroll & tax' } });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(result.current).toEqual({
      page: 'guide',
      guideId: 'g2',
      copied: { stepIds: ['a', 'b'], from: 'Set up payroll & tax' },
    });
    expect(window.location.hash).toBe('#guide/g2');
  });

  it('opens a plain guide hash without copied steps', () => {
    window.history.replaceState(null, '', '/#guide/g1');

    const { result } = renderHook(() => useRoute());

    expect(result.current).toEqual({ page: 'guide', guideId: 'g1' });
  });
});
