// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMessageMock } = vi.hoisted(() => ({ sendMessageMock: vi.fn() }));

vi.mock('@/lib/messaging', () => ({ sendMessage: sendMessageMock }));

import { KeyStatusNote, SecretInput, useKeyCheck } from '@/ui/shared/key-check';

describe('useKeyCheck', () => {
  beforeEach(() => {
    sendMessageMock.mockReset();
  });

  it('retains models returned with an unsuccessful validation', async () => {
    sendMessageMock.mockResolvedValue({ valid: false, reason: 'rejected', models: ['public-model'] });
    const { result } = renderHook(() => useKeyCheck());

    await act(async () => {
      await result.current.check('openai', 'sk-key', 'https://api.example.com/v1', 'selected-model');
    });

    expect(result.current.status).toBe('rejected');
    expect(result.current.models).toEqual(['public-model']);
  });

  it('maps an invalid model response to a distinct status', async () => {
    sendMessageMock.mockResolvedValue({ valid: false, reason: 'model-invalid', models: ['public-model'] });
    const { result } = renderHook(() => useKeyCheck());

    await act(async () => {
      await result.current.check('openai', 'sk-key', 'https://api.example.com/v1', 'missing-model');
    });

    expect(result.current.status).toBe('model-invalid');
    expect(result.current.models).toEqual(['public-model']);
  });

  it('clears status and models when reset', async () => {
    sendMessageMock.mockResolvedValue({ valid: false, reason: 'model-required', models: ['public-model'] });
    const { result } = renderHook(() => useKeyCheck());

    await act(async () => {
      await result.current.check('openai', 'sk-key', 'https://api.example.com/v1');
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

describe('SecretInput', () => {
  it('hides the key until the reveal button is pressed, and hides it again', () => {
    render(<SecretInput value="sk-secret" onChange={() => {}} placeholder="sk-..." />);

    const field = screen.getByPlaceholderText('sk-...');
    expect(field).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button'));
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveValue('sk-secret');

    fireEvent.click(screen.getByRole('button'));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('reports edits while revealed', () => {
    const onChange = vi.fn();
    render(<SecretInput value="" onChange={onChange} placeholder="sk-..." />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-typed' } });
    expect(onChange).toHaveBeenCalledWith('sk-typed');
  });
});
