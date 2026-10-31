// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FaviconImg } from '../FaviconImg';

describe('FaviconImg', () => {
  it('tries the icon again when the domain changes after a failed load', () => {
    const { container, rerender } = render(<FaviconImg domain="app.example.com" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();

    rerender(<FaviconImg domain="facebook.com" />);

    expect(container.querySelector('img')?.getAttribute('src')).toContain('facebook.com');
  });
});
