// @vitest-environment jsdom

import { replaceGuideHost } from '@mimik/core/guides/service';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuideHostField } from '../GuideHostField';

vi.mock('@mimik/core/guides/service', () => ({ replaceGuideHost: vi.fn() }));

function renderField(onRejected = vi.fn()) {
  render(
    <GuideHostField
      guideId="g1"
      domain="localhost"
      origin="http://localhost:3000"
      onChanged={vi.fn()}
      onRejected={onRejected}
    />,
  );
  return screen.getByRole('textbox') as HTMLInputElement;
}

describe('GuideHostField', () => {
  it('puts the address back when the field is cleared', () => {
    const input = renderField();
    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.blur(input);

    expect(input.value).toBe('http://localhost:3000');
    expect(replaceGuideHost).not.toHaveBeenCalled();
  });

  it('reports a rejected address and marks the field until the next edit', async () => {
    vi.mocked(replaceGuideHost).mockRejectedValueOnce(new TypeError('Invalid URL'));
    const onRejected = vi.fn();
    const input = renderField(onRejected);
    fireEvent.change(input, { target: { value: 'not a host' } });
    fireEvent.blur(input);

    await vi.waitFor(() => expect(onRejected).toHaveBeenCalledOnce());
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('not a host');

    fireEvent.change(input, { target: { value: 'app.example.com' } });
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });
});
