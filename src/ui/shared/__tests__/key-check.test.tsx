// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMessageMock } = vi.hoisted(() => ({ sendMessageMock: vi.fn() }));

vi.mock('@/lib/messaging', () => ({ sendMessage: sendMessageMock }));

import { KeyStatusNote, useKeyCheck } from '@/ui/shared/key-check';

describe('useKeyCheck', () => {
  beforeEach(() => {
    sendMessageMock.mockReset();
  });

  it('retains models returned with an unsuccessful validation', async () => {
    sendMessageMock.mockResolvedValue({ valid: false, reason: 'rejected', models: ['public-model'] });
    const { result } = renderHook(() => useKeyCheck());

    await act(async () => {
      await result.current.check('openaiCompatible', 'sk-key', 'https://api.example.com/v1', 'selected-model');
    });

    expect(result.current.status).toBe('rejected');
    expect(result.current.models).toEqual(['public-model']);
  });

  it('maps an invalid model response to a distinct status', async () => {
    sendMessageMock.mockResolvedValue({ valid: false, reason: 'model-invalid', models: ['public-model'] });
    const { result } = renderHook(() => useKeyCheck());

    await act(async () => {
      await result.current.check('openaiCompatible', 'sk-key', 'https://api.example.com/v1', 'missing-model');
    });

    expect(result.current.status).toBe('model-invalid');
    expect(result.current.models).toEqual(['public-model']);
  });

  it('clears status and models when reset', async () => {
    sendMessageMock.mockResolvedValue({ valid: false, reason: 'model-required', models: ['public-model'] });
    const { result } = renderHook(() => useKeyCheck());

    await act(async () => {
      await result.current.check('openaiCompatible', 'sk-key', 'https://api.example.com/v1');
      result.current.reset();
    });

    expect(result.current.status).toBeNull();
    expect(result.current.models).toBeNull();
  });
});

it('shows a distinct model-required note', () => {
  render(<KeyStatusNote status="model-required" />);
  expect(screen.getByText('settings.keyModelRequired')).toBeInTheDocument();
});

it('shows a distinct model-invalid note', () => {
  render(<KeyStatusNote status="model-invalid" />);
  expect(screen.getByText('settings.keyModelInvalid')).toBeInTheDocument();
});
