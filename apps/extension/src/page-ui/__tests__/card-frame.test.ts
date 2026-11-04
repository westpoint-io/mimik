// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { CardFrame } from '../card-frame';

function post(source: Window | null, data: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data, source }));
}

let card: CardFrame;

afterEach(() => card.unmount());

describe('CardFrame', () => {
  it('mounts one ignored frame, once', () => {
    card = new CardFrame();
    card.mount();
    card.mount();
    expect(document.querySelectorAll('[data-mimik-ignore]')).toHaveLength(1);
    expect(card.mounted).toBe(true);
  });

  it('ignores messages that do not come from its own frame', () => {
    card = new CardFrame();
    card.mount();
    post(window, { mimikCard: 'close' });
    expect(card.mounted).toBe(true);
  });

  it('closes when its frame asks', () => {
    card = new CardFrame();
    card.mount();
    post(card['frame']!.contentWindow, { mimikCard: 'close' });
    expect(card.mounted).toBe(false);
    expect(document.querySelector('[data-mimik-ignore]')).toBeNull();
  });

  it('follows a drag and stays inside the window', () => {
    card = new CardFrame();
    card.mount();
    const source = card['frame']!.contentWindow;
    post(source, { mimikCard: 'move', dx: -10, dy: -6 });
    expect(card['frame']!.style.right).toBe('34px');
    expect(card['frame']!.style.bottom).toBe('30px');
    post(source, { mimikCard: 'move', dx: 500, dy: 500 });
    expect(card['frame']!.style.right).toBe('0px');
    expect(card['frame']!.style.bottom).toBe('0px');
  });

  it('can be hidden for a screenshot', () => {
    card = new CardFrame();
    card.mount();
    card.setHidden(true);
    expect((document.querySelector('[data-mimik-ignore]') as HTMLElement).style.opacity).toBe('0');
    card.setHidden(false);
    expect((document.querySelector('[data-mimik-ignore]') as HTMLElement).style.opacity).toBe('');
  });
});
