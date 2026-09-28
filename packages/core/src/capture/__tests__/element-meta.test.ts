// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { extractElementMeta } from '@/core/capture/dom/element-meta';

function withRect(el: HTMLElement, rect: { x: number; y: number; width: number; height: number }) {
  el.getBoundingClientRect = () => ({ ...rect, top: rect.y, left: rect.x, right: 0, bottom: 0, toJSON: () => ({}) });
  return el;
}

function menuItem(): HTMLElement {
  const el = document.createElement('button');
  el.textContent = 'Copy link';
  document.body.appendChild(el);
  return el;
}

describe('extractElementMeta', () => {
  it('measures the element when nothing was frozen at event time', () => {
    const el = withRect(menuItem(), { x: 12, y: 34, width: 100, height: 20 });
    expect(extractElementMeta(el).rect).toEqual({ x: 12, y: 34, width: 100, height: 20 });
  });

  it('prefers the live measurement while the element is still laid out', () => {
    const el = withRect(menuItem(), { x: 12, y: 34, width: 100, height: 20 });
    const stale = { x: 999, y: 999, width: 5, height: 5 };
    expect(extractElementMeta(el, stale).rect).toEqual({ x: 12, y: 34, width: 100, height: 20 });
  });

  it('falls back to the click-time rect once the element leaves the layout', () => {
    const el = withRect(menuItem(), { x: 12, y: 34, width: 100, height: 20 });
    const atClick = { x: 12, y: 34, width: 100, height: 20 };
    withRect(el, { x: 0, y: 0, width: 0, height: 0 });
    el.remove();
    expect(extractElementMeta(el, atClick).rect).toEqual(atClick);
  });

  it('still reports a degenerate rect when there is nothing better to offer', () => {
    const el = withRect(menuItem(), { x: 0, y: 0, width: 0, height: 0 });
    expect(extractElementMeta(el).rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('keeps reading the label off a detached element, which needs no layout', () => {
    const el = withRect(menuItem(), { x: 0, y: 0, width: 0, height: 0 });
    el.setAttribute('aria-label', 'Copy link');
    el.remove();
    const meta = extractElementMeta(el, { x: 12, y: 34, width: 100, height: 20 });
    expect(meta.ariaLabel).toBe('Copy link');
    expect(meta.rect).toEqual({ x: 12, y: 34, width: 100, height: 20 });
  });

  it('never attaches a copy of an input to the page, where a checked radio would steal the selection', () => {
    const option = document.createElement('div');
    option.setAttribute('role', 'button');
    option.innerHTML = '<input type="radio" name="size" id="large" checked> Large';
    document.body.appendChild(option);
    const attached: Node[] = [];
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true });

    extractElementMeta(option);
    extractElementMeta(option.querySelector('input') as HTMLInputElement);
    for (const record of observer.takeRecords()) attached.push(...record.addedNodes);
    observer.disconnect();

    expect(attached.length).toBeGreaterThan(0);
    for (const node of attached) {
      expect(node instanceof HTMLInputElement || (node as Element).querySelector?.('input')).toBeFalsy();
    }
  });
});
