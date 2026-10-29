// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { extractElementMeta } from '@/core/capture/dom/element-meta';
import { buildFallbackDescription } from '@/core/capture/step-description';

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

  it('adds nothing to the page, where a copied radio would steal the selection', () => {
    const option = document.createElement('div');
    option.setAttribute('role', 'button');
    option.innerHTML = '<input type="radio" name="size" id="large" checked> Large';
    document.body.appendChild(option);
    const attached: Node[] = [];
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true, subtree: true });

    extractElementMeta(option);
    extractElementMeta(option.querySelector('input') as HTMLInputElement);
    for (const record of observer.takeRecords()) attached.push(...record.addedNodes);
    observer.disconnect();

    expect(attached).toEqual([]);
  });
});

describe('extractElementMeta help text', () => {
  it('names an icon-only control after its tooltip', () => {
    const el = document.createElement('div');
    el.title = 'Print list';
    el.textContent = '▤';
    document.body.appendChild(el);
    const meta = extractElementMeta(el);
    expect(meta.altText).toBe('Print list');
    expect(buildFallbackDescription('click', meta)).toContain('Print list');
  });
});

describe('extractElementMeta text', () => {
  it('reads a card without copying its subtree into the page', () => {
    const card = document.createElement('div');
    card.innerHTML = '<h3>Assign reviewer</h3><p>Pick someone from the team</p><iframe src="/embed"></iframe>';
    document.body.appendChild(card);
    const before = document.querySelectorAll('iframe').length;
    const meta = extractElementMeta(card);
    expect({ text: meta.textContent, iframes: document.querySelectorAll('iframe').length }).toEqual({
      text: 'Assign reviewer',
      iframes: before,
    });
  });

  it('ends the line where the heading ends, not where the next block starts', () => {
    const card = document.createElement('div');
    card.innerHTML = '<h3>Tidy the changelog</h3><span>CLICK ANYWHERE</span><p>Group the bumps</p>';
    document.body.appendChild(card);
    expect(extractElementMeta(card).textContent).toBe('Tidy the changelog');
  });

  it('keeps inline markup on one line and skips decorative nodes', () => {
    const button = document.createElement('button');
    button.innerHTML = '<svg aria-hidden="true"><title>icon</title></svg>Add <b>new</b> item';
    document.body.appendChild(button);
    expect(extractElementMeta(button).textContent).toBe('Add new item');
  });
});
