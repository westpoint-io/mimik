// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { localStorage } from '@mimik/core/env';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandingSettings } from '../BrandingSettings';

describe('BrandingSettings', () => {
  beforeEach(async () => {
    await localStorage.set({ brandFooter: 'Acme', brandAttribution: true });
  });

  it('shows what is stored and saves each change straight away', async () => {
    const onChange = vi.fn();
    render(<BrandingSettings onChange={onChange} />);
    await waitFor(() => expect(screen.getByDisplayValue('Acme')).toBeInTheDocument());

    fireEvent.click(screen.getByText('settings.footerPresetConfidential'));
    expect(onChange).toHaveBeenLastCalledWith({ brandFooter: 'settings.footerPresetConfidential' });

    const attribution = screen.getByRole('switch', { name: 'settings.attribution' });
    fireEvent.click(attribution);
    fireEvent.click(attribution);
    expect(onChange).toHaveBeenLastCalledWith({ brandAttribution: true });

    await waitFor(async () =>
      expect(await localStorage.get(['brandFooter', 'brandAttribution'])).toEqual({
        brandFooter: 'settings.footerPresetConfidential',
        brandAttribution: true,
      }),
    );
  });
});
