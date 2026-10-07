// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createOverlayRoot } from '@/core/capture/dom/overlay-root';

describe('createOverlayRoot', () => {
  it('marks the host so capture and blur skip it', () => {
    const { host } = createOverlayRoot('');
    expect(host.hasAttribute('data-mimik-ignore')).toBe(true);
  });

  it('closes the shadow root so the page cannot reach in', () => {
    const { host } = createOverlayRoot('');
    expect(host.shadowRoot).toBeNull();
  });

  it('adopts the styles it is given', () => {
    const { shadow } = createOverlayRoot('.ring { color: red; }');
    expect(shadow.querySelector('style')?.textContent).toBe('.ring { color: red; }');
  });

  it('defaults to a div and takes a custom tag', () => {
    expect(createOverlayRoot('').host.tagName).toBe('DIV');
    expect(createOverlayRoot('', 'mimik-notification').host.tagName).toBe('MIMIK-NOTIFICATION');
  });
});
