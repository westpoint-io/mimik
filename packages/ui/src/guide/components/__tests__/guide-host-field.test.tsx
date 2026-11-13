// @vitest-environment jsdom

import { replaceGuideHost } from '@mimik/core/guides/service';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuideHostField } from '../GuideHostField';

vi.mock('@mimik/core/guides/service', () => ({ replaceGuideHost: vi.fn() }));

function renderField() {
  render(<GuideHostField guideId="g1" domain="localhost" origin="http://localhost:3000" onChanged={vi.fn()} />);
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

  it('says why when the address is rejected, and clears it on the next edit', async () => {
    vi.mocked(replaceGuideHost).mockRejectedValueOnce(new TypeError('Invalid URL'));
    const input = renderField();
    fireEvent.change(input, { target: { value: 'not a host' } });
    fireEvent.blur(input);

    expect((await screen.findByRole('alert')).textContent).toContain('editor.guideHostInvalid');
    expect(input.value).toBe('not a host');

    fireEvent.change(input, { target: { value: 'app.example.com' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
