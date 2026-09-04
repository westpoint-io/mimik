// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { replayClick, replayInit, shouldInterceptClick } from '@/core/capture/events/click-intercept';

function el(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.firstElementChild as HTMLElement;
}

function click(over: Partial<MouseEventInit> & { isTrusted?: boolean } = {}): MouseEvent {
  return {
    isTrusted: true,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    button: 0,
    buttons: 1,
    detail: 1,
    clientX: 40,
    clientY: 90,
    screenX: 0,
    screenY: 0,
    ...over,
  } as MouseEvent;
}

describe('shouldInterceptClick', () => {
  it('intercepts an ordinary button, which is the whole point', () => {
    expect(shouldInterceptClick(el('<button>Copy link</button>'), click())).toBe(true);
  });

  it('lets our own replayed click through untouched', () => {
    expect(shouldInterceptClick(el('<button>Copy link</button>'), click({ isTrusted: false }))).toBe(false);
  });

  it('steps aside for a shift-click so the real action can happen', () => {
    expect(shouldInterceptClick(el('<button>Copy link</button>'), click({ shiftKey: true }))).toBe(false);
  });

  it('leaves native dropdowns alone, which break when their click is blocked', () => {
    expect(shouldInterceptClick(el('<select><option>a</option></select>'), click())).toBe(false);
    expect(shouldInterceptClick(el('<option>a</option>'), click())).toBe(false);
  });

  it('leaves editable surfaces alone so the caret still lands', () => {
    const editable = el('<div contenteditable="true">notes</div>');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(shouldInterceptClick(editable, click())).toBe(false);
  });

  it('leaves text fields to the typing session', () => {
    expect(shouldInterceptClick(el('<input type="text">'), click())).toBe(false);
    expect(shouldInterceptClick(el('<textarea></textarea>'), click())).toBe(false);
  });

  it('lets a checkbox toggle first, so the shot is not one state behind', () => {
    expect(shouldInterceptClick(el('<input type="checkbox">'), click())).toBe(false);
    expect(shouldInterceptClick(el('<input type="radio">'), click())).toBe(false);
  });

  it('lets an aria toggle through, the way a component library builds one', () => {
    expect(shouldInterceptClick(el('<div role="checkbox" aria-checked="false">Ship it</div>'), click())).toBe(false);
    expect(shouldInterceptClick(el('<div role="switch" aria-checked="false">Dark mode</div>'), click())).toBe(false);
    expect(shouldInterceptClick(el('<div role="radio" aria-checked="false">Weekly</div>'), click())).toBe(false);
  });

  it('lets a label through, because clicking it toggles the box it drives', () => {
    const host = document.createElement('div');
    host.innerHTML = '<input type="checkbox" id="bike"><label for="bike">I have a bike</label>';
    document.body.appendChild(host);
    expect(shouldInterceptClick(host.querySelector('label') as HTMLElement, click())).toBe(false);
  });

  it('lets a wrapping label through as well', () => {
    const label = el('<label>Remember me<input type="checkbox"></label>');
    expect(shouldInterceptClick(label, click())).toBe(false);
  });

  it('still intercepts a label that drives a text field, which is not a toggle', () => {
    const host = document.createElement('div');
    host.innerHTML = '<input type="text" id="email"><label for="email">Email</label>';
    document.body.appendChild(host);
    expect(shouldInterceptClick(host.querySelector('label') as HTMLElement, click())).toBe(true);
  });

  it('still intercepts an ordinary button inside a label', () => {
    expect(shouldInterceptClick(el('<button>Save</button>'), click())).toBe(true);
  });
});

describe('replayInit', () => {
  it('carries the pointer position through to the replayed click', () => {
    const init = replayInit(click({ clientX: 120, clientY: 340 }));
    expect(init).toMatchObject({ clientX: 120, clientY: 340, bubbles: true, cancelable: true });
  });

  it('preserves the modifier keys the page may branch on', () => {
    const init = replayInit(click({ ctrlKey: true, metaKey: true, altKey: true, button: 1 }));
    expect(init).toMatchObject({ ctrlKey: true, metaKey: true, altKey: true, button: 1 });
  });

  it('reaches a delegated listener on the document as an untrusted click', () => {
    const button = el('<button>Copy link</button>');
    const seen: Array<{ trusted: boolean; x: number }> = [];
    document.addEventListener('click', (e) => seen.push({ trusted: e.isTrusted, x: (e as MouseEvent).clientX }), {
      once: true,
    });
    replayClick(button, replayInit(click({ clientX: 77 })));
    expect(seen).toEqual([{ trusted: false, x: 77 }]);
  });

  it('focuses the target first, the way a real click would', () => {
    const button = el('<button>Copy link</button>');
    replayClick(button, replayInit(click()));
    expect(document.activeElement).toBe(button);
  });
});
